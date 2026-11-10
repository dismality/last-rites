// Dev-only test hook, exposed as `window.__lastRites` for the Playwright specs in e2e/.
// It is loaded from main.tsx behind `import.meta.env.DEV` with a dynamic import, so a production
// build neither contains nor references it (tests/debugHookStripped.test.ts checks dist).
// The hook drives the game through the same stores, actions and input module as real play.
//
// Pointer lock: headless Chrome is never granted it. `lockless(true)` (on by default once a run is
// started through `startRun`) makes input.ts and the hotbar wheel act as if the canvas were locked.

import type * as THREE from 'three'
import { DAY_DURATION_S, DUSK_DURATION_S } from '../data/balance'
import type { EnemyId } from '../data/enemies'
import type { WeaponPickupId } from '../data/weaponPickups'
import { createRng, deriveSeed } from '../game/rng'
import { emit, subscribeToType } from '../game/events'
import { beginMode, continueGame } from '../game/state/runFlow'
import { takeWeaponPickup } from '../game/state/combatActions'
import { saveGame } from '../game/state/gameSave'
import { resetCoinStream } from '../game/state/progressionEvents'
import { pickUpgrade } from '../game/state/progressionActions'
import { hurtPlayer, retryNight } from '../game/state/retryNight'
import { useCoinStore } from '../game/state/coinStore'
import { useScoreStore } from '../game/state/scoreStore'
import { useDigStore } from '../game/state/digStore'
import { useInteractionStore } from '../game/state/interactionStore'
import { useUiWorldStore } from '../game/state/uiWorldStore'
import { useLanternStore } from '../game/state/lanternStore'
import { applyDamage } from '../game/systems/combat'
import { coinDrop } from '../game/systems/coins'
import { killReports } from '../game/systems/killReports'
import { bodyRuntime } from '../scene/player/bodyRuntime'
import { scareRuntime } from '../scene/scares/scareRuntime'
import { useIntroStore } from '../game/state/introStore'
import { useGameStore } from '../game/state/gameStore'
import { useWorldStore } from '../game/state/worldStore'
import { useWaveStore } from '../game/state/waveStore'
import { useEnemyStore } from '../game/state/enemyStore'
import { useProgressionStore } from '../game/state/progressionStore'
import { useInventoryStore } from '../game/state/inventoryStore'
import { useCombatStore } from '../game/state/combatStore'
import { useDoorStore } from '../game/state/doorStore'
import { showItemName } from '../game/state/itemNameStore'
import { useChapelStore } from '../game/state/chapelStore'
import { useSpawnStore } from '../game/state/spawnStore'
import { usePlayerStore } from '../game/state/playerStore'
import { useEndingStore } from '../game/state/endingStore'
import { useBossStore } from '../game/state/bossStore'
import { startEnding } from '../game/state/startEnding'
import { endingCameraRuntime } from '../scene/effects/endingCameraRuntime'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { useSettingsStore } from '../game/state/settingsStore'
import { queueTeleport } from '../game/state/playerTeleport'
import { deriveTickInput } from '../game/state/progressionTick'
import { createEnemy } from '../game/systems/enemyAI'
import { addItem, assignHotbar } from '../game/systems/inventory'
import type { ItemId, ModeId, Phase } from '../game/types'
import { input } from '../scene/player/input'
import { lockOverride } from '../scene/player/pointerLockOverride'
import { installFrameRecorder, type FrameRecorder } from './frameRecorder'

/** A rolling window long enough to cover a whole spec step. */
const FRAME_WINDOW_MS = 30_000
/** Just short of a boundary so the real tick performs the phase change and emits its events. */
const BOUNDARY_EPSILON_S = 0.05
const DEFAULT_HOLD_MS = 120

/** JSON-safe copy: Sets become arrays, Maps become entries, functions are dropped. */
export function toSnapshot<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v: unknown) => {
      if (v instanceof Set) return [...v]
      if (v instanceof Map) return [...v]
      if (typeof v === 'number' && !Number.isFinite(v)) return String(v)
      return v
    }),
  )
}

export interface SpawnPoint {
  x: number
  z: number
  type?: EnemyId
  /** Overrides current HP (not max HP), e.g. 1 for a zombie one swing kills. */
  hp?: number
}

export type SnapshotName =
  | 'game'
  | 'world'
  | 'wave'
  | 'enemies'
  | 'progression'
  | 'inventory'
  | 'combat'
  | 'doors'
  | 'spawn'
  | 'player'
  | 'ending'
  | 'objective'
  | 'score'
  | 'coins'
  | 'dig'
  | 'hover'
  | 'boss'
  | 'intro'
  | 'lantern'
  | 'uiWorld'

