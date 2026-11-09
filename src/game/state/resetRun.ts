// Puts every per-run store back to its starting state, so New Game after an ending
// does not inherit the last run. Settings are kept. No React / three.js.

import { useAchievementStore } from './achievementStore'
import { useChapelStore } from './chapelStore'
import { useCoinStore } from './coinStore'
import { useCraftingStore } from './craftingStore'
import { useEndingStore } from './endingStore'
import { useDigStore } from './digStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { useGuidanceStore } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useLanternStore } from './lanternStore'
import { useMapStore } from './mapStore'
import { useMysteryStore } from './mysteryStore'
import { clearNightState } from './nightState'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { useProjectileStore } from './projectileStore'
import { useScoreStore } from './scoreStore'
import { useSpawnStore } from './spawnStore'
import { stormRuntime } from './stormRuntime'
import { useUiWorldStore } from './uiWorldStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

interface Resettable {
  getInitialState: () => object
  setState: (state: never, replace: true) => void
}

const RUN_STORES: readonly Resettable[] = [
  useInventoryStore,
  useCraftingStore,
  useChapelStore,
  useWorldStore,
  usePlayerStore,
  useLanternStore,
  useMapStore,
  useSpawnStore,
  useUiWorldStore,
  useMysteryStore,
  useWaveStore,
  useEnemyStore,
  useProjectileStore,
] as unknown as readonly Resettable[]

export function resetRun(): void {
  for (const store of RUN_STORES) store.setState(store.getInitialState() as never, true)
  clearNightState()
  // Progression, score, coins and storm start over. Achievements and the Endless best are not
  // run state: they live in localStorage and outlive New Game, so only the toasts are cleared.
  useProgressionStore.getState().reset()
  useScoreStore.getState().resetNight()
  useCoinStore.getState().clear()
  stormRuntime.reset()
  useAchievementStore.getState().resetSession()
  useDigStore.getState().reset()
  useGuidanceStore.getState().reset()
  useEndingStore.getState().reset() // also bumps runId
  useGameStore.setState({ paused: false, taken: false, examining: false, journalOpen: false, satchelOpen: false })
}
