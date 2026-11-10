// Dusk snapshot save/restore and player damage entry point.
// Wires the pure rules in systems/ to the zustand stores. No React / three.js.

import { DUSK_SNAPSHOT_KEY, MORNING_SNAPSHOT_KEY } from '../../data/balance'
import { MODES } from '../../data/modes'
import type { ProgressionSave } from '../systems/progressionSave'
import { syncDerivedStats } from './derivedStats'
import { captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { useProgressionStore } from './progressionStore'
import { emit, subscribeToType } from '../events'
import {
  clearSnapshot,
  loadSnapshot,
  pickData,
  saveSnapshot,
  type SnapshotData,
} from '../systems/duskSnapshot'
import { retryLoadout } from '../systems/retryLoadout'
import { isInvulnerable } from '../systems/dodge'
import { damagePlayer } from '../systems/playerHealth'
import { useChapelStore } from './chapelStore'
import { COMBAT_PERSISTED } from './combatPersistence'
import { useCombatStore } from './combatStore'
import { getDevCheats } from './devCheats'
import { useDoorStore } from './doorStore'
import { useMysteryStore } from './mysteryStore'
import { useProjectileStore } from './projectileStore'
import { useCraftingStore } from './craftingStore'
import { useDigStore } from './digStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { settleEndlessDeath } from './startEnding'
import { useGuidanceStore } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'
import { useMapStore } from './mapStore'
import { clearNightState } from './nightState'
import { usePlayerStore } from './playerStore'
import { queueTeleportToStore } from './playerTeleport'
import { useSpawnStore } from './spawnStore'
import { useUiWorldStore } from './uiWorldStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

interface Snapshotable {
  getState: () => object
  setState: (partial: never) => void
}

/** A view of a store limited to the listed data fields (live timers are never snapshotted). */
function fieldsOf(
  store: { getState: () => object; setState: (partial: never) => void },
  keys: readonly string[],
): Snapshotable {
  return {
    getState: () =>
      Object.fromEntries(Object.entries(store.getState()).filter(([k]) => keys.includes(k))),
    setState: (partial) => store.setState(partial),
  }
}

/**
 * Adapter for the one mystery field the snapshot needs. `pickData` cannot snapshot the
 * mystery state's nested Sets, so only the rite progress number goes through (Req 20.4).
 */
export const riteProgress: Snapshotable = {
  getState: () => ({ riteProgress: useMysteryStore.getState().mystery.riteProgress }),
  setState: (partial) => {
    const { riteProgress: value } = partial as { riteProgress?: unknown }
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, riteProgress: value } }))
  },
}

/** Progression goes through its own capture/restore so Retry and Save share one field list. */
export const progressionSnapshot: Snapshotable = {
  getState: () => captureProgressionSave(),
  setState: (partial) => restoreProgressionSave(partial as unknown as ProgressionSave),
}

/** Every store except settings. Transient crafting UI state is omitted. */
export const SNAPSHOT_STORES: Record<string, { store: Snapshotable; omit?: readonly string[] }> = {
  // Built from COMBAT_PERSISTED so a field the Save keeps cannot be forgotten here (Req 20.3).
  combat: { store: fieldsOf(useCombatStore, COMBAT_PERSISTED.combat) },
  doors: { store: fieldsOf(useDoorStore, COMBAT_PERSISTED.doors) },
  riteProgress: { store: riteProgress },
  progression: { store: progressionSnapshot },
  inventory: { store: useInventoryStore as unknown as Snapshotable },
  crafting: { store: useCraftingStore as unknown as Snapshotable, omit: ['craftingProgress'] },
  chapel: { store: useChapelStore as unknown as Snapshotable },
  world: { store: useWorldStore as unknown as Snapshotable },
  player: { store: usePlayerStore as unknown as Snapshotable },
  lantern: { store: useLanternStore as unknown as Snapshotable },
  map: { store: useMapStore as unknown as Snapshotable },
  spawn: { store: useSpawnStore as unknown as Snapshotable },
  uiWorld: {
    store: useUiWorldStore as unknown as Snapshotable,
    omit: ['workbenchOpen', 'chapelRepairOpen', 'lastDamageAt'],
  },
}

function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

function captureSnapshot(key: string): boolean {
  const data: SnapshotData = {}
  for (const [name, { store, omit }] of Object.entries(SNAPSHOT_STORES)) {
    data[name] = pickData(store.getState(), omit)
  }
  return saveSnapshot(storage(), data, key)
}

/** Call at the start of dusk. Returns false if storage failed (Retry then keeps current inventory). */
export function saveDuskSnapshot(): boolean {
  return captureSnapshot(DUSK_SNAPSHOT_KEY)
}

/** Call at the start of a day. Returns false if storage failed. */
export function saveMorningSnapshot(): boolean {
  return captureSnapshot(MORNING_SNAPSHOT_KEY)
}

/** Drops the morning snapshot, so one from an earlier run or day can never be restored. */
export function clearMorningSnapshot(): void {
  clearSnapshot(storage(), MORNING_SNAPSHOT_KEY)
}

/** Drives the "Retry from morning" button. */
export function hasMorningSnapshot(): boolean {
  return loadSnapshot(storage(), MORNING_SNAPSHOT_KEY) !== null
}

