// Night / wave definitions — source of truth mirrored from docs/game-design.md §8.
// Pure data: no logic, no side effects.

import type { WaveEnemyId } from './enemies'
import { fogOfLadderRow } from './stages'

export type NightNumber = 1 | 2 | 3 | 4 | 5

export type WaveComposition = Record<WaveEnemyId, number>

export interface NightDef {
  night: NightNumber
  /** Exponential fog density for this night. */
  fog: number
  waves: readonly WaveComposition[]
  /** Night 5 ends with the relic ritual at the altar. */
  finalRite?: boolean
}

/** Seconds between a wave being cleared and the next one starting. */
export const WAVE_GAP = 15
/** Zombies never spawn closer than this to the player (metres). */
export const SPAWN_MIN_DISTANCE = 15
/** Each spawn lands within this many metres of its grave centre on both axes. */
export const SPAWN_JITTER_M = 1.5
/** Maximum zombies alive at once; extra spawns queue until there is room. */
export const LIVE_ENEMY_CAP = 14

/** A grave that bursts open at night. Ground-plane position (x, z), inside the walled grounds. */
export interface WaveGrave {
  id: string
  x: number
  z: number
}

/** Spread around the grounds so some are always 15 m+ from the player. */
export const WAVE_GRAVES: readonly WaveGrave[] = [
  { id: 'wg-northwest', x: -30, z: -22 },
  { id: 'wg-north', x: 2, z: -34 },
  { id: 'wg-northeast', x: 30, z: -26 },
  { id: 'wg-west', x: -35, z: 8 },
  { id: 'wg-east', x: 34, z: 14 },
  { id: 'wg-southwest', x: -26, z: 30 },
  { id: 'wg-south', x: -2, z: 35 },
  { id: 'wg-southeast', x: 28, z: 32 },
]

/** Base composition: the §8 columns that existed before spec 07. */
const wave = (shambler: number, wailer = 0, lurker = 0): WaveComposition => ({
  shambler,
  wailer,
  lurker,
  bloater: 0,
  brute: 0,
})

const repeat = (count: number, w: WaveComposition): WaveComposition[] =>
  Array.from({ length: count }, () => ({ ...w }))

/**
 * Base rows (shambler, wailer, lurker only), kept literally equal to the §8 base columns.
 * Since spec 10 these are the difficulty ladder: `night` is a ladder row and its fog comes from
 * the Stage data in `stages.ts`. Endless Survival still plays them as nights.
 */
const BASE_NIGHTS: readonly NightDef[] = [
  { night: 1, fog: fogOfLadderRow(1), waves: repeat(2, wave(4)) },
  // The wailer joins the last wave only.
  { night: 2, fog: fogOfLadderRow(2), waves: [wave(5), wave(5), wave(5, 1)] },
  { night: 3, fog: fogOfLadderRow(3), waves: repeat(3, wave(6, 1, 1)) },
  { night: 4, fog: fogOfLadderRow(4), waves: repeat(4, wave(6, 2, 2)) },
  { night: 5, fog: fogOfLadderRow(5), waves: repeat(5, wave(8, 2, 2)), finalRite: true },
]

const NONE: Partial<WaveComposition> = {}

/** §8 "Added in spec 07" column, indexed by wave. Missing waves add nothing. */
export const WAVE_ADDITIONS: Readonly<Record<NightNumber, readonly Partial<WaveComposition>[]>> = {
  1: [],
  2: [],
  3: [NONE, NONE, { bloater: 1 }],
  4: [NONE, NONE, NONE, { bloater: 1, brute: 1 }],
  5: [NONE, NONE, NONE, { bloater: 2, brute: 1 }, { bloater: 2, brute: 1 }],
}

/** Additions for a night; empty outside nights 1..5. */
export function waveAdditions(night: number): readonly Partial<WaveComposition>[] {
  return WAVE_ADDITIONS[night as NightNumber] ?? []
}

export const NIGHTS: readonly NightDef[] = BASE_NIGHTS.map((n) => ({
  ...n,
  waves: n.waves.map((w, i) => {
    const add = waveAdditions(n.night)[i] ?? NONE
    return { ...w, bloater: w.bloater + (add.bloater ?? 0), brute: w.brute + (add.brute ?? 0) }
  }),
}))

/** The pre-spec-07 compositions, for tests that pin the base columns. */
export const BASE_WAVES: Readonly<Record<NightNumber, readonly WaveComposition[]>> =
  Object.fromEntries(BASE_NIGHTS.map((n) => [n.night, n.waves])) as Readonly<
    Record<NightNumber, readonly WaveComposition[]>
  >
export const NIGHT_MAP: Readonly<Record<NightNumber, NightDef>> = Object.fromEntries(
  NIGHTS.map((n) => [n.night, n]),
) as Readonly<Record<NightNumber, NightDef>>

/** Total enemies a wave spawns. */
export function waveSize(w: WaveComposition): number {
  return w.shambler + w.wailer + w.lurker + w.bloater + w.brute
}
