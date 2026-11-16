// Recipe definitions — source of truth mirrored from docs/game-design.md §5.
// Pure data: no logic, no side effects.

import type { FirearmId, ItemId, RecipeId } from '../game/types'
import type { BlueprintId } from './blueprints'

/** Spec 10 task 10 (tiered crafting): Tier 1 is Stage 1, Tier 2 Stage 2, Tier 3 Stage 3. */
export type RecipeTier = 1 | 2 | 3

/**
 * The tiered version of a recipe (Story modes). Tier 2 swaps in a crafted component plus 5 to 7
 * materials; Tier 3 also needs a blueprint pieced from 2 clues, plus a rare material. Endless keeps
 * the flat `inputs` (Req 27.5).
 */
export interface TieredRecipe {
  inputs: { item: ItemId; qty: number }[]
  blueprint?: BlueprintId
}

export interface RecipeDef {
  id: RecipeId
  inputs: { item: ItemId; qty: number }[]
  output: { item: ItemId; qty: number }
  /**
   * When set, this item must exist in the inventory and will be consumed by the
   * craft (replaced by the output). Its hotbar slot is preserved.
   * Example: 'rusty-shovel' → replaced by 'sharpened-shovel'.
   */
  consumesTool?: ItemId
  unlock:
    | { type: 'start' }
    | { type: 'night'; night: 1 | 2 | 3 | 4 }
    | { type: 'pickup'; weapon: FirearmId }
    | { type: 'journal'; page: number }
  /**
   * 'partial': when the stack limit leaves room for only some of the output, craft
   * anyway and add what fits (ammo). Absent: the craft needs room for all of it.
   */
  outputCap?: 'partial'
  /** Crafting animation duration in seconds (default 1.5). */
  craftTime: number
  /** The recipe book's tier group (spec 10 task 10). */
  tier: RecipeTier
  /** The tiered recipe, when it differs from the flat one. */
  tiered?: TieredRecipe
  /** Only exists with tiers on: a component recipe is hidden in Endless. */
  tieredOnly?: true
}

