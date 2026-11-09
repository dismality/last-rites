// Recipe definitions — source of truth mirrored from docs/game-design.md §5.
// Pure data: no logic, no side effects.

import type { FirearmId, ItemId, RecipeId } from '../game/types'

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
  },
  {
    id: 'r-bandage',
    inputs: [{ item: 'cloth', qty: 2 }],
    output: { item: 'bandage', qty: 1 },
    unlock: { type: 'start' },
    craftTime: 1.5,
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
  },

  // --- Night unlocks ---
  {
    id: 'r-sharpened-shovel',
    inputs: [{ item: 'iron-nail', qty: 2 }],
    output: { item: 'sharpened-shovel', qty: 1 },
    consumesTool: 'rusty-shovel',
    unlock: { type: 'night', night: 1 },
    craftTime: 1.5,
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
  },
]

/** Convenience lookup by recipe ID */
export const RECIPE_MAP: Readonly<Record<RecipeId, RecipeDef>> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
) as Readonly<Record<RecipeId, RecipeDef>>
