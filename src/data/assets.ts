// Asset paths. Everything under public/assets/ is addressed from here so no
// scene file hard-codes a URL. Pure data: no React / three.js imports.

import type { DawnUpgradeId, ItemId } from '../game/types'
import { ITEMS } from './items'

/** Self-hosted Draco decoder (copied from three's examples); nothing loads from a CDN. */
export const DRACO_PATH = '/draco/'

const WORLD_MODEL_DIR = '/assets/models/world'

/** World props used by the scene. File name (without .glb) is the id. */
export type WorldModelId =
  | 'gravestone-cross'
  | 'gravestone-round'
  | 'gravestone-bevel'
  | 'gravestone-wide'
  | 'gravestone-broken'
  | 'grave'
  | 'iron-fence'
  | 'brick-wall'
  | 'coffin-old'
  | 'pine-crooked'
  | 'pine'
  | 'crypt'
  | 'crypt-a'
  | 'crypt-b'
  | 'crypt-small'
  | 'cross'
  | 'pillar-large'
  | 'altar-stone'
  | 'candle-multiple'
  | 'trunk'
  | 'trunk-long'
  | 'lightpost-single'
  | 'crypt-large'
  | 'crypt-large-door'
  | 'crypt-large-roof'

export const WORLD_MODEL_IDS: readonly WorldModelId[] = [
  'gravestone-cross',
  'gravestone-round',
  'gravestone-bevel',
  'gravestone-wide',
  'gravestone-broken',
  'grave',
  'iron-fence',
  'brick-wall',
  'coffin-old',
  'pine-crooked',
  'pine',
  'crypt',
  'crypt-a',
  'crypt-b',
  'crypt-small',
  'cross',
  'pillar-large',
  'altar-stone',
  'candle-multiple',
  'trunk',
  'trunk-long',
  'lightpost-single',
  'crypt-large',
  'crypt-large-door',
  'crypt-large-roof',
]

export function worldModelUrl(id: WorldModelId): string {
  return `${WORLD_MODEL_DIR}/${id}.glb`
}

/** Turns an `ItemDef.model` path ("assets/models/items/x.glb") into a URL. */
export function assetUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/** URLs of every item model, taken from items.ts. The five journal pages share one file. */
export function itemModelUrls(): string[] {
  return [...new Set(ITEMS.flatMap((i) => (i.model ? [assetUrl(i.model)] : [])))]
}

/** Rigged zombie shared by all three enemy types (see docs/enemy-models.md). */
export const ZOMBIE_MODEL_URL = '/assets/models/enemies/zombie.glb'

/** Blockier rig for the Brute and Father Crane (see docs/enemy-models.md). */
export const BRUTE_MODEL_URL = '/assets/models/enemies/zombie-brute.glb'

// --- Horror pass art (spec 11). Claude makes these in Blender; until a file lands, the game uses
// the marked placeholder listed in data/placeholders.ts. None is preloaded except where noted.

/** The three new creatures (spec 11 H2). A missing file falls back to zombie.glb, scaled and tinted. */
export const CRAWLER_MODEL_URL = '/assets/models/enemies/crawler.glb'
export const BRIDE_MODEL_URL = '/assets/models/enemies/bride.glb'
export const HOUND_MODEL_URL = '/assets/models/enemies/hound.glb'

/** Screen-scare faces (spec 11 H1): transparent .webp, 2048 px tall. */
export const SCARE_FACE_IDS = ['face-zombie-1', 'face-zombie-2', 'face-crawler', 'ghost-bride-1', 'ghost-bride-2'] as const
export type ScareFaceId = (typeof SCARE_FACE_IDS)[number]
export const scareFaceUrl = (id: ScareFaceId): string => `/assets/scares/${id}.webp`

/** Hand-drawn Bestiary sketch of a new creature (spec 11 H2); a missing file shows a text card. */
export const bestiarySketchUrl = (id: 'crawler' | 'bride' | 'hound'): string => `/assets/bestiary/${id}.webp`

/** First-person hands and the lantern (spec 11 H7). */
export const HANDS_MODEL_URL = '/assets/models/viewmodel/hands.glb'
export const LANTERN_MODEL_URL = '/assets/models/viewmodel/lantern.glb'
/** The lantern's cage-bar cookie for SpotLight.map (spec 11 H7). */
export const LANTERN_COOKIE_URL = '/assets/textures/lantern-cookie.png'

