// Every art file the horror pass (spec 11) expects from Claude, as typed rows (design bible §14,
// "Waiting list and placeholders"). The list is complete even while every file is present: the
// build-time check (tests/waitingList.test.ts) compares it with public/assets/, and the runtime
// Waiting_List (game/state/waitingList.ts) registers a row's path the first time its load fails.
// Paths come from data/assets.ts. Pure data.

import {
  BRISK_DRAUGHT_ICON_URL,
  BRISK_DRAUGHT_MODEL_URL,
  BRIDE_MODEL_URL,
  CRAWLER_MODEL_URL,
  HANDS_MODEL_URL,
  HOUND_MODEL_URL,
  LANTERN_COOKIE_URL,
  LANTERN_MODEL_URL,
  SCARE_FACE_IDS,
  VENDING_MACHINE_MODEL_URL,
  propModelUrl,
  scareFaceUrl,
} from './assets'

export type PlaceholderKind = 'model' | 'image' | 'sound' | 'texture'
/** Spec 11 feature ids (requirements.md priority list). */
export type HorrorFeature = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7'

export interface PlaceholderRow {
  /** URL path under the site root, e.g. "/assets/models/items/brisk-draught.glb". */
  readonly path: string
  readonly kind: PlaceholderKind
  /** Who makes the final art. */
  readonly owner: 'claude'
  readonly feature: HorrorFeature
  /** Where it is used, and what stands in while it is missing. */
  readonly use: string
}

const row = (path: string, kind: PlaceholderKind, feature: HorrorFeature, use: string): PlaceholderRow => ({
  path,
  kind,
  owner: 'claude',
  feature,
  use,
})

export const PLACEHOLDERS: readonly PlaceholderRow[] = [
  ...SCARE_FACE_IDS.map((id) =>
    row(scareFaceUrl(id), 'image', 'H1', `screen scare face ${id}; placeholder: a labelled flat rectangle`),
  ),
  row(CRAWLER_MODEL_URL, 'model', 'H2', 'Pale Crawler; placeholder: zombie.glb scaled and tinted'),
  row(BRIDE_MODEL_URL, 'model', 'H2', 'Hollow Bride; placeholder: zombie.glb scaled and tinted'),
  row(HOUND_MODEL_URL, 'model', 'H2', 'Corpse Hound; placeholder: zombie.glb scaled and tinted'),
  row(propModelUrl('bat-perched'), 'model', 'H4', 'perched bat; placeholder: a small dark ellipsoid'),
  row(propModelUrl('bat-flying'), 'model', 'H4', 'flying bat; placeholder: a small dark ellipsoid'),
  row(VENDING_MACHINE_MODEL_URL, 'model', 'H6', 'hut vending machine; placeholder: a plain cabinet with the real collider and handle anchors'),
  row(BRISK_DRAUGHT_MODEL_URL, 'model', 'H6', 'Brisk Draught item; placeholder: a bottle primitive "Brisk Draught (placeholder)"'),
  row(BRISK_DRAUGHT_ICON_URL, 'image', 'H6', `Brisk Draught satchel icon; placeholder: the satchel's "?" box (MISSING_ICON_URL)`),
  row(HANDS_MODEL_URL, 'model', 'H7', "first-person hands; placeholder: today's weapon-only viewmodel"),
  row(LANTERN_MODEL_URL, 'model', 'H7', "held lantern; placeholder: today's weapon-only viewmodel and a fixed light offset"),
  row(LANTERN_COOKIE_URL, 'texture', 'H7', 'lantern spot light cookie; placeholder: a generated soft round texture'),
]

const PATHS = new Set(PLACEHOLDERS.map((r) => r.path))

/** True for a declared spec 11 art path, with or without the leading slash. */
export function isPlaceholderPath(url: string): boolean {
  return PATHS.has(url.startsWith('/') ? url : `/${url}`)
}
