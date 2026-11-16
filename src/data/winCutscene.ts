// Win cutscene data (spec 10 task 6, Req 23): the walk from the hut door down the middle of the
// grounds and out of a gate in the south fence (where the intro came in), the narration, a caption
// for every sound, the gate, the sun and the sunrise sky. Pure data; the maths is in
// game/systems/winSequence.ts. World axes: +X east, +Z south; the south fence stands on z = 40.

import type { EndingLine } from './endings'

type Vec3 = readonly [number, number, number]

export interface WinSequenceDef {
  /** Seconds. Req 23.1 asks for 15 to 20. */
  readonly duration: number
  /** Seconds of black at each end. */
  readonly fadeS: number
  /** Eye-height camera path and its look targets, sampled with one parameter (as the endings are). */
  readonly camera: { readonly position: readonly Vec3[]; readonly target: readonly Vec3[] }
  /** Narration, bottom centre. */
  readonly lines: readonly EndingLine[]
  /** One caption for every sound the walk makes (Req 23.6). */
  readonly captions: readonly EndingLine[]
  /** Walking bob and sway in metres; null is the steady dolly (reduced motion or Camera shake off). */
  readonly bob: { readonly lift: number; readonly sway: number; readonly stepsPerS: number } | null
  /** Seconds in: the distant bell tolls (the only synthesised sound; the rest are captions for now). */
  readonly tollAt: number
}

/** The cemetery gate the walk leaves by: the middle of the south fence. Shown only in the cutscene. */
export const WIN_GATE = {
  x: 0,
  z: 40,
  /** Half the opening between the posts. */
  halfWidth: 1.5,
  /** Half the depth cut out of the fence and its stone footing while the gate stands open. */
  halfDepth: 1.2,
  /** Gate posts stand just outside the opening and hide the cut ends of the fence. */
  postHalf: 0.3,
  postHeight: 2.6,
  /** Each leaf swings outward (+Z) to this angle (75°). */
  openAngle: (75 * Math.PI) / 180,
  /** The leaves start to swing this many seconds before the keeper reaches the gate... */
  swingLeadS: 3,
  /** ...and take this long to open. */
  swingS: 2.4,
  /** Time step for finding when the walk reaches the gate line. */
  sampleStepS: 0.05,
} as const

const EYE = 1.65

const CAMERA: WinSequenceDef['camera'] = {
  // From the hut door down the middle of the grounds, through the gate at z = 40, onto the lane.
  position: [
    [0, EYE, 5],
    [0, EYE, 13],
    [0, EYE, 22],
    [0, EYE, 31],
    [0, EYE, 38],
    [0, EYE, 44],
    [0.6, EYE + 0.05, 49],
  ],
  // Straight down the path, then the head lifts and turns toward the sun over the hills.
  target: [
    [0, 1.5, 25],
    [0, 1.5, 33],
    [0, 1.6, 42],
    [0, 1.8, 50],
    [2, 2.4, 58],
    [8, 5, 66],
    [15, 9, 70],
  ],
}

const LINES: readonly EndingLine[] = [
  { at: 1.5, hold: 4.5, text: 'The fog thins as the sun climbs over Hollowmere.' },
  { at: 7, hold: 4.5, text: 'Behind you, the graves are only graves again.' },
  { at: 13, hold: 4, text: 'The lane is empty. You do not look back.' },
]

const CAPTIONS: readonly EndingLine[] = [
  { at: 0.6, hold: 4, text: '[birdsong, far off]' },
  { at: 4.8, hold: 4, text: '[footsteps on wet grass]' },
  { at: 9.6, hold: 2.6, text: '[the iron gate creaks open]' },
  { at: 12.4, hold: 3.6, text: '[a church bell tolls once, far away]' },
  { at: 16.2, hold: 1.8, text: '[wind in the hedgerow]' },
]

/** Full motion: a gentle walking bob and sway. */
export const WIN_SEQUENCE: WinSequenceDef = {
  duration: 18,
  fadeS: 1,
  camera: CAMERA,
  lines: LINES,
  captions: CAPTIONS,
  bob: { lift: 0.035, sway: 0.02, stepsPerS: 1.8 },
  tollAt: 12.4,
}

/** Reduced motion or Camera shake off (Req 23.5): slow fades and a steady dolly, no bob or sway. */
export const WIN_SEQUENCE_STILL: WinSequenceDef = {
  ...WIN_SEQUENCE,
  fadeS: 2.5,
  bob: null,
}

/**
 * The sun the walk sees rise: a disc low in the south-east, beyond the hills, climbing as the walk
 * goes on. Far enough that the walk barely changes its bearing.
 */
export const WIN_SUN = { x: 48, z: 110, radius: 5.5, fromY: -4, toY: 30, color: '#ffd9a3' } as const

/** Sunrise look the walk blends into: warm sky, brighter light, fog thinned to a quarter. */
export const SUNRISE_LOOK = {
  sky: '#d6b48f',
  ambientColor: '#f4e0c4',
  ambientIntensity: 1.3,
  moonIntensity: 0.75,
  fogScale: 0.25,
} as const