/** The Brisk Draught bottle (spec 11 H6); the item's model path comes from items.ts and equals this. */
export const BRISK_DRAUGHT_MODEL_URL = '/assets/models/items/brisk-draught.glb'
/** Its 64x64 satchel icon; ITEM_ICON_URLS uses MISSING_ICON_URL until it lands. */
export const BRISK_DRAUGHT_ICON_URL = '/assets/icons/items/brisk-draught.png'

const ITEM_ICON_DIR = '/assets/icons/items'

/**
 * Marker for an item whose art has not been made yet. The UI draws a plain CSS box with a "?"
 * for it; no file by this name exists on purpose.
 */
export const MISSING_ICON_URL = 'placeholder-missing.png'

const icon = (file: string): string => `${ITEM_ICON_DIR}/${file}.png`

/**
 * Pixel-art icon (64x64) per item id. A Record keyed by ItemId, so a new item without an entry
 * is a compile error. All five journal pages share one icon.
 */
export const ITEM_ICON_URLS: Readonly<Record<ItemId, string>> = {
  bone: icon('bone'),
  'iron-nail': icon('iron-nail'),
  'candle-wax': icon('candle-wax'),
  'holy-water': icon('holy-water'),
  cloth: icon('cloth'),
  'lamp-oil': icon('lamp-oil'),
  'grave-salt': icon('grave-salt'),
  'wood-plank': icon('wood-plank'),
  'black-powder': icon('black-powder'),
  'lead-shot': icon('lead-shot'),
  'silver-filings': icon('silver-filings'),
  'iron-head': icon('iron-head'),
  'oil-wick': icon('oil-wick'),
  'revolver-cartridge': icon('revolver-cartridge'),
  'shotgun-shell': icon('shotgun-shell'),
  'rusty-shovel': icon('rusty-shovel'),
  'bone-club': icon('bone-club'),
  'sharpened-shovel': icon('sharpened-shovel'),
  'holy-water-flask': icon('holy-water-flask'),
  'lantern-trap': icon('lantern-trap'),
  'nail-bomb': icon('nail-bomb'),
  'salt-circle': icon('salt-circle'),
  bandage: icon('bandage'),
  'tallow-candle': icon('tallow-candle'),
  'lantern-refill': icon('lantern-refill'),
  revolver: icon('revolver'),
  shotgun: icon('shotgun'),
  'wood-axe': icon('wood-axe'),
  'silver-sabre': icon('silver-sabre'),
  'blessed-rounds': icon('blessed-rounds'),
  'kola-tonic': icon('kola-tonic'),
  // PLACEHOLDER: /assets/icons/items/brisk-draught.png (the satchel draws its "?" box until the icon lands)
  'brisk-draught': MISSING_ICON_URL,
  'rusted-crypt-key': icon('rusted-crypt-key'),
  'bone-whistle': icon('bone-whistle'),
  'iron-ossuary-key': icon('iron-ossuary-key'),
  'parish-ledger': icon('parish-ledger'),
  'journal-page-1': icon('journal-page'),
  'journal-page-2': icon('journal-page'),
  'journal-page-3': icon('journal-page'),
  'journal-page-4': icon('journal-page'),
  'journal-page-5': icon('journal-page'),
  'crane-rosary': icon('crane-rosary'),
  'sextons-bell-clapper': icon('sextons-bell-clapper'),
  'childs-locket': icon('childs-locket'),
  'burial-shroud': icon('burial-shroud'),
  'reliquary-heart': icon('reliquary-heart'),
}

/** Ids that have a map/compass mark image (`<id>-light.png` and `<id>-dark.png`, 32 px). */
export type MarkId =
  'hut' | 'chapel' | 'graves' | 'merchant' | 'objective' | 'gate' | 'relic' | 'workbench' | 'player'

/** Verbs that have an interaction rune image (64 px; shown at 32 px). */
export type InteractRuneId = 'pickup' | 'dig' | 'open' | 'read' | 'examine' | 'nail' | 'trade' | 'name'

export interface IconIds {
  item: ItemId
  boon: DawnUpgradeId
  'boon-rune': DawnUpgradeId
  'interact-rune': InteractRuneId
  'mark-light': MarkId
  'mark-dark': MarkId
}

export type IconKind = keyof IconIds

const ICON_DIR = '/assets/icons'

/**
 * The one place an icon path is built. Items go through ITEM_ICON_URLS (the five journal pages
 * share a file); `mark-light` is for dark HUD surfaces, `mark-dark` for the parchment map.
 */
