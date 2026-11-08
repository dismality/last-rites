// Persistent save/continue glue: reads the stores, writes localStorage['lastrites:save'].
// Pure rules live in systems/saveGame.ts. No React / three.js.

import { subscribeToType } from '../events'
import { hasValidSave, readSave, writeSave } from '../systems/saveGame'
import type { SaveState } from '../systems/saveGame'
import type { RecipeId } from '../types'
import { useChapelStore } from './chapelStore'
import { useCraftingStore } from './craftingStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { usePlayerStore } from './playerStore'
import { useUiWorldStore } from './uiWorldStore'
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

export function captureSave(): SaveState {
  return {
    world: pickWorld(),
    player: pickPlayer(),
    inventory: useInventoryStore.getState().inventory,
    mystery: useMysteryStore.getState().mystery,
    chapel: useChapelStore.getState().chapel,
    recipes: [...useCraftingStore.getState().unlockedRecipes],
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
  useInventoryStore.getState().setInventory(save.inventory)
  useMysteryStore.setState({ mystery: save.mystery })
  useChapelStore.setState({ chapel: save.chapel })
  useCraftingStore.setState({ unlockedRecipes: save.recipes as RecipeId[] })
  return true
}

/** Autosave when a new day starts (dawn ends). Altar saves call saveGame() directly. */
export function installNewDaySave(): () => void {
  return subscribeToType('phaseChanged', (e) => {
    if (e.phase === 'day') saveGame()
  })
}
