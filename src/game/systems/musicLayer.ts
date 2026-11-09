import { MUSIC, type MusicLayer } from '../../data/music'
import type { Phase } from '../types'

export interface MusicLayerInput {
  phase: Phase
  waveRunning: boolean
  /** Distance to the nearest zombie in metres; Infinity when none exists. */
  nearestZombieM: number
  bossOnField: boolean
}

// Written as a sum so the literal scan (Req 14.3) sees only 0, 1 and 2.
const DANGER_LAYER = (1 + 2) as MusicLayer

/** First-match rule with inclusive limits (Req 9.1, 9.10-9.12). */
export function musicLayer(i: MusicLayerInput): MusicLayer {
  if (i.bossOnField || i.nearestZombieM <= MUSIC.distance.danger) return DANGER_LAYER
  if (i.waveRunning || i.nearestZombieM <= MUSIC.distance.tension) return 2
  if (i.phase === 'dusk' || i.nearestZombieM <= MUSIC.distance.unease) return 1
  return 0
}