export function iconUrl<K extends IconKind>(kind: K, id: IconIds[K]): string {
  switch (kind) {
    case 'item':
      return ITEM_ICON_URLS[id as ItemId]
    case 'boon':
      return `${ICON_DIR}/boons/${id}.png`
    case 'boon-rune':
      return `${ICON_DIR}/runes/boons/${id}.png`
    case 'interact-rune':
      return `${ICON_DIR}/runes/interact/${id}.png`
    case 'mark-light':
      return `${ICON_DIR}/marks/${id}-light.png`
    default:
      return `${ICON_DIR}/marks/${id}-dark.png`
  }
}

export function itemIconUrl(id: ItemId): string {
  return iconUrl('item', id)
}

/** The whole graveyard (ground, stones, oaks, crypts, fences) as one Draco GLB in game coordinates. */
export const GRAVEYARD_MODEL_URL = '/assets/models/scene/graveyard.glb'

/** The chapel's inside and outside from the Blender scene (chapel-local space, origin CHAPEL_CENTER). */
export const CHAPEL_INTERIOR_MODEL_URL = '/assets/models/scene/chapel-interior.glb'
export const CHAPEL_EXTERIOR_MODEL_URL = '/assets/models/scene/chapel-exterior.glb'

/** The keeper's hut (hut-local = world), and the props placed in it (spec 09 task 11n-b). */
export const HUT_MODEL_URL = '/assets/models/scene/hut.glb'
export const WORKBENCH_MODEL_URL = '/assets/models/props/workbench.glb'
export const VENDING_MACHINE_MODEL_URL = '/assets/models/props/vending-machine.glb'
export const CLUE_HUT_BOOTS_MODEL_URL = '/assets/models/props/clue-hut-boots.glb'

/** The catacombs (world space) and the gate, door and railing props (spec 09 task 11n-c). */
export const CATACOMBS_MODEL_URL = '/assets/models/scene/catacombs.glb'
export const GATE_CATACOMBS_MODEL_URL = '/assets/models/props/gate-catacombs.glb'
export const GATE_ROW_MODEL_URL = '/assets/models/props/gate-mausoleum-row.glb'
export const OSSUARY_DOOR_MODEL_URL = '/assets/models/props/ossuary-door.glb'
export const IRON_RAILING_MODEL_URL = '/assets/models/props/iron-railing.glb'

/** The remaining Blender props (spec 09 task 11n-d). All are in prop-local space. */
const PROP_DIR = '/assets/models/props'
export const PROP_IDS = [
  'lamp-post',
  'coffin-broken',
  'grave-mound',
  'grave-dug',
  'merchant-cart',
  'statue-mourner',
  'scare-door',
  'candle-stub',
  'grave-hand',
  'woodpile',
  'lodge-table',
  'sabre-plinth',
  // Loaded for the horror pass (spec 11 H4), not placed yet.
  'bat-perched',
  'bat-flying',
  // Stage 3 on the Row: the Crane crypt door, its hearse pin, Elias and the Lowe crypt's tipped lantern.
  'crane-crypt-door',
  'hearse-pin',
  'elias-body',
  'tipped-lantern',
] as const
export type PropId = (typeof PROP_IDS)[number]
export const propModelUrl = (id: PropId): string => `${PROP_DIR}/${id}.glb`

/** A clue spot's model is named after its clue id (props/clue-<clueId>.glb); every clue has one. */
export const clueModelUrl = (clueId: string): string => `${PROP_DIR}/${clueId}.glb`
export const CLUE_MODEL_IDS = [
  'clue-hut-boots',
  'clue-empty-graves',
  'clue-west-hill-glint',
  'clue-ledger-week',
  'clue-row-statues',
  'clue-elias-body',
  'clue-cat-scratches',
  'clue-cat-names',
  'clue-cat-ledger-seal',
] as const

/** Everything the loading screen waits for. */
export function allModelUrls(): string[] {
  return [
    ...PROP_IDS.map(propModelUrl),
    ...CLUE_MODEL_IDS.map(clueModelUrl),
    CATACOMBS_MODEL_URL,
    GATE_CATACOMBS_MODEL_URL,
    GATE_ROW_MODEL_URL,
    OSSUARY_DOOR_MODEL_URL,
    IRON_RAILING_MODEL_URL,
    HUT_MODEL_URL,
    WORKBENCH_MODEL_URL,
    VENDING_MACHINE_MODEL_URL,
    CHAPEL_INTERIOR_MODEL_URL,
    CHAPEL_EXTERIOR_MODEL_URL,
    ...WORLD_MODEL_IDS.map(worldModelUrl),
    ...itemModelUrls(),
    ZOMBIE_MODEL_URL,
    BRUTE_MODEL_URL,
  ]
}
