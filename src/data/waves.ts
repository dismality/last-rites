// Night / wave definitions — source of truth mirrored from docs/game-design.md §8.
// Pure data: no logic, no side effects.

import type { EnemyId } from './enemies'

export type NightNumber = 1 | 2 | 3 | 4 | 5

export type WaveComposition = Record<EnemyId, number>

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

const wave = (shambler: number, wailer = 0, lurker = 0): WaveComposition => ({
  shambler,
  wailer,
  lurker,
})

const repeat = (count: number, w: WaveComposition): WaveComposition[] =>
  Array.from({ length: count }, () => ({ ...w }))

export const NIGHTS: readonly NightDef[] = [
  { night: 1, fog: 0.02, waves: repeat(2, wave(4)) },
  // The wailer joins the last wave only.
  { night: 2, fog: 0.03, waves: [wave(5), wave(5), wave(5, 1)] },
  { night: 3, fog: 0.04, waves: repeat(3, wave(6, 1, 1)) },
  { night: 4, fog: 0.05, waves: repeat(4, wave(6, 2, 2)) },
  { night: 5, fog: 0.06, waves: repeat(5, wave(8, 2, 2)), finalRite: true },
]

export const NIGHT_MAP: Readonly<Record<NightNumber, NightDef>> = Object.fromEntries(
  NIGHTS.map((n) => [n.night, n]),
) as Readonly<Record<NightNumber, NightDef>>

/** Total enemies a wave spawns. */
export function waveSize(w: WaveComposition): number {
  return w.shambler + w.wailer + w.lurker
}
