// Asset paths. Everything under public/assets/ is addressed from here so no
// scene file hard-codes a URL. Pure data: no React / three.js imports.

import type { ItemId } from '../game/types'
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

/** URLs of every hero item model (keys and relics), taken from items.ts. */
export function itemModelUrls(): string[] {
  return ITEMS.flatMap((i) =>
    i.model && (i.kind === 'key' || i.kind === 'relic') ? [assetUrl(i.model)] : [],
  )
}

/** Rigged zombie shared by all three enemy types (see docs/enemy-models.md). */
export const ZOMBIE_MODEL_URL = '/assets/models/enemies/zombie.glb'

/** Blockier rig for the Brute and Father Crane (see docs/enemy-models.md). */
export const BRUTE_MODEL_URL = '/assets/models/enemies/zombie-brute.glb'

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

export function itemIconUrl(id: ItemId): string {
  return ITEM_ICON_URLS[id]
}

/** Everything the loading screen waits for. */
export function allModelUrls(): string[] {
  return [
    ...WORLD_MODEL_IDS.map(worldModelUrl),
    ...itemModelUrls(),
    ZOMBIE_MODEL_URL,
    BRUTE_MODEL_URL,
  ]
}
