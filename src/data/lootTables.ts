// Loot tables — materials only. Key items, relics and pages use fixed spawns (zones.ts).
// Sources follow docs/game-design.md §3 "Found" column.

import type { MaterialId } from '../game/types'

export type LootTableId =
  | 'grave-dig'
  | 'broken-coffin'
  | 'hut-supplies'
  | 'crypt-shelves'
  | 'chapel-font'
  | 'catacomb-walls'

export interface LootEntry {
  item: MaterialId
  weight: number
  min: number
  max: number
}

export interface LootTable {
  id: LootTableId
  /** Number of weighted draws per roll. */
  rolls: number
  entries: readonly LootEntry[]
}

export const LOOT_TABLES: readonly LootTable[] = [
  {
    id: 'grave-dig',
    rolls: 2,
    entries: [
      { item: 'bone', weight: 5, min: 1, max: 3 },
      { item: 'cloth', weight: 3, min: 1, max: 2 },
      { item: 'iron-nail', weight: 2, min: 1, max: 2 },
    ],
  },
  {
    id: 'broken-coffin',
    rolls: 1,
    entries: [
      { item: 'iron-nail', weight: 5, min: 1, max: 3 },
      { item: 'cloth', weight: 3, min: 1, max: 2 },
      { item: 'bone', weight: 2, min: 1, max: 2 },
    ],
  },
  {
    id: 'hut-supplies',
    rolls: 1,
    entries: [
      { item: 'cloth', weight: 4, min: 1, max: 2 },
      { item: 'lamp-oil', weight: 4, min: 1, max: 1 },
      { item: 'iron-nail', weight: 2, min: 1, max: 2 },
    ],
  },
  {
    id: 'crypt-shelves',
    rolls: 1,
    entries: [
      { item: 'candle-wax', weight: 5, min: 1, max: 2 },
      { item: 'lamp-oil', weight: 3, min: 1, max: 1 },
      { item: 'grave-salt', weight: 2, min: 1, max: 1 },
      { item: 'holy-water', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'chapel-font',
    rolls: 1,
    entries: [{ item: 'holy-water', weight: 1, min: 2, max: 2 }],
  },
  {
    id: 'catacomb-walls',
    rolls: 1,
    entries: [
      { item: 'bone', weight: 5, min: 1, max: 3 },
      { item: 'grave-salt', weight: 4, min: 1, max: 2 },
      { item: 'holy-water', weight: 1, min: 1, max: 1 },
    ],
  },
]

export const LOOT_TABLE_MAP: Readonly<Record<LootTableId, LootTable>> = Object.fromEntries(
  LOOT_TABLES.map((t) => [t.id, t]),
) as Record<LootTableId, LootTable>
