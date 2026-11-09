// Asset paths. Everything under public/assets/ is addressed from here so no
// scene file hard-codes a URL. Pure data: no React / three.js imports.

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

/** Everything the loading screen waits for. */
export function allModelUrls(): string[] {
  return [
    ...WORLD_MODEL_IDS.map(worldModelUrl),
    ...itemModelUrls(),
    ZOMBIE_MODEL_URL,
    BRUTE_MODEL_URL,
  ]
}
