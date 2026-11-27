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
import type { MinigameId } from './cases'
import type { CaseId } from './stages'

/** What can reveal a fixed spawn: a solved case or a solved minigame. The ids never overlap. */
export type Revealed = CaseId | MinigameId

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
  { id: 'hut-shelf', zone: 'grounds', position: [1.8, 0.78, -1], lootTable: 'hut-supplies' },
  {
    id: 'grounds-coffin-east',
    zone: 'grounds',
    position: [28, 0, -12],
    lootTable: 'broken-coffin',
  },
  {
    id: 'grounds-coffin-south',
    zone: 'grounds',
    position: [-8, 0, 30],
    lootTable: 'broken-coffin',
  },
  { id: 'grounds-fence-west', zone: 'grounds', position: [-38, 0, 5], lootTable: 'broken-coffin' },
  { id: 'grave-oak-hollow', zone: 'grounds', position: [-15, 0, 12], lootTable: 'grave-dig' },
  { id: 'grave-north-row', zone: 'grounds', position: [14, 0, -20], lootTable: 'grave-dig' },
  { id: 'grave-low-field', zone: 'grounds', position: [22, 0, 24], lootTable: 'grave-dig' },
  // Chapel
  // Seated on the chapel scene's surfaces (chapel-interior-colliders.json): the font lid at 0.88
  // and the west pew seat at 0.40, each 1 cm proud. Position y is the surface the model rests on.
  { id: 'chapel-font', zone: 'chapel', position: [11.5, 0.89, 3], lootTable: 'chapel-font' },
  // x 8.5 so up to three stacks (0.35 m apart, to the east) stay on the seat (world x 8.2..9.35).
  { id: 'chapel-pews', zone: 'chapel', position: [8.5, 0.41, 7.42], lootTable: 'crypt-shelves' },
  // Mausoleum Row
  {
    id: 'row-shelf-a',
    zone: 'mausoleum-row',
    position: [-21, 0.3, -46],
    lootTable: 'crypt-shelves',
  },
  {
    id: 'row-shelf-b',
    zone: 'mausoleum-row',
    position: [-19, 0.3, -52],
    lootTable: 'crypt-shelves',
  },
  {
    id: 'row-shelf-c',
    zone: 'mausoleum-row',
    position: [-21, 0.3, -58],
    lootTable: 'crypt-shelves',
  },
  // Catacombs
  // On the three bone-wall ledges of catacombs.glb (surface 0.95; catacombs.json move-items).
  { id: 'cat-wall-a', zone: 'catacombs', position: [23.87, 0.95, 45], lootTable: 'catacomb-walls' },
  { id: 'cat-wall-b', zone: 'catacombs', position: [26.13, 0.95, 50], lootTable: 'catacomb-walls' },
  {
    id: 'cat-wall-c',
    zone: 'catacombs',
    position: [23.87, 0.95, 54.9],
    lootTable: 'catacomb-walls',
  },
  // Last, so adding it leaves every earlier point's seeded roll unchanged. On the way from the
  // hut to the crypt key (spec 09, B3).
  { id: 'grounds-path-oil', zone: 'grounds', position: [-6, 0, -8], lootTable: 'path-oil' },
]

/** Key items, relics and journal pages spawn once only (Requirement 7.2). */
export interface FixedSpawn {
  id: string
  zone: ZoneId
  position: Vec3
  item: KeyItemId | RelicId
  /** Only visible and collectable during Night (Requirement 7.3). */
  nightOnly?: boolean
  /** A flat item resting on a slope: degrees its surface leans toward -Z (the chapel door). */
  tiltDeg?: number
  /** Lies in the world only once this case is solved (spec 10, Req 14.4). */
  revealedBy?: Revealed
}

export const FIXED_SPAWNS: readonly FixedSpawn[] = [
  { id: 'fx-page-1', zone: 'grounds', position: [2.6, 0.78, -1.3], item: 'journal-page-1' },
  // Pell's grave (CASE_1_REWARD in cases.ts). Story runs never see it: solving case 1 hands the key
  // over at the altar and marks this copy taken.
  {
    id: 'fx-crypt-key',
    zone: 'grounds',
    position: [-8.4, 0, -21.6],
    item: 'rusted-crypt-key',
    revealedBy: 'saved-by-the-bell',
  },
  { id: 'fx-page-2', zone: 'grounds', position: [-12.5, 0, -17], item: 'journal-page-2' },
  { id: 'fx-bell-clapper', zone: 'grounds', position: [30, 0, -25], item: 'sextons-bell-clapper' },
  {
    id: 'fx-locket',
    zone: 'grounds',
    position: [-30, 0, 10],
    item: 'childs-locket',
    nightOnly: true,
  },
  {
    id: 'fx-bone-whistle',
    zone: 'grounds',
    position: [-25.1, 0.3, -37.3],
    item: 'bone-whistle',
    // In Kerr's locker by the lodge, which opens when the crest lock is solved (playtest story pass).
    revealedBy: '2d',
  },
  { id: 'fx-page-3', zone: 'mausoleum-row', position: [-20, 0.3, -55], item: 'journal-page-3' },
  { id: 'fx-ledger', zone: 'mausoleum-row', position: [-19, 0.3, -54], item: 'parish-ledger' },
  { id: 'fx-rosary', zone: 'mausoleum-row', position: [-20, 0.3, -57], item: 'crane-rosary' },
  {
    id: 'fx-ossuary-key',
    zone: 'mausoleum-row',
    position: [-20.5, 0.3, -58],
    item: 'iron-ossuary-key',
    // Elias lies in the opened Crane crypt with it once the evidence is in order (spec 10 task 4.4).
    revealedBy: '3b',
  },
  // Page and shroud lie on the stone bier (top 0.78), the heart on the reliquary altar (0.78).
  { id: 'fx-page-4', zone: 'catacombs', position: [24.2, 0.78, 52.6], item: 'journal-page-4' },
  { id: 'fx-shroud', zone: 'catacombs', position: [24.35, 0.78, 53.4], item: 'burial-shroud' },
  { id: 'fx-heart', zone: 'catacombs', position: [25, 0.78, 58], item: 'reliquary-heart' },
  // On the lectern's book rest (0.97), 1 cm proud, tilted to match its slope toward the door.
  { id: 'fx-page-5', zone: 'chapel', position: [10, 0.98, 5], item: 'journal-page-5', tiltDeg: 14 },
]