const SNAPSHOTS: Record<SnapshotName, () => unknown> = {
  game: () => useGameStore.getState(),
  world: () => useWorldStore.getState(),
  wave: () => useWaveStore.getState(),
  enemies: () => useEnemyStore.getState().enemies,
  progression: () => useProgressionStore.getState(),
  inventory: () => ({
    ...useInventoryStore.getState(),
  }),
  combat: () => useCombatStore.getState(),
  doors: () => useDoorStore.getState(),
  spawn: () => useSpawnStore.getState(),
  player: () => usePlayerStore.getState(),
  ending: () => useEndingStore.getState(),
  objective: () => useGuidanceStore.getState().objective,
  score: () => useScoreStore.getState(),
  coins: () => useCoinStore.getState(),
  dig: () => ({ ...useDigStore.getState().dig, active: useDigStore.getState().active }),
  hover: () => useInteractionStore.getState().hover,
  boss: () => useBossStore.getState().boss,
  intro: () => useIntroStore.getState(),
  lantern: () => useLanternStore.getState(),
  uiWorld: () => useUiWorldStore.getState(),
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null

let uid = 0
// Created on install, so importing this module (tests) never touches requestAnimationFrame.
let frames: FrameRecorder | null = null

function releaseLater(code: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      input.keyUp(code)
      resolve()
    }, ms)
  })
}

