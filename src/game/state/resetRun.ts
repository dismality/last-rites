// Puts every per-run store back to its starting state, so New Game does not inherit the last
// run (taken pickups, upgrades, durability, magazines, built doors, ...). No React / three.js.
//
// Three lists keep a new store from being forgotten (resetRun.test.ts enforces it: every zustand
// store exported from src/game/state must be in exactly one of them):
//   REPLACED_STORES  reset to getInitialState()
//   CUSTOM_RESETS    stores that need their own reset action
//   KEPT_STORES      not run state, with the reason

import { gasRuntime } from '../../scene/effects/gasRuntime'
import { graveBurstRuntime } from '../../scene/effects/graveBurstRuntime'
import { meleeRuntime } from '../../scene/player/meleeRuntime'
import { resetWeaponRuntime } from '../../scene/player/weaponRuntime'
import { resetScareRuntime } from '../../scene/scares/scareRuntime'
import { useAchievementStore } from './achievementStore'
import { useBossStore } from './bossStore'
import { useChapelStore } from './chapelStore'
import { useCoinStore } from './coinStore'
import { resetCombatTickRuntime } from './combatTick'
import { useCombatStore } from './combatStore'
import { useCraftingStore } from './craftingStore'
import { useDigStore } from './digStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useExamineStore } from './examineStore'
import { useFeedbackStore } from './feedbackStore'
import { useGameStore } from './gameStore'
import { useGuidanceStore } from './guidanceStore'
import { useInteractionStore } from './interactionStore'
import { useIntroStore } from './introStore'
import { useInventoryStore } from './inventoryStore'
import { useItemNameStore } from './itemNameStore'
import { useLanternStore } from './lanternStore'
import { useMapStore } from './mapStore'
import { useMysteryStore } from './mysteryStore'
import { clearNightState } from './nightState'
import { useOverlayStore } from './overlayStore'
import { takePlayerPush } from './playerPush'
import { usePinStore } from './pinStore'
import { usePlayerStore } from './playerStore'
import { queueTeleportToStore } from './playerTeleport'
import { resetProgressionEventsRuntime } from './progressionEvents'
import { useProgressionStore } from './progressionStore'
import { useProjectileStore } from './projectileStore'
import { useScoreStore } from './scoreStore'
import { useSettingsStore } from './settingsStore'
import { useSpawnStore } from './spawnStore'
import { resetStaminaRuntime } from './staminaRuntime'
import { useToastStore } from './toastStore'
import { useTombstoneStore } from './tombstoneStore'
import { useUiWorldStore } from './uiWorldStore'
import { useStageStore } from './stageStore'
import { useCaseStore } from './caseStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

interface Resettable {
  getInitialState: () => object
  setState: (state: never, replace: true) => void
}

/** Replaced wholesale with their initial state. */
export const REPLACED_STORES = [
  useInventoryStore,
  useCraftingStore,
  useChapelStore,
  useWorldStore,
  usePlayerStore,
  useLanternStore,
  useMapStore,
  usePinStore,
  useSpawnStore,
  useUiWorldStore,
  useMysteryStore,
  useWaveStore,
  useStageStore,
  useCaseStore,
  useEnemyStore,
  useProjectileStore,
  useCombatStore,
  useDoorStore,
  useBossStore,
  useEffectStore,
  useFeedbackStore,
  useInteractionStore,
  useExamineStore,
  useTombstoneStore,
  useToastStore,
  useItemNameStore,
] as unknown as readonly Resettable[]

/** Stores with their own reset (they bump counters, clear storage or keep persistent parts). */
export const CUSTOM_RESETS: ReadonlyArray<readonly [object, () => void]> = [
  [useProgressionStore, () => useProgressionStore.getState().reset()],
  [useScoreStore, () => useScoreStore.getState().resetNight()],
  [useCoinStore, () => useCoinStore.getState().clear()],
  [useDigStore, () => useDigStore.getState().reset()],
  [useGuidanceStore, () => useGuidanceStore.getState().reset()],
  [useEndingStore, () => useEndingStore.getState().reset()], // also bumps runId
]

/** Not run state. Each needs a reason. */
export const KEPT_STORES: ReadonlyArray<readonly [object, string]> = [
  [useSettingsStore, 'player preferences, persisted in localStorage'],
  [useAchievementStore, 'persisted in localStorage; only its session toasts are cleared'],
  [useGameStore, 'screen routing; resetRun only clears its per-run flags'],
  [useIntroStore, 'newGame() calls begin() itself; `seen` outlives a run'],
  [useOverlayStore, 'menu shell flags (mode select is open while startRun runs)'],
]

export function resetRun(): void {
  for (const store of REPLACED_STORES) store.setState(store.getInitialState() as never, true)
  // The map store's initial state was read from localStorage at load; forget it for real.
  useMapStore.getState().reset()
  for (const [, reset] of CUSTOM_RESETS) reset()
  // Weather, music, enemies, projectiles and the live combat timers.
  clearNightState()
  // Achievements and the Endless best are not run state, so only the toasts are cleared.
  useAchievementStore.getState().resetSession()
  useGameStore.setState({ paused: false, taken: false, examining: false, journalOpen: false, mapOpen: false, satchelOpen: false })

  // Module-level runtimes.
  resetCombatTickRuntime()
  resetStaminaRuntime()
  resetScareRuntime()
  resetWeaponRuntime()
  resetProgressionEventsRuntime()
  takePlayerPush()
  queueTeleportToStore() // a mounted body from the previous run goes back to the start
  meleeRuntime.shakeAge = Infinity
  meleeRuntime.dustQueue.length = 0
  gasRuntime.queue.length = 0
  graveBurstRuntime.queue.length = 0
}
