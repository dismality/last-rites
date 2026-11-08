// Item definitions — mirrored from docs/game-design.md §3 and §4.
// Pure data: no logic, no side effects.

import type { CraftedItemId, ItemId, KeyItemId, MaterialId, RelicId } from '../game/types'

export type { MaterialId } from '../game/types'

export type ItemKind = 'material' | 'weapon' | 'consumable' | 'placeable' | 'key' | 'relic' | 'lore'

/** Satchel limits (design bible §3). */
export const SATCHEL_SLOTS = 12
export const MATERIAL_STACK_LIMIT = 10

/** A hidden mark on an item that reveals clue text when it faces the camera. */
export interface ClueDef {
  text: string
  /** Mark direction in the model's local space (unit vector). */
  normal: readonly [number, number, number]
}

export interface ItemDef {
  id: ItemId
  name: string
  kind: ItemKind
  stackLimit: number
  /** Rune icon name used by the satchel and the interact prompt. */
  icon: string
  /** Path under public/assets/ for the examine-mode model. */
  model?: string
  clue?: ClueDef
}

const ITEM_MODEL_DIR = 'assets/models/items'

// Materials and crafted items have no bespoke art, so they borrow props from the
// world kit (examine view only; they are never spawned from these paths).
const WORLD_MODEL_DIR = 'assets/models/world'

/** Stand-in prop for each item without its own hero model. */
const BORROWED_MODEL: Partial<Record<ItemId, string>> = {
  bone: 'debris',
  'iron-nail': 'iron-fence-bar',
  'candle-wax': 'candle',
  'holy-water': 'detail-chalice',
  cloth: 'detail-plate',
  'lamp-oil': 'lantern-glass',
  'grave-salt': 'detail-bowl',
  'rusty-shovel': 'shovel',
  'sharpened-shovel': 'shovel',
  'bone-club': 'debris-wood',
  'holy-water-flask': 'urn-round',
  'nail-bomb': 'urn-square',
  'lantern-trap': 'fire-basket',
  'salt-circle': 'detail-bowl',
  'tallow-candle': 'candle-multiple',
  bandage: 'detail-plate',
  'lantern-refill': 'lantern-candle',
}

function borrowedModel(id: ItemId): string | undefined {
  const file = BORROWED_MODEL[id]
  return file ? `${WORLD_MODEL_DIR}/${file}.glb` : undefined
}

function material(id: MaterialId, name: string): ItemDef {
  return {
    id,
    name,
    kind: 'material',
    stackLimit: MATERIAL_STACK_LIMIT,
    icon: `rune-${id}`,
    model: borrowedModel(id),
  }
}

function crafted(
  id: CraftedItemId,
  name: string,
  kind: 'weapon' | 'consumable' | 'placeable',
): ItemDef {
  // One crafted item per slot (design bible §3).
  return { id, name, kind, stackLimit: 1, icon: `rune-${id}`, model: borrowedModel(id) }
}

function key(id: KeyItemId, name: string, extra: Partial<ItemDef> = {}): ItemDef {
  return { id, name, kind: 'key', stackLimit: 1, icon: `rune-${id}`, ...extra }
}

function relic(id: RelicId, name: string): ItemDef {
  return {
    id,
    name,
    kind: 'relic',
    stackLimit: 1,
    icon: `rune-${id}`,
    model: `${ITEM_MODEL_DIR}/${id}.glb`,
  }
}

function page(n: 1 | 2 | 3 | 4 | 5): ItemDef {
  const id = `journal-page-${n}` as const
  return { id, name: `Journal Page ${n}`, kind: 'lore', stackLimit: 1, icon: 'rune-journal-page' }
}

export const ITEMS: readonly ItemDef[] = [
  // Materials
  material('bone', 'Bone'),
  material('iron-nail', 'Iron Nails'),
  material('candle-wax', 'Candle Wax'),
  material('holy-water', 'Holy Water'),
  material('cloth', 'Cloth'),
  material('lamp-oil', 'Lamp Oil'),
  material('grave-salt', 'Grave Salt'),

  // Weapons, tools and consumables
  crafted('rusty-shovel', 'Rusty Shovel', 'weapon'),
  crafted('bone-club', 'Bone Club', 'weapon'),
  crafted('sharpened-shovel', 'Sharpened Shovel', 'weapon'),
  crafted('holy-water-flask', 'Holy Water Flask', 'weapon'),
  crafted('nail-bomb', 'Consecrated Nail Bomb', 'weapon'),
  crafted('lantern-trap', 'Lantern Trap', 'placeable'),
  crafted('salt-circle', 'Salt Circle', 'placeable'),
  crafted('tallow-candle', 'Tallow Candle', 'placeable'),
  crafted('bandage', 'Bandage', 'consumable'),
  crafted('lantern-refill', 'Lantern Refill', 'consumable'),

  // Key items
  key('rusted-crypt-key', 'Rusted Crypt Key', {
    model: `${ITEM_MODEL_DIR}/rusted-crypt-key.glb`,
    clue: { text: 'Scratched into the bow: "C.R. — Crane family"', normal: [0, 0, -1] },
  }),
  key('bone-whistle', "Sexton's Bone Whistle", { model: `${ITEM_MODEL_DIR}/bone-whistle.glb` }),
  key('iron-ossuary-key', 'Iron Ossuary Key', { model: `${ITEM_MODEL_DIR}/iron-ossuary-key.glb` }),
  {
    id: 'parish-ledger',
    name: 'Parish Ledger',
    kind: 'lore',
    stackLimit: 1,
    icon: 'rune-parish-ledger',
  },

  // Journal pages
  page(1),
  page(2),
  page(3),
  page(4),
  page(5),

  // Relics
  relic('crane-rosary', "Crane's Rosary"),
  relic('sextons-bell-clapper', "Sexton's Bell Clapper"),
  relic('childs-locket', "Child's Locket"),
  relic('burial-shroud', 'Burial Shroud'),
  relic('reliquary-heart', 'Reliquary Heart'),
]

export const ITEM_MAP: Readonly<Record<ItemId, ItemDef>> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
) as Record<ItemId, ItemDef>

/** Key items, relics and lore live in the journal, never in satchel slots. */
export function usesSatchelSlot(kind: ItemKind): boolean {
  return kind !== 'key' && kind !== 'relic' && kind !== 'lore'
}
