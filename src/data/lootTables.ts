// Loot tables — materials and the odd consumable. Key items, relics and pages use fixed spawns (zones.ts).
// Sources follow docs/game-design.md §3 "Found" column.

import type { MaterialId } from '../game/types'

/** Everything a loot table can hand out: materials plus the rare Kola Tonic. */
export type LootItemId = MaterialId | 'kola-tonic'

export type LootTableId =
  | 'grave-dig'
  | 'path-oil'
  | 'broken-coffin'
  | 'hut-supplies'
  | 'crypt-shelves'
  | 'chapel-font'
  | 'catacomb-walls'
  | 'woodpile'
  | 'powder-tin'

export interface LootEntry {
  item: LootItemId
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
      { item: 'lead-shot', weight: 2, min: 1, max: 2 },
      { item: 'wood-plank', weight: 3, min: 1, max: 2 },
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
      { item: 'black-powder', weight: 1, min: 1, max: 1 },
      { item: 'kola-tonic', weight: 1, min: 1, max: 1 },
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
      { item: 'silver-filings', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'woodpile',
    rolls: 1,
    entries: [{ item: 'wood-plank', weight: 1, min: 2, max: 4 }],
  },
  // One bottle on the hut-to-crypt-key path each day (spec 09, B3; design bible §3).
  {
    id: 'path-oil',
    rolls: 1,
    entries: [{ item: 'lamp-oil', weight: 1, min: 1, max: 1 }],
  },
  {
    id: 'powder-tin',
    rolls: 1,
    entries: [{ item: 'black-powder', weight: 1, min: 1, max: 1 }],
  },
]

export const LOOT_TABLE_MAP: Readonly<Record<LootTableId, LootTable>> = Object.fromEntries(
  LOOT_TABLES.map((t) => [t.id, t]),
) as Record<LootTableId, LootTable>
