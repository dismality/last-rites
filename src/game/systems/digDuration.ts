import { DIG_DURATION_S } from '../../data/digging'

/** Live dig time in seconds: the base duration scaled by the Gravedigger multiplier. */
export function liveDigDuration(digTimeMult: number): number {
  return DIG_DURATION_S * digTimeMult
}

/** Elapsed seconds shown beside the dig bar for a 0-1 progress. */
export function digElapsedS(progress: number, digTimeMult: number): number {
  return progress * liveDigDuration(digTimeMult)
}
