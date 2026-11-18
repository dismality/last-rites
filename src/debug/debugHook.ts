// Dev-only test hook, exposed as `window.__lastRites` for the Playwright specs in e2e/.
// It is loaded from main.tsx behind `import.meta.env.DEV` with a dynamic import, so a production
// build neither contains nor references it (tests/debugHookStripped.test.ts checks dist).
// The hook drives the game through the same stores, actions and input module as real play.
//
// Pointer lock: headless Chrome is never granted it. `lockless(true)` (on by default once a run is
// started through `startRun`) makes input.ts and the hotbar wheel act as if the canvas were locked.

import { useNameTheDeadStore } from '../game/state/nameTheDeadStore'
import { WAVE_GRAVES } from '../data/waves'
import type * as THREE from 'three'
import { Frustum, Matrix4 } from 'three'
import { Box3, Raycaster, Vector2, Vector3 } from 'three'
import { DAY_DURATION_S, DUSK_DURATION_S, INTERACT_RANGE_M } from '../data/balance'
import { interactableRegistry } from '../scene/world/interactableRegistry'
import { DRACO_PATH, worldModelUrl, type WorldModelId } from '../data/assets'
import { colliderOwner } from './colliderOwners'
import {
  giveAllClues,
  giveClue,
  giveRelic,
  linkClues,
  setAltarPanel,
  skipToStage,
  solveCurrentCase,
  solveCurrentMinigame,
  unsolvedMinigames,
  triggerGrab,
  forceScreenScare,
  teleportNextToBat,
  fireShot,
  spawnCrawlerAmbush,
  spawnBrideDev,
  spawnHoundPack,
} from '../dev/devActions'
import { useCreatureStore } from '../game/state/creatureStore'
import { meleeCreatures, shotCreatures } from '../game/state/creatureDamage'
import { forwardFromYaw } from '../game/systems/melee'
import { useBatStore } from '../game/state/batStore'
import { batPerchPoint } from '../game/state/batStep'
import { triggerScreenScare } from '../game/state/screenScareActions'
import { screenScareRuntime, useScreenScareStore } from '../game/state/screenScareStore'
import { useKillCamStore } from '../game/state/killCamStore'
import { simClock } from '../game/state/simClock'
import { caseOfStage } from '../data/cases'
import { RITE_ORDER } from '../data/relics'
import { useAccusationStore } from '../game/state/accusationStore'
import { useRiteStore } from '../game/state/riteStore'
import { useCaseStore } from '../game/state/caseStore'
import type { EnemyId } from '../data/enemies'
import type { WeaponPickupId } from '../data/weaponPickups'
import { createRng, deriveSeed } from '../game/rng'
import { emit, subscribeToType } from '../game/events'
import { beginMode, continueGame } from '../game/state/runFlow'
// Aliased: useHeld is a plain action, not a React hook, and the lint rule goes by the name.
import { takeWeaponPickup, useHeld as consumeHeldItem } from '../game/state/combatActions'
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
import { useLanternHandStore } from '../game/state/lanternHandStore'
import { waitingPaths } from '../game/state/waitingList'
import { hotbarItem } from '../game/systems/satchel'
import { gripFor } from '../game/systems/gripClass'
import { GRIP_TABLE, type GripWeaponId } from '../data/viewmodel'
import { handsRuntime, lanternHandRuntime, lanternLightRuntime } from '../scene/player/lanternRig'
import { applyDamage } from '../game/systems/combat'
import { coinDrop } from '../game/systems/coins'
import { killReports } from '../game/systems/killReports'
import { bodyRuntime } from '../scene/player/bodyRuntime'
import { scareRuntime } from '../scene/scares/scareRuntime'
import type { ScareEventId } from '../data/scares'
import { useIntroStore } from '../game/state/introStore'
import { useGameStore } from '../game/state/gameStore'
import { useWorldStore } from '../game/state/worldStore'
import { useWaveStore } from '../game/state/waveStore'
import { useStageStore } from '../game/state/stageStore'
import { useEnemyStore } from '../game/state/enemyStore'
import { useProgressionStore } from '../game/state/progressionStore'
import { useInventoryStore } from '../game/state/inventoryStore'
import { useCombatStore } from '../game/state/combatStore'
import { useDoorStore } from '../game/state/doorStore'
import { showItemName } from '../game/state/itemNameStore'
import { useChapelStore } from '../game/state/chapelStore'
import { useSpawnStore } from '../game/state/spawnStore'
import { usePlayerStore } from '../game/state/playerStore'
import { useMapStore } from '../game/state/mapStore'
import { usePinStore } from '../game/state/pinStore'
import { useMysteryStore } from '../game/state/mysteryStore'
import { minimapRuntime } from '../ui/hud/minimapRuntime'
import { useEndingStore } from '../game/state/endingStore'
import { useBossStore } from '../game/state/bossStore'
import { startEnding } from '../game/state/startEnding'
import { useHunchStore } from '../game/state/hunchStore'
import { winRuntime } from '../scene/effects/winRuntime'
import { endingCameraRuntime } from '../scene/effects/endingCameraRuntime'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { useSettingsStore } from '../game/state/settingsStore'
import { bellRuntime } from '../scene/world/bellRuntime'
import { queueTeleport } from '../game/state/playerTeleport'
import { deriveTickInput } from '../game/state/progressionTick'
import { createEnemy } from '../game/systems/enemyAI'
import { addItem, assignHotbar } from '../game/systems/inventory'
import type { ItemId, ModeId, Phase } from '../game/types'
import { input } from '../scene/player/input'
import { lockOverride } from '../scene/player/pointerLockOverride'
import { installFrameRecorder, type FrameRecorder } from './frameRecorder'
import { useVendingStore } from '../game/state/vendingStore'
import { useOverlayStore } from '../game/state/overlayStore'
import { nearVending, resetVendingStock, vendingOwnedGuns } from '../game/state/vendingActions'
import { visibleRows } from '../game/systems/vending'
import { VENDING_ANCHORS } from '../data/vending'

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
  | 'map'
  | 'mystery'
  | 'chapel'

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
  // Explored 8 m cells (the Journal map's data, which the minimap also draws).
  map: () => useMapStore.getState().map,
  mystery: () => useMysteryStore.getState(),
  chapel: () => useChapelStore.getState().chapel,
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