const api = {
  /** Starts a run in `mode`, skipping the title, mode select and intro, and runs without pointer lock. */
  startRun(mode: ModeId = 'normal'): void {
    beginMode(mode)
    useIntroStore.getState().skip()
    useGameStore.getState().setPaused(false)
    lockOverride.enabled = true
  },
  /** New Game as the player does it: the intro is NOT skipped. Runs without pointer lock. */
  newGameWithIntro(mode: ModeId = 'normal'): void {
    beginMode(mode)
    useGameStore.getState().setPaused(false)
    lockOverride.enabled = true
  },
  /** The function the final rite and the death check call to start an ending. */
  startEnding(id: 'rest' | 'uneasy-peace' | 'taken'): void {
    startEnding(id)
  },
  /** Seconds into the ending camera sequence (the clock the subtitles follow). */
  endingClock(): number {
    return endingCameraRuntime.time
  },
  setLantern(on: boolean, fuel?: number): void {
    const l = useLanternStore.getState()
    l.setOn(on)
    if (fuel !== undefined) l.setFuel(fuel)
  },
  /**
   * Holds zombies still by staggering them (they stand where they are), after their rise, so a
   * screenshot can be taken at an exact distance. The uids come from spawnZombies.
   */
  holdZombies(uids: readonly string[], seconds = 60): void {
    const store = useEnemyStore.getState()
    store.setEnemies(store.enemies.map((e) => (uids.includes(e.uid) ? { ...e, stagger: seconds } : e)))
  },
  /** Removes the named zombies (a clean frame for screenshot differencing). */
  removeZombies(uids: readonly string[]): void {
    const store = useEnemyStore.getState()
    store.setEnemies(store.enemies.filter((e) => !uids.includes(e.uid)))
  },
  /**
   * Counts the interactable cues in the scene graph: rune sprites that are drawn (opacity above 0)
   * and hover outlines. Null when no scene is mounted.
   */
  runeCues(): { runes: number; visibleRunes: number; outlines: number } | null {
    const root = bodyRuntime.scene
    if (!root) return null
    let runes = 0
    let visibleRunes = 0
    let outlines = 0
    root.traverse((o) => {
      if (o.name === 'hover-outline') outlines++
      const s = o as THREE.Sprite
      if (!s.isSprite) return
      const m = s.material as THREE.SpriteMaterial
      if (!m.map?.name.startsWith('rune:')) return
      runes++
      if (s.visible && m.opacity > 0.01) visibleRunes++
    })
    return { runes, visibleRunes, outlines }
  },
  /** Treat the canvas as pointer-locked (or stop doing so). */
  lockless(on: boolean): void {
    lockOverride.enabled = on
  },
  setClock(c: { phase?: Phase; night?: number; phaseTime?: number }): void {
    const w = useWorldStore.getState()
    if (c.night !== undefined) w.setNightNumber(c.night)
    if (c.phase !== undefined) w.setPhase(c.phase)
    if (c.phaseTime !== undefined) w.setPhaseTime(c.phaseTime)
  },
  /** Puts the clock just before dusk; the next sim tick enters it for real. */
  skipToDusk(night?: number): void {
    api.setClock({
      phase: 'day',
      night,
      phaseTime: deriveTickInput().dayLengthS - BOUNDARY_EPSILON_S,
    })
    // wavesCleared is deliberately not reset: a stale flag from the previous night is exactly what
    // the real tick has to cope with (playtest item 1).
  },
  /** Puts the clock just before night; the next sim tick emits `nightStarted` and the waves begin. */
  skipToNight(night?: number): void {
    api.setClock({ phase: 'dusk', night, phaseTime: DUSK_DURATION_S - BOUNDARY_EPSILON_S })
  },
  spawnZombies(points: readonly SpawnPoint[]): string[] {
    const made = points.map((p) => {
      const e = createEnemy(`dbg-${uid++}`, p.type ?? 'shambler', { x: p.x, z: p.z })
      return p.hp === undefined ? e : { ...e, hp: p.hp }
    })
    const store = useEnemyStore.getState()
    store.setEnemies([...store.enemies, ...made])
    return made.map((e) => e.uid)
  },
  /** Adds to the satchel; `hotbar` (0 to 3) also binds the item to that slot. Returns how many fitted. */
  give(id: ItemId, qty = 1, hotbar?: 0 | 1 | 2 | 3): number {
    const inv = useInventoryStore.getState()
    const res = addItem(inv.inventory, id, qty)
    let next = res.inv
    if (hotbar !== undefined) next = assignHotbar(next, hotbar, id)
    inv.setInventory(next)
    useCombatStore.getState().reconcile(next)
    return res.added
  },
  equip(slot: 0 | 1 | 2 | 3): void {
    useInventoryStore.getState().equipSlot(slot)
  },
  /** Moves the Rapier body at the next frame, exactly as Retry Night and Continue do. */
  teleport(x: number, z: number, opts: { y?: number; yaw?: number; pitch?: number } = {}): void {
    const y = opts.y ?? 0.05
    const yaw = opts.yaw ?? 0
    const pitch = opts.pitch ?? 0
    // The controller reads look angles from the store and writes position back only while moving,
    // so a real walk to this spot would leave the store exactly like this.
    const p = usePlayerStore.getState()
    p.setPosition([x, y, z])
    p.setYaw(yaw)
    p.setPitch(pitch)
    queueTeleport({ position: [x, y, z], yaw, pitch })
  },
  /** Where the Rapier body (feet) and the camera really are, or null when no rig is mounted. */
  body(): { feet: [number, number, number]; camera: [number, number, number]; yaw: number } | null {
    const { body, camera } = bodyRuntime
    if (!body || !camera) return null
    const t = body.translation()
    // The capsule centre is 0.85 m above the feet (see FirstPersonController).
    return {
      feet: [t.x, t.y - 0.85, t.z],
      camera: [camera.position.x, camera.position.y, camera.position.z],
      yaw: camera.rotation.y,
    }
  },
  /**
   * Zones the sensors report the player inside now, and every zone entered since the run started.
   * An entry means the intersection event fired, the same handler that queues the zone for the
   * scare director (justEntered), so a test can check a scare could fire without the random roll.
   */
  scareZones(): { inside: string[]; entered: string[] } {
    return { inside: [...scareRuntime.inside], entered: [...scareRuntime.entered] }
  },
  /** Mesh count under the named scene group (-1 when no such group is mounted). */
  meshesUnder(name: string): number {
    const root: THREE.Object3D | undefined = bodyRuntime.scene?.getObjectByName(name)
    if (!root) return -1
    let n = 0
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++
    })
    return n
  },
  /**
   * Damages every living zombie through the same rules as a melee blow (applyDamage with the
   * live lantern fuel) and reports the kills as MeleeAttack does. Skips only the swing geometry.
   */
  killAll(): number {
    const store = useEnemyStore.getState()
    const before = store.enemies
    const fuel = useLanternStore.getState().fuel
    const after = before.map((e) =>
      e.hp > 0 ? applyDamage(e, 1_000_000, { lanternFuel: fuel, source: 'melee' }) : e,
    )
    store.setEnemies(after)
    const kills = killReports(before, after, 'melee')
    kills.forEach(emit)
    return kills.length
  },
  /** Applies the first offered dawn upgrade through the real pick action. */
  pickAnyUpgrade(): boolean {
    const offer = useProgressionStore.getState().pendingPick
    return offer !== null && offer.length > 0 && pickUpgrade(offer[0])
  },
  /** Raises the shared item-name label exactly as hover and the hotbar do. */
  showItemName(id: ItemId): void {
    showItemName(id)
  },
  /** The real chapel repair action (spends the stage's cost from the satchel); stage 1 fits the barricades. */
  repairChapel(): boolean {
    return useChapelStore.getState().applyRepair().ok
  },
  /** Sets board health per door directly (a spec shortcut for extra boards; nailing itself is tested separately). */
  setDoorBoards(front: readonly number[], vestry: readonly number[]): void {
    useDoorStore.getState().setDoors({ front, vestry })
  },
  /** The real pickup action an Interactable calls. */
  takePickup(id: WeaponPickupId): boolean {
    return takeWeaponPickup(id).taken
  },
  collectMaterial(spawnId: string, index = 0): void {
    useSpawnStore.getState().collectMaterial(spawnId, index)
  },
  /** One zombie blow on the player through the real damage path. */
  hurt(dmg: number): boolean {
    return hurtPlayer(dmg, false, 'zombie')
  },
  retryNight,
  saveGame,
  continueGame,
  setScreen(screen: 'title' | 'game'): void {
    useGameStore.getState().setScreen(screen)
  },
  /** Holds a bound action until `release` is called (a swing needs the key down across a frame). */
  hold(name: string): void {
    const code = useSettingsStore.getState().bindings[name]
    if (!code) throw new Error(`No binding for action "${name}"`)
    input.keyDown(code)
  },
  release(name: string): void {
    const code = useSettingsStore.getState().bindings[name]
    if (code) input.keyUp(code)
  },
  /**
   * Picks a run seed whose first `n` Shambler coin rolls on `night` all drop coins, so a spec can
   * assert coin piles without depending on the 50% roll. Returns the seed.
   */
  seedForShamblerCoins(n: number, night = 1): number {
    for (let s = 1; s < 10_000; s++) {
      const rng = createRng(deriveSeed(s, 'coins', night))
      let ok = true
      for (let i = 0; i < n && ok; i++) ok = coinDrop(rng, 'shambler', false, 0) > 0
      if (ok) {
        useProgressionStore.getState().patch({ seed: s })
        resetCoinStream()
        return s
      }
    }
    throw new Error('no seed found')
  },
  /** Phase and night events since the page loaded, in order. */
  events(): LoggedEvent[] {
    return [...eventLog]
  },
  /** Keeps the player alive for specs that watch zombies instead of fighting them. */
  keepAlive(on: boolean): void {
    if (keepAliveTimer) clearInterval(keepAliveTimer)
    keepAliveTimer = null
    if (!on) return
    keepAliveTimer = setInterval(() => {
      if (useGameStore.getState().taken) return
      const max = usePlayerStore.getState().maxHealth
      if (usePlayerStore.getState().health < max) {
        usePlayerStore.getState().setHealth(max)
        useUiWorldStore.setState({ playerHealth: max })
      }
    }, 50)
  },
  setHealth(hp: number): void {
    usePlayerStore.getState().setHealth(hp)
  },
  /** Reads a JSON-safe copy of one store. */
  snapshot(name: SnapshotName): unknown {
    return toSnapshot(SNAPSHOTS[name]())
  },
  snapshotAll(): Record<SnapshotName, unknown> {
    const out = {} as Record<SnapshotName, unknown>
    for (const k of Object.keys(SNAPSHOTS) as SnapshotName[]) out[k] = api.snapshot(k)
    return out
  },
  /** Presses a key by KeyboardEvent.code (e.g. 'KeyE') for `ms`, through the same input module as real keys. */
  async press(code: string, ms = DEFAULT_HOLD_MS): Promise<void> {
    input.keyDown(code)
    await releaseLater(code, ms)
  },
  /** Presses a bound action by its settings name (e.g. 'Interact', 'Attack'); mouse actions use the mouse codes. */
  async action(name: string, ms = DEFAULT_HOLD_MS): Promise<void> {
    const code = useSettingsStore.getState().bindings[name]
    if (!code) throw new Error(`No binding for action "${name}"`)
    await api.press(code, ms)
  },
  keyDown: (code: string): void => input.keyDown(code),
  keyUp: (code: string): void => input.keyUp(code),
  releaseAll: (): void => input.releaseAll(),
  /** The input module itself, for anything not covered above. */
  input,
  /** Longest frame in the last `windowMs` (default the whole rolling window), in ms. */
  longestFrameMs(windowMs?: number): number {
    return frames?.longest(windowMs) ?? 0
  },
  resetFrames(): void {
    frames?.reset()
  },
  constants: { DAY_DURATION_S, DUSK_DURATION_S },
}

export type LastRitesHook = typeof api

declare global {
  interface Window {
    __lastRites?: LastRitesHook
  }
}

export interface LoggedEvent {
  type: string
  phase?: string
  night: number
  /** Wall-clock ms since the hook was installed. */
  at: number
}

const eventLog: LoggedEvent[] = []
let eventLogOn = false

function installEventLog(): void {
  if (eventLogOn) return
  eventLogOn = true
  const t0 = performance.now()
  const note = (type: string, phase?: string) =>
    eventLog.push({ type, phase, night: useWorldStore.getState().nightNumber, at: performance.now() - t0 })
  subscribeToType('phaseChanged', (e) => note('phaseChanged', e.phase))
  subscribeToType('nightStarted', () => note('nightStarted'))
  subscribeToType('nightCleared', () => note('nightCleared'))
  subscribeToType('dawnStarted', () => note('dawnStarted'))
}

export function installDebugHook(): void {
  installEventLog()
  frames ??= installFrameRecorder(FRAME_WINDOW_MS)
  window.__lastRites = api
}