/** Save a snapshot whenever dusk begins. Returns the unsubscribe function. */
export function installDuskSnapshot(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase === 'dusk') saveDuskSnapshot()
  })
}

/**
 * Save a snapshot whenever a day begins. Install after the progression watchers, so the
 * snapshot holds the day's dealt stock and storm (the same rule as the new-day save).
 */
export function installMorningSnapshot(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase === 'day') saveMorningSnapshot()
  })
}

/** Back to the start of that dusk. Falls back to current inventory if no snapshot exists. */
export function retryNight(): void {
  // Always the start of dusk, whatever phaseTime the snapshot caught: the full 30 s (Req 20.5).
  restoreRetry(DUSK_SNAPSHOT_KEY, { phase: 'dusk', phaseTime: 0, wavesCleared: false })
}

/** Back to the start of that day. Does nothing without a morning snapshot. */
export function retryFromMorning(): void {
  if (!hasMorningSnapshot()) return
  restoreRetry(MORNING_SNAPSHOT_KEY, { phase: 'day', phaseTime: 0, wavesCleared: false })
}

function restoreRetry(
  key: string,
  world: { phase: 'day' | 'dusk'; phaseTime: number; wavesCleared: boolean },
): void {
  // Endless has no second chance: death ends the run (Req 11.14).
  if (!MODES[useProgressionStore.getState().mode].retryNight) return
  const snap = loadSnapshot(storage(), key)
  if (snap) {
    for (const [name, { store }] of Object.entries(SNAPSHOT_STORES)) {
      const part = snap[name]
      if (part) store.setState(part as never)
    }
    useCraftingStore.getState().clearHighlight()
    useCraftingStore.setState({ craftingProgress: null })
  } else {
    useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, riteProgress: 0 } }))
  }
  // Max HP derives from the restored ranks; the player store snapshot may hold another value.
  syncDerivedStats()
  // A fair start on every path (spec 09, B2): full health and at least RETRY_MIN_FUEL oil, so a
  // low-oil dusk cannot turn into a death loop.
  const loadout = retryLoadout(useLanternStore.getState().fuel, usePlayerStore.getState().maxHealth)
  usePlayerStore.getState().setHealth(loadout.health)
  useUiWorldStore.setState({ playerHealth: loadout.health })
  useLanternStore.getState().setFuel(loadout.fuel)
  useWorldStore.getState().applyWorldState(world)
  // Every path, snapshot or fallback, ends with an empty night (Req 20.2, 20.6).
  clearNightState()
  useProjectileStore.getState().reset()
  // Neither store is in the snapshot: without this, the zombies and wave progress from the
  // failed night would still be alive during the replayed dusk.
  useEnemyStore.getState().setEnemies([])
  useDigStore.getState().reset()
  useWaveStore.getState().reset()
  // Fallback path keeps the death position; the snapshot path restores the dusk one. Either
  // way the body must follow the store, or the controller writes the old spot back.
  if (snap) queueTeleportToStore()
  useGameStore.getState().setTaken(false)
  useGameStore.getState().setPaused(false)
  // Night-only HUD state restarts: the health bar re-initialises on the new epoch (no drain
  // animation) and a zone card from the failed night must not linger. tutorialDone and
  // introSeen are deliberately left alone: guidanceStore is not in SNAPSHOT_STORES.
  useGameStore.setState((s) => ({ retryEpoch: s.retryEpoch + 1 }))
  useGuidanceStore.setState({ card: null })
}

/** Who dealt the hit. A Brute blow cancels a reload in progress (Req 4.5). */
export type HurtSource = 'zombie' | 'brute' | 'burst' | 'toll' | 'swing' | 'scare'

/**
 * Apply one hit to the player. Shows the "You were taken" screen on death.
 * Returns true when damage was applied; false while taken or during a dodge's
 * invulnerable window, which covers blows, the Bloater burst and the Toll (Req 9.5, 17.9).
 */
export function hurtPlayer(dmg: number, blocking: boolean, source?: HurtSource): boolean {
  if (useGameStore.getState().taken) return false
  if (isInvulnerable(useCombatStore.getState().live.dodge)) return false
  // Dev panel god mode; the flag is false unless src/dev/ sets it.
  if (getDevCheats().god) return false
  const player = usePlayerStore.getState()
  // A raised melee guard turns aside blows, not gas or the Toll's shockwave (Req 5.3).
  const guards =
    source === undefined ||
    source === 'zombie' ||
    source === 'brute' ||
    source === 'swing' ||
    source === 'scare'
  const res = damagePlayer(
    player.health,
    dmg,
    blocking || (guards && useCombatStore.getState().live.blocking),
  )
  if (res.dealt <= 0) return false
  player.setHealth(res.health)
  useUiWorldStore.setState({ playerHealth: res.health })
  useUiWorldStore.getState().registerHit()
  if (source === 'brute' && useCombatStore.getState().live.reload) {
    useCombatStore.getState().patchLive({ reload: null })
  }
  emit({ type: 'playerDamaged', amount: res.dealt })
  if (res.died) {
    // Nothing from the failed night may carry into the retry (Req 12.8, 20.2).
    clearNightState()
    settleEndlessDeath()
    useGameStore.getState().setTaken(true)
  }
  return true
}
