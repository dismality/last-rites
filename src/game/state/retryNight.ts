// Dusk snapshot save/restore and player damage entry point.
// Wires the pure rules in systems/ to the zustand stores. No React / three.js.

import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { emit, subscribeToType } from '../events'
import { loadSnapshot, pickData, saveSnapshot, type SnapshotData } from '../systems/duskSnapshot'
import { damagePlayer } from '../systems/playerHealth'
import { useChapelStore } from './chapelStore'
import { useCraftingStore } from './craftingStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'
import { useMapStore } from './mapStore'
import { usePlayerStore } from './playerStore'
import { useSpawnStore } from './spawnStore'
import { useUiWorldStore } from './uiWorldStore'
import { useWorldStore } from './worldStore'

interface Snapshotable {
  getState: () => object
  setState: (partial: never) => void
}

/** Every store except settings. Transient crafting UI state is omitted. */
const SNAPSHOT_STORES: Record<string, { store: Snapshotable; omit?: readonly string[] }> = {
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

/** Call at the start of dusk. Returns false if storage failed (Retry then keeps current inventory). */
export function saveDuskSnapshot(): boolean {
  const data: SnapshotData = {}
  for (const [name, { store, omit }] of Object.entries(SNAPSHOT_STORES)) {
    data[name] = pickData(store.getState(), omit)
  }
  return saveSnapshot(storage(), data)
}

/** Save a snapshot whenever dusk begins. Returns the unsubscribe function. */
export function installDuskSnapshot(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase === 'dusk') saveDuskSnapshot()
  })
}

/** Back to the start of that dusk. Falls back to current inventory if no snapshot exists. */
export function retryNight(): void {
  const snap = loadSnapshot(storage())
  if (snap) {
    for (const [name, { store }] of Object.entries(SNAPSHOT_STORES)) {
      const part = snap[name]
      if (part) store.setState(part as never)
    }
    useCraftingStore.getState().clearHighlight()
    useCraftingStore.setState({ craftingProgress: null })
  } else {
    usePlayerStore.getState().setHealth(PLAYER_MAX_HEALTH)
    useUiWorldStore.setState({ playerHealth: PLAYER_MAX_HEALTH })
    useWorldStore.getState().applyWorldState({ phase: 'dusk', phaseTime: 0, wavesCleared: false })
  }
  useGameStore.getState().setTaken(false)
  useGameStore.getState().setPaused(false)
}

/** Apply one hit to the player. Shows the "You were taken" screen on death. */
export function hurtPlayer(dmg: number, blocking: boolean): void {
  const player = usePlayerStore.getState()
  const res = damagePlayer(player.health, dmg, blocking)
  if (res.dealt <= 0) return
  player.setHealth(res.health)
  useUiWorldStore.setState({ playerHealth: res.health })
  useUiWorldStore.getState().registerHit()
  emit({ type: 'playerDamaged', amount: res.dealt })
  if (res.died) useGameStore.getState().setTaken(true)
}
