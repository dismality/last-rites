// Ending camera sequences and closing lines (design bible §1, Req 6.1).
// Pure data. Camera positions and look targets are control points of two Catmull-Rom curves
// sampled with the same parameter. The chapel sits at (10, 0, 5) with its altar at z = 9.5.

import type { EndingId } from '../game/types'

export type Vec3 = readonly [number, number, number]

export interface EndingLine {
  /** Seconds from the start of the sequence. */
  at: number
  /** Seconds the line stays up. */
  hold: number
  text: string
}

export interface EndingDef {
  id: EndingId
  title: string
  /** Seconds. Never more than MAX_ENDING_SECONDS. */
  duration: number
  camera: { position: readonly Vec3[]; target: readonly Vec3[] }
  lines: readonly EndingLine[]
  /** The last line of the sequence, repeated large on the summary card. */
  closingLine: string
  /** Sky the sequence plays under. */
  sky: 'dawn' | 'night'
  /** Camera shake amplitude in metres at full intensity (0 = steady). */
  shake: number
}

/** Req 6.1: a sequence never runs longer than this. */
export const MAX_ENDING_SECONDS = 45

export const ENDINGS: readonly EndingDef[] = [
  {
    id: 'rest',
    title: 'Rest',
    duration: 44,
    sky: 'dawn',
    shake: 0,
    camera: {
      position: [
        [10, 1.6, 4],
        [10, 2.0, 6.5],
        [12, 4, 13],
        [14, 9, 23],
        [4, 14, 34],
      ],
      target: [
        [10, 1.2, 9.5],
        [10, 1.6, 9.5],
        [10, 3, 8],
        [10, 2, 5],
        [0, 1, 0],
      ],
    },
    lines: [
      { at: 1, hold: 8, text: 'The last name is spoken. The altar candle does not gutter.' },
      { at: 11, hold: 9, text: 'Under the grass, thirty-one breaths let go at once.' },
      { at: 22, hold: 9, text: '"Thank you, keeper," says a voice with Elias in it.' },
      { at: 33, hold: 10, text: 'Dawn comes over Hollowmere, and the dead lie down.' },
    ],
    closingLine: 'Dawn comes over Hollowmere, and the dead lie down.',
  },
  {
    id: 'uneasy-peace',
    title: 'Uneasy Peace',
    duration: 45,
    sky: 'dawn',
    shake: 0,
    camera: {
      position: [
        [10, 1.6, 6],
        [4, 2.5, 14],
        [-12, 3, 12],
        [-26, 2.5, 8],
        [-33, 1.4, 8],
      ],
      target: [
        [10, 1.2, 9.5],
        [0, 1, 10],
        [-25, 0.5, 8],
        [-35, 0.3, 8],
        [-36, 0.2, 8],
      ],
    },
    lines: [
      { at: 1, hold: 8, text: 'The rite holds. The bell clapper hangs still, for now.' },
      { at: 12, hold: 9, text: 'Most of the dead are quiet. Most.' },
      { at: 23, hold: 10, text: 'On the west hill, one small grave keeps its own time.' },
      { at: 34, hold: 10, text: 'You write "unfinished" in the ledger, and you stay.' },
    ],
    closingLine: 'You write "unfinished" in the ledger, and you stay.',
  },
  {
    id: 'taken',
    title: 'Taken',
    duration: 42,
    sky: 'night',
    shake: 0.02,
    camera: {
      position: [
        [10, 1.6, 4],
        [10, 1.3, 6],
        [10, 1.0, 8.5],
        [10, 0.7, 10],
      ],
      target: [
        [10, 1.2, 9.5],
        [10, 0.6, 9.5],
        [10, 0.2, 9.5],
        [10, 0, 9.5],
      ],
    },
    lines: [
      { at: 1, hold: 8, text: 'Dawn finds the cemetery quiet and the rite undone.' },
      { at: 13, hold: 10, text: 'The ledger has a new line, in a hand you almost know.' },
      { at: 25, hold: 7, text: 'Your name. Today\'s date. "Buried."' },
      { at: 34, hold: 8, text: 'Somewhere above, the bell begins to ring for someone else.' },
    ],
    closingLine: 'Somewhere above, the bell begins to ring for someone else.',
  },
]

export const ENDING_MAP: Readonly<Record<EndingId, EndingDef>> = Object.fromEntries(
  ENDINGS.map((e) => [e.id, e]),
) as Readonly<Record<EndingId, EndingDef>>
