// Pure view model for a recipe card (spec 09, B9): the recipe's name and each ingredient's name
// with a have/need count, so nothing on the card needs a hover to be understood. No DOM.

import { ITEM_MAP } from '../../data/items'
import type { RecipeDef } from '../../data/recipes'
import type { ItemId } from '../../game/types'

export interface IngredientRow {
  item: ItemId
  name: string
  need: number
  have: number
  /** How many are still missing; 0 when the player has enough. */
  lack: number
  /** "Bone 1/3": readable without colour. */
  label: string
  tool: boolean
}

export interface RecipeCard {
  /** "Bone Club", or "Revolver Cartridges ×6" for a recipe that makes several. */
  title: string
  ingredients: IngredientRow[]
}

const nameOf = (id: ItemId): string => ITEM_MAP[id]?.name ?? id

export function recipeCard(
  recipe: RecipeDef,
  missing: readonly { item: ItemId; qty: number }[],
): RecipeCard {
  const lackOf = new Map(missing.map((m) => [m.item, m.qty]))
  const row = (item: ItemId, need: number, tool: boolean): IngredientRow => {
    const lack = Math.min(need, Math.max(0, lackOf.get(item) ?? 0))
    const have = need - lack
    return { item, name: nameOf(item), need, have, lack, label: `${nameOf(item)} ${have}/${need}`, tool }
  }
  const out = nameOf(recipe.output.item)
  return {
    title: recipe.output.qty > 1 ? `${out} \u00d7${recipe.output.qty}` : out,
    ingredients: [
      ...recipe.inputs.map((i) => row(i.item, i.qty, false)),
      ...(recipe.consumesTool ? [row(recipe.consumesTool, 1, true)] : []),
    ],
  }
}
