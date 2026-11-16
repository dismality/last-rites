// Tiered crafting context (spec 10 task 10): tiers are on in the Story modes and off in Endless,
// and Tier 3 blueprints read the clues found across the cases. The rules are pure in
// systems/tieredCrafting.ts; this only reads the stores.

import type { RecipeDef } from '../../data/recipes'
import { canCraftTiered, effectiveRecipe, type TieredCheck } from '../systems/tieredCrafting'
import type { Inventory } from '../types'
import { useCaseStore } from './caseStore'
import { isStoryRun } from './guidanceStore'

/**
 * Tiers are on in Story modes; Endless keeps the flat recipes (Req 27.5). Read through the
 * guidance store's story probe: importing progressionStore here would close an import cycle.
 */
export function tiersOn(): boolean {
  return isStoryRun()
}

/** Every clue found in every case so far. */
export function foundClues(): string[] {
  return Object.values(useCaseStore.getState().cases).flatMap((p) => p.found)
}

/** The live tiered check for one recipe. */
export function checkCraft(inv: Inventory, recipe: RecipeDef): TieredCheck {
  return canCraftTiered(inv, recipe, tiersOn(), foundClues())
}

/** The recipe as it crafts right now. */
export function craftingRecipe(recipe: RecipeDef): RecipeDef {
  return effectiveRecipe(recipe, tiersOn())
}
