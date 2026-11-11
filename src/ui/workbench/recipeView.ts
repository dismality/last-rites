// Pure view model for a recipe card (spec 09, B9): the recipe's name and each ingredient's name
// with a have/need count, so nothing on the card needs a hover to be understood. No DOM.

import { ITEM_MAP } from '../../data/items'
import { RECIPE_MAP } from '../../data/recipes'
import type { RecipeDef } from '../../data/recipes'
import { canCraft } from '../../game/systems/crafting'
import { mergeCollected } from '../../game/systems/recipeDiscovery'
import type { Inventory, ItemId, RecipeId } from '../../game/types'

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
  /** Check or cross, so owned and missing never rely on colour. */
  mark: '✓' | '✗'
  /** "need 2 more" when something is missing, else "have enough". */
  note: string
}

export interface RecipeCard {
  /** "Bone Club", or "Revolver Cartridges x6" for a recipe that makes several. */
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
    return {
      item,
      name: nameOf(item),
      need,
      have,
      lack,
      label: `${nameOf(item)} ${have}/${need}`,
      tool,
      mark: lack > 0 ? '✗' : '✓',
      note: lack > 0 ? `need ${lack} more` : 'have enough',
    }
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

/** Every item a recipe needs to be seen: its inputs plus the tool it upgrades. */
export function recipeItems(recipe: RecipeDef): ItemId[] {
  return [...recipe.inputs.map((i) => i.item), ...(recipe.consumesTool ? [recipe.consumesTool] : [])]
}

/** A recipe is discovered once the player has held at least one of each of its ingredients. */
export function isDiscovered(recipe: RecipeDef, collected: readonly ItemId[]): boolean {
  const set = new Set(collected)
  return recipeItems(recipe).every((i) => set.has(i))
}

/** The title a list row shows: the real name, or "???" until the recipe is discovered. */
export function displayTitle(recipe: RecipeDef, collected: readonly ItemId[], card: RecipeCard): string {
  return isDiscovered(recipe, collected) ? card.title : '???'
}

export interface PinCardView {
  recipeId: RecipeId
  title: string
  rows: IngredientRow[]
  craftable: boolean
}

/** The small HUD card for the pinned recipe; null when nothing is pinned or it is unknown. */
export function pinCardView(
  pinned: RecipeId | null,
  unlocked: readonly RecipeId[],
  inv: Inventory,
): PinCardView | null {
  if (pinned === null || !unlocked.includes(pinned)) return null
  const recipe = RECIPE_MAP[pinned]
  if (!recipe) return null
  const result = canCraft(inv, recipe)
  const card = recipeCard(recipe, result.missing)
  return { recipeId: pinned, title: card.title, rows: card.ingredients, craftable: result.ok }
}

/** The tooltip is only ever shown while the bench is open. */
export function tooltipTarget(benchOpen: boolean, hovered: RecipeId | null): RecipeId | null {
  return benchOpen ? hovered : null
}

export interface GhostView {
  /** 0 = washed-out outline, 1 = full colour and glow; follows the craft progress. */
  fill: number
  /** Owned ingredients are solid models, missing ones outlines. */
  rows: { item: ItemId; solid: boolean }[]
}

export function ghostView(card: RecipeCard, progress: number): GhostView {
  return {
    fill: Math.min(1, Math.max(0, progress)),
    rows: card.ingredients.map((i) => ({ item: i.item, solid: i.lack === 0 })),
  }
}

export { mergeCollected }
