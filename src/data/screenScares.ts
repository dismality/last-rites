// Screen jumpscares (spec 11 H1, design bible §14.1): full-screen faces at earned moments.
// Mirrors the bible tables; if they differ the bible wins. The rules live in
// src/game/systems/screenScares.ts.

import { type ScareFaceId } from './assets'

export type ScareSetId = 'zombie-bottom' | 'ghost-top'
export type ScareEdge = 'bottom' | 'top'

export interface ScareSet {
  id: ScareSetId
  edge: ScareEdge
  faces: readonly ScareFaceId[]
}

export const SCARE_SETS: Readonly<Record<ScareSetId, ScareSet>> = {
  'zombie-bottom': {
    id: 'zombie-bottom',
    edge: 'bottom',
    faces: ['face-zombie-1', 'face-zombie-2', 'face-crawler'],
  },
  'ghost-top': { id: 'ghost-top', edge: 'top', faces: ['ghost-bride-1', 'ghost-bride-2'] },
}

export const SCARE_SET_IDS = Object.keys(SCARE_SETS) as ScareSetId[]

export type ScareTriggerId = 'crawler' | 'bride' | 'coffin-night-2' | 'hut-window-night-3' | 'ossuary-grille'

/** Which face set each trigger uses (design bible §14.1 trigger table). */
export const TRIGGER_SETS: Readonly<Record<ScareTriggerId, ScareSetId>> = {
  crawler: 'zombie-bottom',
  bride: 'ghost-top',
  'coffin-night-2': 'zombie-bottom',
  'hut-window-night-3': 'zombie-bottom',
  'ossuary-grille': 'ghost-top',
}

export interface ScriptedMoment {
  id: Extract<ScareTriggerId, 'coffin-night-2' | 'hut-window-night-3' | 'ossuary-grille'>
  set: ScareSetId
  /** Stage the moment belongs to; undefined means any stage. */
  stage?: 1 | 2 | 3
  /** Needs the stage's night (not dusk or day). */
  nightOnly: boolean
  /** Each scripted moment is used once per save. */
  oncePerSave: true
  /** What the player does to cause it. */
  when: string
}

export const SCRIPTED_MOMENTS: readonly ScriptedMoment[] = [
  {
    id: 'coffin-night-2',
    set: 'zombie-bottom',
    stage: 2,
    nightOnly: true,
    oncePerSave: true,
    when: 'Opening the marked broken coffin',
  },
  {
    id: 'hut-window-night-3',
    set: 'zombie-bottom',
    stage: 3,
    nightOnly: true,
    oncePerSave: true,
    when: "Looking out of the hut's west window; the face presses against the glass",
  },
  {
    id: 'ossuary-grille',
    set: 'ghost-top',
    nightOnly: false,
    oncePerSave: true,
    when: "Looking through the ossuary door's grille the first time",
  },
]

/**
 * Where each scripted moment fires (world metres, XZ plane). `radius` is how close the player must
 * be; `facing` (unit XZ vector) and `facingConeDeg` say where they must look. Tunable placement:
 * the hut's west window sits on the west wall, the grille in the ossuary door (gateHints.ts).
 */
export interface MomentSite {
  position: readonly [number, number]
  radius: number
  facing?: readonly [number, number]
  facingConeDeg?: number
}

export const MOMENT_SITES: Readonly<Record<ScriptedMoment['id'], MomentSite>> = {
  // The marked broken coffin is the east one on the grounds (zones.ts `grounds-coffin-east`).
  'coffin-night-2': { position: [28, -12], radius: 3 },
  'hut-window-night-3': { position: [-3, 0], radius: 2.2, facing: [-1, 0], facingConeDeg: 40 },
  // Corridor x 25, door at z 55.6; the player looks in from the south side (+z).
  'ossuary-grille': { position: [25, 55.6], radius: 3, facing: [0, 1], facingConeDeg: 35 },
}

/** A pending scare that stayed held by an overlay this long after its time is dropped. */
export const SCREEN_SCARE_QUEUE_EXPIRY_S = 30

/** Sim time between the starts of two screen scares. */
export const SCREEN_SCARE_COOLDOWN_S = 180
/** Gap after any major scare (design bible §9), applied on top of the cooldown. */
export const SCREEN_SCARE_MAJOR_GAP_S = 45

/** Phase lengths in ms. "In" has no easing. */
export const SCREEN_SCARE_IN_MS = 70
export const SCREEN_SCARE_OUT_MS = 250
export const SCREEN_SCARE_HOLD_MIN_MS = 550
export const SCREEN_SCARE_HOLD_MAX_MS = 800

/** Image height as a share of the viewport height (85 vh). */
export const SCREEN_SCARE_HEIGHT_VH = 85

/** A telegraph (flicker, creak, breath, music drop) comes 0.5 to 1.5 s before the face. */
export const SCREEN_SCARE_TELEGRAPH_MIN_MS = 500
export const SCREEN_SCARE_TELEGRAPH_MAX_MS = 1500

/** World brightness during the hold at Full, scale jitter range, other-audio duck and its recovery. */
export const SCREEN_SCARE_DIM_BRIGHTNESS = 0.3
export const SCREEN_SCARE_SCALE_MIN = 1.0
export const SCREEN_SCARE_SCALE_MAX = 1.04
export const SCREEN_SCARE_DUCK = 0.7
export const SCREEN_SCARE_DUCK_RECOVER_MS = 250

/** Sting volume at Reduced, relative to Full. */
export const SCREEN_SCARE_REDUCED_STING_GAIN = 0.5

/** How long the subtitle stays with Jumpscares off. */
export const SCREEN_SCARE_OFF_SUBTITLE_S = 3

/** The text on the flat rectangle that stands in for a missing face image (spec 11 Req 1.20). */
/**
 * The stand-in face while the painted images are missing: the developer's hand-drawn grinning face
 * at full contrast, in six differently lit frames (tools/scares/makeFlicker.py). Cycling them in an
 * uneven order makes the face flicker as if alive. Flashing lights off holds the steady frame 0.
 */
export const SCARE_FLICKER = {
  frameUrls: [0, 1, 2, 3, 4, 5].map((i) => `/assets/scares/flicker/frame-${i}.webp`),
  /** How long each step of the sequence shows (ms). */
  frameMs: 45,
  /** Frame index per step; uneven on purpose, with dark gutters (2) and flares (1, 5). */
  sequence: [5, 0, 1, 0, 2, 3, 0, 1, 1, 2, 0, 4, 0, 3, 5, 2, 0, 1, 2, 2, 0, 3, 1, 0],
} as const

export const placeholderFaceLabel = (id: ScareFaceId): string => `PLACEHOLDER ${id}`

