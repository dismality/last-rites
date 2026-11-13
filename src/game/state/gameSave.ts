// Persistent save/continue glue: reads the stores, writes localStorage['lastrites:save'].
// Pure rules live in systems/saveGame.ts. No React / three.js.

import { subscribeToType } from '../events'
import { sanitizeCombat } from '../systems/combatSave'
import { sanitizeProgression } from '../systems/progressionSave'
import { hasValidSave, readSave, writeSave } from '../systems/saveGame'
import { serializeTutorial } from '../systems/tutorial'
import type { SaveState } from '../systems/saveGame'
import type { StageSave } from '../systems/stageSave'
import type { RecipeId } from '../types'
import { useChapelStore } from './chapelStore'
import { captureCombatSave } from './combatPersistence'
import type { DoorsSave } from './combatPersistence'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useCraftingStore } from './craftingStore'
import { syncDerivedStats } from './derivedStats'
import { captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { useGuidanceStore } from './guidanceStore'
import { useInventoryStore } from './inventoryStore'
import { useIntroStore } from './introStore'
import { useMysteryStore } from './mysteryStore'
import { capturePins, usePinStore } from './pinStore'
import { usePlayerStore } from './playerStore'
import { queueTeleportToStore } from './playerTeleport'
import { useUiWorldStore } from './uiWorldStore'
import { useStageStore, STAGE_PERSISTED } from './stageStore'
import { useWorldStore } from './worldStore'

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function pickPlayer(): SaveState['player'] {
  const { position, yaw, pitch, stamina, interactTarget } = usePlayerStore.getState()
  // The altar heals uiWorldStore.playerHealth only, so that is the up-to-date value.
  const health = useUiWorldStore.getState().playerHealth
  return { position: [...position], yaw, pitch, health, stamina, interactTarget }
}

function pickWorld(): SaveState['world'] {
  const { phase, phaseTime, nightNumber, fogDensity, wavesCleared } = useWorldStore.getState()
  return { phase, phaseTime, nightNumber, fogDensity, wavesCleared }
}

function pickStage(): StageSave {
  const s = useStageStore.getState()
  return Object.fromEntries(STAGE_PERSISTED.map((k) => [k, s[k]])) as unknown as StageSave
}

function pickDoors(): DoorsSave {
  const { built, doors } = useDoorStore.getState()
  return { built, front: [...doors.front], vestry: [...doors.vestry] }
}

export function captureSave(): SaveState {
  return {
    world: pickWorld(),
    player: pickPlayer(),
    inventory: useInventoryStore.getState().inventory,
    mystery: useMysteryStore.getState().mystery,
    chapel: useChapelStore.getState().chapel,
    recipes: [...useCraftingStore.getState().unlockedRecipes],
    // Zone last-shown times and the zone clock are deliberately not saved.
    tutorial: useGuidanceStore.getState().tutorialDone,
    introSeen: useIntroStore.getState().seen,
    combat: captureCombatSave(pickDoors()),
    progression: captureProgressionSave(),
    stage: pickStage(),
    pins: capturePins(),
  }
}

/** Returns false if storage is unavailable; the game carries on unsaved. */
export function saveGame(): boolean {
  return writeSave(storage(), captureSave())
}

/** Drives the Continue button: false for a missing or corrupt save. */
export function canContinue(): boolean {
  return hasValidSave(storage())
}

/** Restores the latest save into the stores. Returns false (touching nothing) if there is none. */
export function loadGame(): boolean {
  const save = readSave(storage())
  if (!save) return false
  useWorldStore.getState().applyWorldState(save.world)
  usePlayerStore.getState().applyPlayerState(save.player) // includes health
  useUiWorldStore.setState({ playerHealth: save.player.health })
  queueTeleportToStore() // the body must move too, or the controller overwrites the store
  useInventoryStore.getState().setInventory(save.inventory)
  useMysteryStore.setState({ mystery: save.mystery })
  useChapelStore.setState({ chapel: save.chapel })
  useCraftingStore.setState({ unlockedRecipes: save.recipes as RecipeId[] })
  useGuidanceStore.getState().restore(serializeTutorial(save.tutorial ?? new Set()))
  useIntroStore.getState().setSeen(save.introSeen ?? false)
  const combat = sanitizeCombat(save.combat, { inventory: save.inventory, chapel: save.chapel })
  const { built, front, vestry } = combat.doors
  useDoorStore.setState({ built, doors: { front, vestry }, nail: null })
  useCombatStore.setState({
    firearms: combat.firearms,
    durability: combat.durability,
    upgrades: combat.upgrades,
    takenPickups: combat.takenPickups,
  })
  useCombatStore.getState().resetLive()
  restoreProgressionSave(
    sanitizeProgression(save.progression, {
      inventory: save.inventory,
      takenPickups: combat.takenPickups,
    }),
  )
  // After the world: moving the night number starts a fresh stage, and the save's block wins.
  if (save.stage) useStageStore.setState(save.stage)
  usePinStore.setState({ pins: save.pins ?? [] })
  syncDerivedStats()
  return true
}

/** Autosave when a new day starts (dawn ends). Altar saves call saveGame() directly. */
export function installNewDaySave(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase === 'day') saveGame()
  })
}