export const api = {
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
  startEnding(id: 'rest' | 'taken'): void {
    startEnding(id)
  },
  /** Grab kill-cam (spec 10 task 8): starts so far, the held grab and what the camera is doing. */
  /** Name the Dead (spec 10 task 11): the glowing grave, the seal, the hold and the run score. */
  nameTheDead(): {
    glow: { graveId: string; name: string; wave: number; x: number; z: number } | null
    sealed: { graveId: string; wave: number } | null
    progress: number
    sealedCount: number
    score: number
  } {
    const { glow, sealed } = useWaveStore.getState()
    const g = glow ? WAVE_GRAVES.find((w) => w.id === glow.graveId) : undefined
    const n = useNameTheDeadStore.getState()
    return {
      glow: glow && g ? { ...glow, x: g.x, z: g.z } : null,
      sealed,
      progress: n.progress,
      sealedCount: n.sealedCount,
      score: useProgressionStore.getState().score,
    }
  },
  killCam(): {
    count: number
    lastStartS: number | null
    now: number
    held: { enemy: string; pull: boolean; holdS: number; shake: boolean; closeUp: boolean; stinger: string | null } | null
    edge: string | null
    fov: number | null
  } {
    const k = useKillCamStore.getState()
    const cam = bodyRuntime.camera as THREE.PerspectiveCamera | null
    return {
      count: k.count,
      lastStartS: k.lastStartS,
      now: simClock.now,
      held: k.active && { enemy: k.active.enemy, ...k.active.plan },
      edge: k.edge?.kind ?? null,
      fov: cam?.isPerspectiveCamera ? cam.fov : null,
    }
  },
  /** The Dev_Panel's "Trigger grab": health below 25% and a Lurker waking behind the keeper. */
  triggerGrab(): string {
    return triggerGrab()
  },
  /** Keeper's hunch: seconds of day play since the last clue and the clue the flame leans to. */
  hunch(): { sinceClueS: number; found: number; target: string | null; at: number[] | null } {
    const h = useHunchStore.getState()
    return { ...h.clock, target: h.target?.id ?? null, at: h.target ? [...h.target.position] : null }
  },
  /** As if `seconds` of day play had passed without a clue. */
  skipHunch(seconds: number): void {
    useHunchStore.getState().skip(seconds)
  },
  /** The Rest ending straight into the win walk-out, past the sunrise (spec 10 task 6). */
  playWinCutscene(): void {
    startEnding('rest')
    useEndingStore.getState().playWalkout()
  },
  /** Holds the win walk-out at `t` seconds (null lets it run on). For the gate-shot screenshots. */
  holdWinAt(t: number | null): void {
    winRuntime.holdAt = t
  },
  /** Seconds into the win walk-out, and how far the sun has risen. */
  winClock(): { time: number; sun: number; active: boolean } {
    return { time: winRuntime.time, sun: winRuntime.sun, active: winRuntime.active }
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
  /** Night with its waves cleared: the next sim tick ends the night and starts dawn (summary and offer). */
  skipToDawn(): void {
    useWorldStore.getState().applyWorldState({ phase: 'night', phaseTime: 0, wavesCleared: true })
    // Story nights end when the case is solved (Endless ignores the flag).
    useStageStore.getState().solveCase(0)
  },
  /** JSON-safe copy of the stage store (stage, case solved flag, night clock, altar answers). */
  stageState(): unknown {
    return toSnapshot(useStageStore.getState())
  },
  /** The Dev_Panel's "Skip to stage N": start of that stage's day, with its key items and recipes. */
  skipToStage(n: 1 | 2 | 3): string {
    return skipToStage(n)
  },
  /**
   * Closes a case through the real store action, as the solved watcher does at night. The e2e uses
   * it to reveal what a closed case gives up (the Rusted Crypt Key lies in Pell's grave only then).
   */
  closeCase(id: 'saved-by-the-bell' | 'resurrection-men' | 'sealed-catacombs'): void {
    useCaseStore.getState().closeCase(id)
  },
  /** The Dev_Panel's "Solve current case" (the real store action). */
  solveCurrentCase(): string {
    return solveCurrentCase()
  },
  /** JSON-safe copy of the case store: found clues, links, solved minigames, slots, hints, Doubt, closed cases. */
  caseState(): unknown {
    return toSnapshot(useCaseStore.getState())
  },
  /** Minigames of the active case: which exist, which are solved and which are still open. */
  minigameState(): { all: string[]; solved: string[]; unsolved: string[] } {
    const def = caseOfStage(useStageStore.getState().stage)
    return {
      all: [...def.minigames],
      solved: [...useCaseStore.getState().cases[def.id].minigames],
      unsolved: unsolvedMinigames(),
    }
  },
  /** The Dev_Panel's "Give all clues". */
  giveAllClues(): string {
    return giveAllClues()
  },
  giveClue(id: string): string {
    return giveClue(id)
  },
  /** The Dev_Panel's "Solve current minigame" (real `submitMinigame`). */
  solveCurrentMinigame(): string {
    return solveCurrentMinigame()
  },
  /** Links two found clues of the active case through the real store action. */
  linkClues(a: string, b: string): string {
    return linkClues(a, b)
  },
  /** Spec 11 H6: the vending machine as the panel sees it (stock, visible rows, open flag, last purchase). */
  vendingState(): {
    open: boolean
    stockLeft: Record<string, number>
    visible: string[]
    lastPurchase: { row: string; handle: number; seq: number } | null
    coins: number
    near: boolean
    handleOffsets: number[]
  } {
    const v = useVendingStore.getState()
    return {
      open: useOverlayStore.getState().vendingOpen,
      stockLeft: { ...v.stock.stockLeft },
      visible: visibleRows(vendingOwnedGuns()).map((r) => r.id),
      lastPurchase: v.lastPurchase ? { ...v.lastPurchase } : null,
      coins: useProgressionStore.getState().coins,
      near: nearVending(),
      // How far each handle knob is pulled out now (m, model +Z), from the scene.
      handleOffsets: VENDING_ANCHORS.handles.map((h, i) => {
        const o = bodyRuntime.scene?.getObjectByName(`handle-${i}`)
        return o ? Math.round((o.position.z - h[2]) * 1000) / 1000 : 0
      }),
    }
  },
  /** Spec 11 H7: the first-person hands as the viewmodel sees them (held item, grip class, lantern hand mode, caption flag). */
  viewmodelState(): {
    equipped: string | null
    /** The grip class the hands are set to now (follows the shown weapon, after the swap). */
    grip: string
    /** The grip class the table gives the equipped weapon, or null for a non-grip item. */
    gripExpected: string | null
    lanternMode: string
    acting: boolean
    shotgunEquipped: boolean
    hookCaptionShown: boolean
    throwSerial: number
    /** Art paths still missing (the weapon-only viewmodel and generated cookie stand in). */
    missingArt: string[]
  } {
    const inv = useInventoryStore.getState()
    const equipped = inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    const hand = lanternHandRuntime.hand
    return {
      equipped,
      grip: handsRuntime.grip,
      gripExpected: equipped !== null && equipped in GRIP_TABLE ? gripFor(equipped as GripWeaponId) : null,
      lanternMode: hand.mode,
      acting: hand.acting,
      shotgunEquipped: hand.shotgunEquipped,
      hookCaptionShown: useLanternHandStore.getState().hookCaptionShown,
      throwSerial: handsRuntime.throwSerial,
      missingArt: [...waitingPaths()],
    }
  },
  /** Spec 11 H7: the lantern light rig as of its last frame (flicker signal, intensities, colour, anchor, cookie, shadow). */
  lanternLightState(): {
    on: boolean
    fuel: number
    signal: number
    gutterAmp: number
    color: string
    lowPass: boolean
    beam: boolean
    zeroAge: number | null
    spotIntensity: number
    fillIntensity: number
    emberIntensity: number
    flameScale: number
    glassEmissive: number
    anchor: 'glass' | 'belt'
    spotPosition: [number, number, number]
    hasCookie: boolean
    castsShadow: boolean
    shadowMapSize: number
    shadowAutoUpdate: boolean
  } {
    const l = useLanternStore.getState()
    return { on: l.on, fuel: l.fuel, ...lanternLightRuntime, spotPosition: [...lanternLightRuntime.spotPosition] }
  },
  /** Spec 11 H4: the bats as the step sees them (phase, box and head yaw per bat, chitter clock). */
  batState(): {
    seededNight: number | null
    simTime: number
    lastChitter: number | null
    bats: {
      phase: string
      boxIndex: number
      t: number
      yaw: number
      restYaw: number
      previousBox: number | null
      /** The perch point (top face of the box), so a spec can aim the camera at the bat. */
      at: [number, number, number]
    }[]
    perched: number
  } {
    const s = useBatStore.getState()
    return {
      seededNight: s.seededNight,
      simTime: s.simTime,
      lastChitter: s.lastChitter,
      bats: s.entries.map((e) => ({
        phase: e.bat.phase,
        boxIndex: e.bat.boxIndex,
        t: e.bat.t,
        yaw: e.bat.yaw,
        restYaw: e.bat.restYaw,
        previousBox: e.bat.previousBox,
        at: [...batPerchPoint(e.bat.boxIndex)] as [number, number, number],
      })),
      perched: s.entries.filter((e) => e.bat.phase === 'perched').length,
    }
  },
  /** Spec 11 H2: the creatures as the step sees them (crawlers, the bride, hound packs, the seen set). */
  creatureState(): {
    seededNight: number | null
    simTime: number
    crawlers: { id: string; phase: string; x: number; z: number; wave: boolean }[]
    bride: { alive: boolean; x: number; z: number; returnIn: number; visible: boolean; dim: number; bend: number }
    packs: { id: string; size: number; hounds: { x: number; z: number }[] }[]
    seen: string[]
  } {
    const s = useCreatureStore.getState()
    return {
      seededNight: s.seededNight,
      simTime: s.simTime,
      crawlers: s.crawlers.map((e) => ({ id: e.id, phase: e.c.phase, x: e.c.x, z: e.c.z, wave: e.wave })),
      bride: {
        alive: s.bride.alive,
        x: s.bride.x,
        z: s.bride.z,
        returnIn: s.bride.returnIn,
        visible: s.brideVisible,
        dim: s.brideDim,
        bend: s.brideBend,
      },
      packs: s.packs.map((e) => ({
        id: e.id,
        size: e.pack.hounds.length,
        hounds: e.pack.hounds.map((h) => ({ x: h.x, z: h.z })),
      })),
      seen: [...s.seen],
    }
  },
  /** The Dev_Panel's "Spawn crawler ambush". */
  spawnCrawlerAmbush(): string {
    return spawnCrawlerAmbush()
  },
  /** The Dev_Panel's "Spawn bride". */
  spawnBride(): string {
    return spawnBrideDev()
  },
  /**
   * Spec 11 H2 (Req 2.4, 2.5, 2.10, 2.11): the attack the player's swing or shot makes, through the
   * same functions MeleeAttack and fireHeld call. Skips only the swing timing and the aim camera.
   */
  creatureAttack(
    mode: 'light' | 'heavy' | 'lead' | 'blessed' | 'sabre',
    damage = 15,
  ): { damage: number; miss: boolean; noEffect: boolean; killed: boolean }[] {
    const p = usePlayerStore.getState()
    const origin = { x: p.position[0], z: p.position[2] }
    const dir = forwardFromYaw(p.yaw)
    if (mode === 'light' || mode === 'heavy' || mode === 'sabre') {
      return meleeCreatures(origin, dir, damage, mode !== 'light', mode === 'sabre' ? 'silver-sabre' : 'other')
    }
    const r = shotCreatures(origin, dir, damage, mode === 'lead' ? 'lead' : 'blessed-rounds')
    return r ? [r] : []
  },
  /** Remaining HP of damaged creatures and the count of no-effect cues (lead on the bride). */
  creatureHp(): { hp: Record<string, number>; noEffectCount: number } {
    const s = useCreatureStore.getState()
    return { hp: { ...s.hp }, noEffectCount: s.noEffectCount }
  },
  /** The Dev_Panel's "Spawn hound pack". */
  spawnHoundPack(): string {
    return spawnHoundPack()
  },
  /** The Dev_Panel's "Teleport next to a bat". */
  teleportNextToBat(): string {
    return teleportNextToBat()
  },
  /** The Dev_Panel's "Fire a shot" (the firearmFired event the bats read). */
  fireShot(): string {
    return fireShot()
  },
  /** Spec 11 H1: the screen scare as the overlay sees it (active scare, cooldown clock, used moments). */
  screenScareState(): {
    active: {
      set: string
      image: string
      kind: string
      startSim: number
      subtitleOnly: boolean
      fx: { showImage: boolean; flash: boolean; dim: boolean }
    } | null
    lastStartSim: number | null
    used: string[]
    /** World brightness the dim effect applies now (1 = untouched). */
    brightness: number
  } {
    const s = useScreenScareStore.getState().scare
    const a = s.active
    return {
      active: a
        ? {
            set: a.set,
            image: a.image,
            kind: a.kind,
            startSim: a.startSim,
            subtitleOnly: a.fx.subtitleOnly,
            fx: { showImage: a.fx.showImage, flash: a.fx.flash, dim: a.fx.dim },
          }
        : null,
      brightness: screenScareRuntime.brightness,
      lastStartSim: s.lastStartSim,
      used: [...s.used],
    }
  },
  /** A normal (not forced) screen scare request, as a creature would make it: obeys the cooldown and open overlays. */
  requestScreenScare(kind: 'crawler' | 'bride'): string {
    return triggerScreenScare(kind)
  },
  /** The Dev_Panel's "Force screen scare" (skips the cooldown through the dev flag). */
  forceScreenScare(face: 'zombie' | 'ghost'): string {
    return forceScreenScare(face)
  },
  /** The Dev_Panel's "Reset vending stock" (the same action dawn runs). */
  resetVendingStock(): void {
    resetVendingStock()
  },
  /** Sets the Grave Coin balance through the real store action (for the hint price checks). */
  setCoins(n: number): void {
    useProgressionStore.getState().setCoins(n)
  },
  /** Puts all five relics in the satchel only (the rite panel places them; unlike "Give all relics"). */
  giveAllRelics(): void {
    RITE_ORDER.forEach(giveRelic)
  },
  /** JSON-safe copy of the rite altar: which relic stands in which place. */
  riteState(): unknown {
    return toSnapshot(useRiteStore.getState().rite)
  },
  /** JSON-safe copy of the accusation: chosen options and what the altar said. */
  accusationState(): unknown {
    return toSnapshot(useAccusationStore.getState())
  },
  /** Opens or closes the altar answer panel. */
  setAltarPanel(open: boolean): string {
    return setAltarPanel(open)
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
  body(): { feet: [number, number, number]; camera: [number, number, number]; yaw: number; pitch: number } | null {
    const { body, camera } = bodyRuntime
    if (!body || !camera) return null
    const t = body.translation()
    // The capsule centre is 0.85 m above the feet (see FirstPersonController).
    return {
      feet: [t.x, t.y - 0.85, t.z],
      camera: [camera.position.x, camera.position.y, camera.position.z],
      yaw: camera.rotation.y,
      // Positive looking up (the camera's own X rotation, Euler order YXZ).
      pitch: camera.rotation.x,
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
  /** Queues a scare by id for the stager (same telegraph then beat as a rolled one, minus the roll). */
  forceScare(id: ScareEventId): void {
    scareRuntime.forced.push(id)
  },
  /** Sets Scare intensity or Subtitles through the real store action. */
  setScareSetting(key: 'scareIntensity' | 'jumpscares' | 'subtitles', value: 'full' | 'reduced' | 'off' | boolean): void {
    useSettingsStore.getState().setSetting(key, value as never)
  },
  /** Scare effect values the scene reads: shake clock, lantern flicker, strobe flag and hand slow. */
  scareFx(): { shakeAge: number | null; flickerLeft: number; flickerStrobe: boolean; slowLeft: number } {
    return {
      shakeAge: Number.isFinite(scareRuntime.shakeAge) ? scareRuntime.shakeAge : null,
      flickerLeft: scareRuntime.flickerLeft,
      flickerStrobe: scareRuntime.flickerStrobe,
      slowLeft: scareRuntime.slowLeft,
    }
  },
  /**
   * Rapier colliders whose centre is within `radius` m of (x, z) on the ground plane, nearest
   * first, so a block can be attributed. Cuboids report half-extents; the owner is matched
   * against the layout data ('unknown' means a collider with no known source).
   */
  collidersNear(x: number, z: number, radius = 3): ColliderInfo[] {
    const world = bodyRuntime.world
    if (!world) return []
    const out: ColliderInfo[] = []
    world.colliders.forEach((c) => {
      const t = c.translation()
      const dist = Math.hypot(t.x - x, t.z - z)
      const s = c.shape as unknown as { halfExtents?: { x: number; y: number; z: number }; radius?: number; halfHeight?: number }
      // Big boxes (ground, fences, boundaries) reach the point from far away: use the box edge.
      const reach = s.halfExtents ? Math.max(s.halfExtents.x, s.halfExtents.z) : (s.radius ?? 0)
      if (dist - reach > radius) return
      const r = c.rotation()
      out.push({
        handle: c.handle,
        shape: ['ball', 'cuboid', 'capsule'][c.shapeType()] ?? String(c.shapeType()),
        halfExtents: s.halfExtents ? [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z] : null,
        radius: s.radius ?? null,
        translation: [t.x, t.y, t.z],
        rotationY: 2 * Math.atan2(r.y, r.w),
        sensor: c.isSensor(),
        owner: c.parent() === bodyRuntime.body ? 'player' : colliderOwner(t.x, t.z),
        distance: dist,
      })
    })
    return out.sort((a, b) => a.distance - b.distance)
  },
  /**
   * Bounds of a world model's vertices between two heights (model space, metres), measured from
   * the real GLB through the same Draco decoder the game uses.
   */
  async measureModel(id: WorldModelId, yMin = -1e9, yMax = 1e9): Promise<ModelSlice> {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
    const draco = new DRACOLoader().setDecoderPath(DRACO_PATH)
    const loader = new GLTFLoader().setDRACOLoader(draco)
    const gltf = await loader.loadAsync(worldModelUrl(id))
    gltf.scene.updateMatrixWorld(true)
    const box = new Box3()
    const v = new Vector3()
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const pos = m.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
        if (v.y >= yMin && v.y <= yMax) box.expandByPoint(v)
      }
    })
    draco.dispose()
    return {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    }
  },
  /** World centre of an interactable's meshes (what the crosshair has to hit), or null when it is not mounted. */
  interactableCentre(id: string): [number, number, number] | null {
    const entry = interactableRegistry.get(id)
    if (!entry) return null
    const box = new Box3()
    entry.object.updateWorldMatrix(true, true)
    entry.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) box.expandByObject(o)
    })
    if (box.isEmpty()) return null
    const c = box.getCenter(new Vector3())
    return [c.x, c.y, c.z]
  },
  /** Ids of mounted interactables whose id starts with `prefix` (all of them when empty). */
  interactableIds(prefix = ''): string[] {
    return [...interactableRegistry.keys()].filter((k) => k.startsWith(prefix))
  },
  /**
   * Live cue of one interactable (spec 09 task 11c): what the shared cue rule says, the cue fade
   * strength, the rune sprite's opacity and how many of its own meshes are still visible. Null
   * when it is not mounted.
   */
  interactableCue(id: string): {
    targetable: boolean
    actionable: boolean
    prompt: string | null
    pulse: boolean
    fading: boolean
    alpha: number
    runeOpacity: number
    bodyMeshes: number
  } | null {
    const entry = interactableRegistry.get(id)
    if (!entry) return null
    const cue = entry.cue()
    let runeOpacity = 0
    let bodyMeshes = 0
    entry.object.traverseVisible((o) => {
      const sprite = o as THREE.Sprite
      if (sprite.isSprite) {
        runeOpacity = Math.max(runeOpacity, (sprite.material as THREE.SpriteMaterial).opacity)
        return
      }
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (mats.some((m) => m.visible && m.opacity > 0.01)) bodyMeshes++
    })
    return {
      targetable: cue.targetable,
      actionable: cue.actionable,
      prompt: cue.prompt,
      pulse: cue.pulse,
      fading: cue.fade !== null,
      alpha: (entry.object.userData.cueAlpha as number | undefined) ?? 1,
      runeOpacity,
      bodyMeshes,
    }
  },
  /** Mesh count under the named scene group (-1 when no such group is mounted). */
  /** Whether the named object and all its parents are visible; null when no object has the name. */
  objectVisible(name: string): boolean | null {
    const o: THREE.Object3D | undefined = bodyRuntime.scene?.getObjectByName(name)
    if (!o) return null
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
    return true
  },
  /**
   * What the camera draws now: every visible mesh inside the view frustum, grouped by its nearest
   * named ancestor, with how many of them also cast shadows (drawn again per shadow pass). For the
   * draw-call budget (spec 09 task 11n-e); dev only.
   */
  drawCensus(): { total: number; shadowCasters: number; groups: { name: string; meshes: number; casters: number }[] } | null {
    const root = bodyRuntime.scene
    const camera = bodyRuntime.camera
    if (!root || !camera) return null
    camera.updateMatrixWorld()
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    )
    const seen = (o: THREE.Object3D): boolean => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
      return true
    }
    const groups = new Map<string, { meshes: number; casters: number }>()
    let total = 0
    let shadowCasters = 0
    root.updateMatrixWorld()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !seen(m)) return
      if (m.frustumCulled && m.geometry) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
        const s = m.geometry.boundingSphere!.clone().applyMatrix4(m.matrixWorld)
        if (!frustum.intersectsSphere(s)) return
      }
      let owner = '(unnamed)'
      for (let p: THREE.Object3D | null = m.parent; p; p = p.parent) {
        if (p.name && p.name !== 'Scene') {
          owner = p.name
          break
        }
      }
      const g = groups.get(owner) ?? { meshes: 0, casters: 0 }
      g.meshes++
      if (m.castShadow) g.casters++
      groups.set(owner, g)
      total++
      if (m.castShadow) shadowCasters++
    })
    return {
      total,
      shadowCasters,
      groups: [...groups].map(([name, g]) => ({ name, ...g })).sort((a, b) => b.meshes - a.meshes),
    }
  },
  /**
   * Lights in the scene: every light, those that cast shadows (budget: 4), and those that are
   * visible with intensity above 0. For the D8 performance pass; dev only.
   */
  lightCensus(): { total: number; shadowCasting: number; lit: number } | null {
    const root = bodyRuntime.scene
    if (!root) return null
    let total = 0
    let shadowCasting = 0
    let lit = 0
    root.traverse((o) => {
      const l = o as THREE.Light
      if (!l.isLight) return
      total++
      if (l.castShadow) shadowCasting++
      let vis = true
      for (let p: THREE.Object3D | null = l; p; p = p.parent) if (!p.visible) vis = false
      if (vis && l.intensity > 0) lit++
    })
    return { total, shadowCasting, lit }
  },
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
  /** Replaces what lies at a material spawn point with one stack of each item, so a spec can see any item. */
  setSpawnStacks(spawnId: string, items: readonly ItemId[], qty = 1): void {
    const s = useSpawnStore.getState()
    s.setWorld({
      ...s.world,
      materials: { ...s.world.materials, [spawnId]: items.map((item) => ({ item, qty })) },
    })
  },
  /** Uses the consumable in hand through the real action (Kola Tonic and Blessed Rounds apply their effect at once). */
  consumeHeld(): boolean {
    return consumeHeldItem().started
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
  /** Shows the boss bar for layout checks: a distant, held Father Crane and the 'risen' stage. */
  showBossBar(): void {
    const [crane] = api.spawnZombies([{ type: 'father-crane', x: 0, z: -70 }])
    api.holdZombies([crane], 600)
    const boss = useBossStore.getState()
    boss.setBoss({ ...boss.boss, stage: 'risen' })
  },
  /** Sets one boolean or numeric setting through the real store action (saved like in the Settings menu). */
  setSetting(
    key: 'showMinimap' | 'showPinsInWorld' | 'showControlHints' | 'plainJournalFont' | 'lowGraphics' | 'flashingLights' | 'cameraShake' | 'showInfoDots',
    value: boolean,
  ): void {
    useSettingsStore.getState().setSetting(key, value)
  },
  /** The angle (radians) the chapel bell mesh was last given, or null while the mesh is not found. */
  bellMeshAngle(): number | null {
    return bellRuntime.meshAngle
  },
  /** The map pins, whether the big map is open, and how many pin beacons are in the scene. */
  mapPins(): { pins: Array<{ slot: number; x: number; z: number; name: string }>; mapOpen: boolean; beacons: number } {
    const pins = usePinStore.getState().pins.map((p) => ({ ...p }))
    return { pins, mapOpen: useGameStore.getState().mapOpen, beacons: [1, 2, 3].filter((s) => api.meshesUnder(`pin-beacon-${s}`) > 0).length }
  },
  /** Places a pin through the real store action (the browser spec clicks the map for the main path). */
  placePin(x: number, z: number, name?: string): void {
    usePinStore.getState().place({ x, z, name })
  },
  /** Minimap redraw and loop-frame counts since page load (the redraw budget check reads these). */
  minimapStats(): { draws: number; frames: number } {
    return { draws: minimapRuntime.draws, frames: minimapRuntime.frames }
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
  /**
   * Cost of one useInteractionRaycast pass (array build plus recursive intersect) from the live
   * camera, averaged over `n` runs, in ms. Null when no rig is mounted.
   */
  raycastCostMs(n = 200): { meanMs: number; objects: number; meshes: number } | null {
    const cam = bodyRuntime.camera
    if (!cam) return null
    const rc = new Raycaster()
    rc.far = INTERACT_RANGE_M
    rc.setFromCamera(new Vector2(0, 0), cam)
    let meshes = 0
    for (const e of interactableRegistry.values())
      e.object.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++
      })
    const t0 = performance.now()
    for (let i = 0; i < n; i++) {
      const objects = [...interactableRegistry.values()].map((e) => e.object)
      rc.intersectObjects(objects, true)
    }
    return {
      meanMs: (performance.now() - t0) / n,
      objects: interactableRegistry.size,
      meshes,
    }
  },
  /** Longest frame in the last `windowMs` (default the whole rolling window), in ms. */
  longestFrameMs(windowMs?: number): number {
    return frames?.longest(windowMs) ?? 0
  },
  /**
   * Draw calls and triangles per loop frame over a number of frames (renderer.info with autoReset
   * off, so the shadow and post-processing passes are included). Null with no rig.
   */
  async renderInfo(frames = 30): Promise<{ calls: number; triangles: number } | null> {
    const gl = bodyRuntime.gl
    if (!gl) return null
    gl.info.autoReset = false
    gl.info.reset()
    const f0 = minimapRuntime.frames
    await new Promise<void>((resolve) => {
      let n = 0
      const step = () => (++n < frames ? requestAnimationFrame(step) : resolve())
      requestAnimationFrame(step)
    })
    const df = Math.max(1, minimapRuntime.frames - f0)
    const out = { calls: gl.info.render.calls / df, triangles: gl.info.render.triangles / df }
    gl.info.autoReset = true
    return out
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

export interface ColliderInfo {
  handle: number
  shape: string
  halfExtents: [number, number, number] | null
  radius: number | null
  translation: [number, number, number]
  rotationY: number
  sensor: boolean
  owner: string
  distance: number
}

export interface ModelSlice {
  min: [number, number, number]
  max: [number, number, number]
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