export const RECIPES: RecipeDef[] = [
  // --- Start recipes (always available) ---
  {
    id: 'r-bone-club',
    inputs: [
      { item: 'bone', qty: 3 },
      { item: 'cloth', qty: 1 },
    ],
    output: { item: 'bone-club', qty: 1 },
    unlock: { type: 'start' },
    craftTime: 1.5,
    tier: 1,
  },
  {
    id: 'r-bandage',
    inputs: [{ item: 'cloth', qty: 2 }],
    output: { item: 'bandage', qty: 1 },
    unlock: { type: 'start' },
    craftTime: 1.5,
    tier: 1,
  },
  {
    id: 'r-tallow-candle',
    inputs: [
      { item: 'candle-wax', qty: 2 },
      { item: 'cloth', qty: 1 },
    ],
    output: { item: 'tallow-candle', qty: 1 },
    unlock: { type: 'start' },
    craftTime: 1.5,
    tier: 1,
  },
  {
    id: 'r-lantern-refill',
    inputs: [
      { item: 'lamp-oil', qty: 1 },
      { item: 'candle-wax', qty: 1 },
    ],
    output: { item: 'lantern-refill', qty: 1 },
    unlock: { type: 'start' },
    craftTime: 1.5,
    tier: 1,
  },

  // --- Night unlocks ---
  {
    id: 'r-sharpened-shovel',
    inputs: [{ item: 'iron-nail', qty: 2 }],
    output: { item: 'sharpened-shovel', qty: 1 },
    consumesTool: 'rusty-shovel',
    unlock: { type: 'night', night: 1 },
    craftTime: 1.5,
    tier: 2,
    tiered: {
      inputs: [
        { item: 'iron-head', qty: 1 },
        { item: 'iron-nail', qty: 2 },
        { item: 'wood-plank', qty: 1 },
        { item: 'cloth', qty: 2 },
      ],
    },
  },
  {
    id: 'r-holy-water-flask',
    inputs: [
      { item: 'holy-water', qty: 1 },
      { item: 'cloth', qty: 1 },
    ],
    output: { item: 'holy-water-flask', qty: 1 },
    unlock: { type: 'night', night: 2 },
    craftTime: 1.5,
    tier: 2,
    tiered: {
      inputs: [
        { item: 'oil-wick', qty: 1 },
        { item: 'holy-water', qty: 2 },
        { item: 'cloth', qty: 2 },
        { item: 'candle-wax', qty: 1 },
      ],
    },
  },
  {
    id: 'r-lantern-trap',
    inputs: [
      { item: 'lamp-oil', qty: 1 },
      { item: 'iron-nail', qty: 2 },
      { item: 'cloth', qty: 1 },
    ],
    output: { item: 'lantern-trap', qty: 1 },
    unlock: { type: 'night', night: 3 },
    craftTime: 1.5,
    tier: 2,
    tiered: {
      inputs: [
        { item: 'oil-wick', qty: 1 },
        { item: 'lamp-oil', qty: 2 },
        { item: 'iron-nail', qty: 3 },
        { item: 'cloth', qty: 1 },
      ],
    },
  },
  {
    id: 'r-nail-bomb',
    inputs: [
      { item: 'iron-nail', qty: 3 },
      { item: 'holy-water', qty: 1 },
      { item: 'lamp-oil', qty: 1 },
    ],
    output: { item: 'nail-bomb', qty: 1 },
    unlock: { type: 'night', night: 4 },
    craftTime: 1.5,
    tier: 3,
    tiered: {
      inputs: [
        { item: 'iron-head', qty: 1 },
        { item: 'iron-nail', qty: 3 },
        { item: 'holy-water', qty: 1 },
        { item: 'lamp-oil', qty: 1 },
        { item: 'grave-salt', qty: 1 },
      ],
      blueprint: 'bp-nail-bomb',
    },
  },

  // --- Journal unlocks ---
  {
    id: 'r-salt-circle',
    inputs: [
      { item: 'grave-salt', qty: 2 },
      { item: 'holy-water', qty: 1 },
    ],
    output: { item: 'salt-circle', qty: 1 },
    unlock: { type: 'journal', page: 3 },
    craftTime: 1.5,
    tier: 1,
  },
  // --- Weapon pickup unlocks and ammunition (spec 07) ---
  {
    id: 'r-revolver-cartridge',
    inputs: [
      { item: 'black-powder', qty: 1 },
      { item: 'lead-shot', qty: 1 },
    ],
    output: { item: 'revolver-cartridge', qty: 6 },
    outputCap: 'partial',
    unlock: { type: 'pickup', weapon: 'revolver' },
    craftTime: 1.5,
    tier: 1,
  },
  {
    id: 'r-shotgun-shell',
    inputs: [
      { item: 'black-powder', qty: 1 },
      { item: 'lead-shot', qty: 2 },
      { item: 'cloth', qty: 1 },
    ],
    output: { item: 'shotgun-shell', qty: 4 },
    outputCap: 'partial',
    unlock: { type: 'pickup', weapon: 'shotgun' },
    craftTime: 1.5,
    tier: 1,
  },
  {
    id: 'r-blessed-rounds',
    inputs: [
      { item: 'holy-water', qty: 1 },
      { item: 'silver-filings', qty: 1 },
    ],
    output: { item: 'blessed-rounds', qty: 1 },
    unlock: { type: 'night', night: 2 },
    craftTime: 1.5,
    tier: 3,
    tiered: {
      inputs: [
        { item: 'holy-water', qty: 2 },
        { item: 'silver-filings', qty: 2 },
        { item: 'black-powder', qty: 2 },
        { item: 'lead-shot', qty: 2 },
      ],
      blueprint: 'bp-blessed-rounds',
    },
  },

  // --- Components (spec 10 task 10, tiered crafting): Story modes only, unlocked with Tier 2 ---
  {
    id: 'r-iron-head',
    inputs: [
      { item: 'iron-nail', qty: 2 },
      { item: 'wood-plank', qty: 1 },
    ],
    output: { item: 'iron-head', qty: 1 },
    unlock: { type: 'night', night: 1 },
    craftTime: 1.5,
    tier: 2,
    tieredOnly: true,
  },
  {
    id: 'r-oil-wick',
    inputs: [
      { item: 'cloth', qty: 1 },
      { item: 'candle-wax', qty: 1 },
      { item: 'lamp-oil', qty: 1 },
    ],
    output: { item: 'oil-wick', qty: 1 },
    unlock: { type: 'night', night: 1 },
    craftTime: 1.5,
    tier: 2,
    tieredOnly: true,
  },
]

/** Convenience lookup by recipe ID */
export const RECIPE_MAP: Readonly<Record<RecipeId, RecipeDef>> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
) as Readonly<Record<RecipeId, RecipeDef>>
