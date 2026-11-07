// Zones and spawn points — mirrored from docs/game-design.md §2 and §3.
// Positions follow the greybox layout in cemeteryLayout.ts (+X east, +Z south).
// Pure data: no logic, no side effects.

import type { KeyItemId, RelicId } from '../game/types'
import type { Vec3 } from './cemeteryLayout'
import type { LootTableId } from './lootTables'

export type ZoneId = 'grounds' | 'mausoleum-row' | 'chapel' | 'catacombs'

export interface ZoneDef {
  id: ZoneId
  name: string
}

export const ZONES: readonly ZoneDef[] = [
  { id: 'grounds', name: "Keeper's Hut and Grounds" },
  { id: 'mausoleum-row', name: 'Mausoleum Row' },
  { id: 'chapel', name: 'Chapel' },
  { id: 'catacombs', name: 'Catacombs' },
]

/** A material spawn point; refilled from its loot table every new day. */
export interface SpawnPoint {
  id: string
  zone: ZoneId
  position: Vec3
  lootTable: LootTableId
}

export const SPAWN_POINTS: readonly SpawnPoint[] = [
  // Grounds
  { id: 'hut-shelf', zone: 'grounds', position: [2, 0.8, -1], lootTable: 'hut-supplies' },
  { id: 'grounds-coffin-east', zone: 'grounds', position: [28, 0, -12], lootTable: 'broken-coffin' },
  { id: 'grounds-coffin-south', zone: 'grounds', position: [-8, 0, 30], lootTable: 'broken-coffin' },
  { id: 'grounds-fence-west', zone: 'grounds', position: [-38, 0, 5], lootTable: 'broken-coffin' },
  { id: 'grave-oak-hollow', zone: 'grounds', position: [-15, 0, 12], lootTable: 'grave-dig' },
  { id: 'grave-north-row', zone: 'grounds', position: [14, 0, -20], lootTable: 'grave-dig' },
  { id: 'grave-low-field', zone: 'grounds', position: [22, 0, 24], lootTable: 'grave-dig' },
  // Chapel
  { id: 'chapel-font', zone: 'chapel', position: [11.5, 0.9, 3], lootTable: 'chapel-font' },
  { id: 'chapel-pews', zone: 'chapel', position: [9, 0.4, 8], lootTable: 'crypt-shelves' },
  // Mausoleum Row
  { id: 'row-shelf-a', zone: 'mausoleum-row', position: [-21, 1, -46], lootTable: 'crypt-shelves' },
  { id: 'row-shelf-b', zone: 'mausoleum-row', position: [-19, 1, -52], lootTable: 'crypt-shelves' },
  { id: 'row-shelf-c', zone: 'mausoleum-row', position: [-21, 1, -58], lootTable: 'crypt-shelves' },
  // Catacombs
  { id: 'cat-wall-a', zone: 'catacombs', position: [24.5, 1, 45], lootTable: 'catacomb-walls' },
  { id: 'cat-wall-b', zone: 'catacombs', position: [25.5, 1, 50], lootTable: 'catacomb-walls' },
  { id: 'cat-wall-c', zone: 'catacombs', position: [24.5, 1, 55], lootTable: 'catacomb-walls' },
]

/** Key items, relics and journal pages spawn once only (Requirement 7.2). */
export interface FixedSpawn {
  id: string
  zone: ZoneId
  position: Vec3
  item: KeyItemId | RelicId
  /** Only visible and collectable during Night (Requirement 7.3). */
  nightOnly?: boolean
}

export const FIXED_SPAWNS: readonly FixedSpawn[] = [
  { id: 'fx-page-1', zone: 'grounds', position: [1.5, 0.9, 1], item: 'journal-page-1' },
  { id: 'fx-crypt-key', zone: 'grounds', position: [-12, 0, -18], item: 'rusted-crypt-key' },
  { id: 'fx-page-2', zone: 'grounds', position: [-12.5, 0, -17], item: 'journal-page-2' },
  { id: 'fx-bell-clapper', zone: 'grounds', position: [30, 0, -25], item: 'sextons-bell-clapper' },
  { id: 'fx-locket', zone: 'grounds', position: [-30, 0, 10], item: 'childs-locket', nightOnly: true },
  { id: 'fx-bone-whistle', zone: 'mausoleum-row', position: [-21, 0.5, -48], item: 'bone-whistle' },
  { id: 'fx-page-3', zone: 'mausoleum-row', position: [-20, 1, -55], item: 'journal-page-3' },
  { id: 'fx-ledger', zone: 'mausoleum-row', position: [-19, 1, -54], item: 'parish-ledger' },
  { id: 'fx-rosary', zone: 'mausoleum-row', position: [-20, 0.8, -57], item: 'crane-rosary' },
  { id: 'fx-ossuary-key', zone: 'mausoleum-row', position: [-20.5, 0.2, -58], item: 'iron-ossuary-key' },
  { id: 'fx-page-4', zone: 'catacombs', position: [25, 1, 52], item: 'journal-page-4' },
  { id: 'fx-shroud', zone: 'catacombs', position: [24.5, 0.8, 53], item: 'burial-shroud' },
  { id: 'fx-heart', zone: 'catacombs', position: [25, 0.8, 58], item: 'reliquary-heart' },
  { id: 'fx-page-5', zone: 'chapel', position: [10, 1, 5], item: 'journal-page-5' },
]
