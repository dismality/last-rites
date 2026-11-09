// Zones and spawn points — mirrored from docs/game-design.md §2 and §3.
// Positions follow the greybox layout in cemeteryLayout.ts (+X east, +Z south).
// Pure data: no logic, no side effects.

import type { KeyItemId, RelicId } from '../game/types'
import {
  AVENUE_CRYPT_SIZE,
  CATACOMBS,
  CHAPEL,
  CHAPEL_CENTER,
  MAUSOLEUM_ROW,
  avenueFarZ,
  type CorridorSpec,
  type Vec3,
} from './cemeteryLayout'
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

/** Axis-aligned ground rectangle (x east, z south). */
export interface ZoneRect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const corridorRect = (c: CorridorSpec, halfX: number, farZ: number): ZoneRect => {
  const nearZ = c.entranceZ
  return {
    minX: c.centerX - halfX,
    maxX: c.centerX + halfX,
    minZ: Math.min(nearZ, farZ),
    maxZ: Math.max(nearZ, farZ),
  }
}

const deepestCrypt = Math.max(...Object.values(AVENUE_CRYPT_SIZE).map((s) => s.depth))

/**
 * Zone rectangles derived from the layout so they track it. Checked in this order;
 * `grounds` is the fallback for everything else, so zone lookup is total.
 * Mausoleum Row is widened to the crypts lining the avenue (setback 0.8 m, see cemeteryLayout).
 */
export const ZONE_BOUNDS: readonly { zone: Exclude<ZoneId, 'grounds'>; rect: ZoneRect }[] = [
  {
    zone: 'chapel',
    rect: {
      minX: CHAPEL_CENTER[0] - (CHAPEL.halfX + CHAPEL.wallThickness),
      maxX: CHAPEL_CENTER[0] + (CHAPEL.halfX + CHAPEL.wallThickness),
      minZ: CHAPEL_CENTER[2] - (CHAPEL.halfZ + CHAPEL.wallThickness),
      maxZ: CHAPEL_CENTER[2] + (CHAPEL.halfZ + CHAPEL.wallThickness),
    },
  },
  {
    zone: 'catacombs',
    rect: corridorRect(
      CATACOMBS,
      CATACOMBS.width / 2 + CATACOMBS.wallThickness,
      CATACOMBS.entranceZ + CATACOMBS.dir * CATACOMBS.length,
    ),
  },
  {
    zone: 'mausoleum-row',
    rect: corridorRect(MAUSOLEUM_ROW, MAUSOLEUM_ROW.width / 2 + 0.8 + deepestCrypt, avenueFarZ()),
  },
]

/** A material spawn point; refilled from its loot table every new day. */
export interface SpawnPoint {
  id: string
  zone: ZoneId
  position: Vec3
  lootTable: LootTableId
  /** Fills once per run and never refills on a new day (e.g. the powder tin). */
  once?: boolean
}

export const SPAWN_POINTS: readonly SpawnPoint[] = [
  // Grounds
  { id: 'hut-shelf', zone: 'grounds', position: [1.8, 0.8, -1], lootTable: 'hut-supplies' },
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
  { id: 'row-shelf-a', zone: 'mausoleum-row', position: [-21, 0.3, -46], lootTable: 'crypt-shelves' },
  { id: 'row-shelf-b', zone: 'mausoleum-row', position: [-19, 0.3, -52], lootTable: 'crypt-shelves' },
  { id: 'row-shelf-c', zone: 'mausoleum-row', position: [-21, 0.3, -58], lootTable: 'crypt-shelves' },
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
  { id: 'fx-page-1', zone: 'grounds', position: [2.6, 0.8, -1.3], item: 'journal-page-1' },
  { id: 'fx-crypt-key', zone: 'grounds', position: [-12, 0, -18], item: 'rusted-crypt-key' },
  { id: 'fx-page-2', zone: 'grounds', position: [-12.5, 0, -17], item: 'journal-page-2' },
  { id: 'fx-bell-clapper', zone: 'grounds', position: [30, 0, -25], item: 'sextons-bell-clapper' },
  { id: 'fx-locket', zone: 'grounds', position: [-30, 0, 10], item: 'childs-locket', nightOnly: true },
  { id: 'fx-bone-whistle', zone: 'mausoleum-row', position: [-21, 0.3, -48], item: 'bone-whistle' },
  { id: 'fx-page-3', zone: 'mausoleum-row', position: [-20, 0.3, -55], item: 'journal-page-3' },
  { id: 'fx-ledger', zone: 'mausoleum-row', position: [-19, 0.3, -54], item: 'parish-ledger' },
  { id: 'fx-rosary', zone: 'mausoleum-row', position: [-20, 0.3, -57], item: 'crane-rosary' },
  { id: 'fx-ossuary-key', zone: 'mausoleum-row', position: [-20.5, 0.3, -58], item: 'iron-ossuary-key' },
  { id: 'fx-page-4', zone: 'catacombs', position: [25, 1, 52], item: 'journal-page-4' },
  { id: 'fx-shroud', zone: 'catacombs', position: [24.5, 0.8, 53], item: 'burial-shroud' },
  { id: 'fx-heart', zone: 'catacombs', position: [25, 0.8, 58], item: 'reliquary-heart' },
  { id: 'fx-page-5', zone: 'chapel', position: [10, 1, 5], item: 'journal-page-5' },
]
