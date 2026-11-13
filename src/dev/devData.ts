// Named teleport points and option lists for the Dev_Panel. Positions come from the layout and
// zone data, so the panel follows the world when it changes. Feet position (x, z) and yaw:
// yaw 0 faces -Z (north), PI faces +Z, -PI/2 faces +X.

import {
  CHAPEL_ALTAR,
  CRANE_CRYPT_STEP,
  CRANE_SPAWN,
  LODGE,
  POWDER_TIN_BELL_TOWER,
  WOODPILE_POSITION,
} from '../data/cemeteryLayout'
import { SCARE_EVENTS, SCARE_ZONES } from '../data/scares'
import { ITEMS } from '../data/items'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../data/zones'
import type { EndingId, ItemId, KeyItemId, MaterialId, RelicId } from '../game/types'

export interface TeleportPoint {
  readonly id: string
  readonly label: string
  readonly x: number
  readonly z: number
  readonly yaw: number
}

const N = 0
const S = Math.PI
const E = -Math.PI / 2

export const TELEPORT_POINTS: readonly TeleportPoint[] = [
  { id: 'hut', label: "Keeper's hut (start)", x: 0, z: 0, yaw: N },
  { id: 'workbench', label: 'Workbench', x: 0, z: -0.6, yaw: N },
  { id: 'woodpile', label: 'Woodpile (axe)', x: WOODPILE_POSITION[0] + 1.5, z: WOODPILE_POSITION[2], yaw: E + Math.PI },
  { id: 'chapel-door', label: 'Chapel front door', x: 10, z: -3, yaw: S },
  { id: 'chapel-vestry', label: 'Chapel vestry door', x: 5.5, z: 9.5, yaw: E },
  { id: 'chapel-altar', label: 'Chapel altar', x: CHAPEL_ALTAR[0], z: CHAPEL_ALTAR[2] - 2, yaw: S },
  { id: 'oak-path', label: 'Oak path (crypt key)', x: -12, z: -15, yaw: N },
  { id: 'west-hill', label: 'West hill (locket)', x: -28, z: 10, yaw: N },
  { id: 'bell-tower', label: 'Bell tower', x: POWDER_TIN_BELL_TOWER[0], z: POWDER_TIN_BELL_TOWER[2] + 2, yaw: N },
  { id: 'row-mouth', label: 'Mausoleum Row mouth', x: -20, z: -37, yaw: N },
  { id: 'lodge', label: "Gatekeeper's lodge", x: LODGE.center[0] + 2, z: LODGE.center[2], yaw: E + Math.PI },
  { id: 'row-end', label: 'Row end (ossuary key)', x: -20, z: -56, yaw: N },
  { id: 'crane-crypt', label: 'Crane crypt step', x: CRANE_CRYPT_STEP[0], z: CRANE_CRYPT_STEP[2] + 1.2, yaw: N },
  { id: 'catacombs', label: 'Catacombs mouth', x: 25, z: 37, yaw: S },
  { id: 'ossuary', label: 'Catacomb ossuary', x: 25, z: 52, yaw: S },
  { id: 'merchant', label: 'Merchant cart', x: -7.2, z: 33, yaw: S },
]

const ITEM_NAME = new Map<string, string>(ITEMS.map((i) => [i.id, i.name]))
// Declared here, not via RELIC_IDS below, which is not yet initialised when the groups are built.
const RELIC_LIST: readonly RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

/** Stand 1 m south of an item and face it (yaw 0 faces -Z), so the player is not on top of it. */
function facing(id: string, label: string, x: number, z: number): TeleportPoint {
  return { id, label, x, z: z + 1, yaw: N }
}

function fixedSpot(item: string, label: string): TeleportPoint {
  const f = FIXED_SPAWNS.find((s) => s.item === item)
  if (!f) throw new Error(`No fixed spawn for ${item}`)
  return facing(f.id, label, f.position[0], f.position[2])
}

export interface TeleportGroup {
  readonly title: string
  readonly points: readonly TeleportPoint[]
}

/** The A1 list beyond the hand-placed points: generated from the world data. */
export const TELEPORT_GROUPS: readonly TeleportGroup[] = [
  {
    title: 'Story spots',
    points: [
      fixedSpot('rusted-crypt-key', 'Crypt key (-12, -18)'),
      fixedSpot('bone-whistle', 'Bone whistle (-21, -48)'),
      fixedSpot('iron-ossuary-key', 'Iron ossuary key'),
      { id: 'catacomb-stair', label: 'Catacomb stair (behind altar)', x: CRANE_SPAWN.stair[0], z: CRANE_SPAWN.stair[2] - 1.5, yaw: S },
    ],
  },
  {
    title: 'Relics',
    points: FIXED_SPAWNS.filter((f) => (RELIC_LIST as readonly string[]).includes(f.item)).map((f) =>
      facing(f.id, ITEM_NAME.get(f.item) ?? f.item, f.position[0], f.position[2]),
    ),
  },
  {
    title: 'Diggable graves',
    points: SPAWN_POINTS.filter((p) => p.lootTable === 'grave-dig').map((p) =>
      facing(p.id, p.id.replace('grave-', '').replace('-', ' '), p.position[0], p.position[2]),
    ),
  },
  {
    title: 'Scare zones (centre)',
    points: SCARE_ZONES.map((zn) => ({
      id: `scare-${zn.id}`,
      label: zn.id,
      x: (zn.bounds.min[0] + zn.bounds.max[0]) / 2,
      z: (zn.bounds.min[2] + zn.bounds.max[2]) / 2,
      yaw: N,
    })),
  },
]

export const MATERIAL_IDS: readonly MaterialId[] = ITEMS.filter((i) => i.kind === 'material').map(
  (i) => i.id as MaterialId,
)

export const KEY_ITEM_IDS: readonly KeyItemId[] = [
  'rusted-crypt-key',
  'bone-whistle',
  'iron-ossuary-key',
  'parish-ledger',
]

export const RELIC_IDS: readonly RelicId[] = RELIC_LIST

export const PAGE_NUMBERS = [1, 2, 3, 4, 5] as const

/** Crafted items the panel can hand out directly (firearms and heavy melee go through pickups). */
export const CRAFTED_GIVE_IDS: readonly ItemId[] = [
  'rusty-shovel',
  'bone-club',
  'sharpened-shovel',
  'holy-water-flask',
  'lantern-trap',
  'nail-bomb',
  'salt-circle',
  'bandage',
  'tallow-candle',
  'lantern-refill',
  'blessed-rounds',
  'kola-tonic',
  'revolver-cartridge',
  'shotgun-shell',
]

export const SCARE_IDS = SCARE_EVENTS.map((e) => e.id)

export const ENDING_IDS: readonly EndingId[] = ['rest', 'uneasy-peace', 'taken']

/**
 * What a player holds when stage N begins (spec 10 Req 5.4). Key items come from the story beats
 * of the stages before it: the Rusted Crypt Key once case 1 is solved, the Bone Whistle on
 * Mausoleum Row during stage 2. Pages are the ones mapped to earlier stages. Recipes are the dawn
 * unlocks of every earlier stage (read from the stage data, so they follow it).
 */
export const STAGE_START_KEY_ITEMS: Readonly<Record<1 | 2 | 3, readonly KeyItemId[]>> = {
  1: [],
  2: ['rusted-crypt-key'],
  3: ['rusted-crypt-key', 'bone-whistle'],
}
export const STAGE_START_PAGES: Readonly<Record<1 | 2 | 3, readonly (1 | 2 | 3 | 4 | 5)[]>> = {
  1: [],
  2: [1, 2],
  3: [1, 2, 3],
}
