// Tiered crafting (spec 10 task 10, Req 27). Pure. With tiers on (Story modes) a recipe's tiered
// inputs replace its flat ones, a Tier 3 recipe also needs its blueprint (2 clues found), and the
// component recipes exist; with tiers off (Endless) the flat recipes of spec 03 stand (Req 27.5).

import { BLUEPRINTS, type BlueprintId } from '../../data/blueprints'
import { ITEM_MAP } from '../../data/items'
import { RECIPES, type RecipeDef, type RecipeTier } from '../../data/recipes'
import { WEAPON_MAP } from '../../data/weapons'
import type { CraftedItemId, Inventory, ItemId } from '../types'
import { canCraft, type CanCraftResult } from './crafting'

/** The recipe as it crafts: tiered inputs with tiers on, else the flat recipe unchanged. */
export function effectiveRecipe(recipe: RecipeDef, tiersOn: boolean): RecipeDef {
  if (!tiersOn || recipe.tiered === undefined) return recipe
  return { ...recipe, inputs: recipe.tiered.inputs }
}

/** The recipes in the book: component recipes only with tiers on. */
export function bookRecipes(tiersOn: boolean): RecipeDef[] {
  return RECIPES.filter((r) => tiersOn || !r.tieredOnly).map((r) => effectiveRecipe(r, tiersOn))
}

export interface BlueprintStatus {
  id: BlueprintId
  name: string
  /** Clues of the two found so far. */
  have: number
  need: number
  ready: boolean
}

/** How far a blueprint is pieced together from the clues found. */
export function blueprintStatus(id: BlueprintId, found: readonly string[]): BlueprintStatus {
  const def = BLUEPRINTS[id]
  const have = def.clues.filter((c) => found.includes(c)).length
  return { id, name: def.name, have, need: def.clues.length, ready: have === def.clues.length }
}

export interface TieredCheck extends CanCraftResult {
  /** Missing crafted components, by name: "Iron Head" (Req 27.4). */
  missingComponents: ItemId[]
  /** The Tier 3 blueprint and how far it is pieced; null for Tiers 1 and 2 or with tiers off. */
  blueprint: BlueprintStatus | null
}

/** Can this recipe be crafted now: inputs (tiered when on), components and the blueprint. */
export function canCraftTiered(
  inv: Inventory,
  recipe: RecipeDef,
  tiersOn: boolean,
  foundClues: readonly string[],
): TieredCheck {
  const r = effectiveRecipe(recipe, tiersOn)
  const base = canCraft(inv, r)
  const missingComponents = base.missing.filter((m) => ITEM_MAP[m.item]?.kind === 'component').map((m) => m.item)
  const bpId = tiersOn ? recipe.tiered?.blueprint : undefined
  const blueprint = bpId === undefined ? null : blueprintStatus(bpId, foundClues)
  return { ...base, ok: base.ok && (blueprint === null || blueprint.ready), missingComponents, blueprint }
}

// ---------------------------------------------------------------------------
// Tier damage and cost (Property 23)
// ---------------------------------------------------------------------------

/**
 * A recipe's weapon damage: the hit, or a trap's whole burn (damage per second times its burn), or
 * null when the output is not a damaging weapon (bandages, candles, a timed buff).
 */
export function recipeDamage(recipe: RecipeDef): number | null {
  const w = WEAPON_MAP[recipe.output.item as CraftedItemId]
  if (w === undefined || !(w.damage > 0)) return null
  return w.kind === 'placed' && w.duration !== undefined ? w.damage * w.duration : w.damage
}

/** Total materials: the inputs, with each component counted as the materials that make it. */
export function recipeCost(recipe: RecipeDef, tiersOn: boolean): number {
  return effectiveRecipe(recipe, tiersOn).inputs.reduce((sum, i) => {
    const maker = RECIPES.find((x) => x.output.item === i.item && ITEM_MAP[i.item]?.kind === 'component')
    return sum + (maker ? recipeCost(maker, tiersOn) * i.qty : i.qty)
  }, 0)
}

export interface TierStats {
  tier: RecipeTier
  minDamage: number | null
  minCost: number
}

/** Per tier: the weakest weapon's damage and the cheapest recipe (component recipes left out). */
export function tierStats(tiersOn: boolean): TierStats[] {
  return ([1, 2, 3] as const).map((tier) => {
    const rs = RECIPES.filter((r) => r.tier === tier && !r.tieredOnly)
    const dmg = rs.map(recipeDamage).filter((d): d is number => d !== null)
    return {
      tier,
      minDamage: dmg.length > 0 ? Math.min(...dmg) : null,
      minCost: Math.min(...rs.map((r) => recipeCost(r, tiersOn))),
    }
  })
}

/** The component an item is, by name, for "Needs: Iron Head (craft it first)". */
export function componentName(item: ItemId): string {
  return ITEM_MAP[item]?.name ?? item
}
