// Endless best score in localStorage. Never throws; a failed write falls back to a session value
// so the stats screen still shows the higher number. Requirements 7.10-7.12.
import { ENDLESS_BEST_KEY } from '../../data/modes'
import { parseBest, updateBest } from '../systems/endless'
import { useEndingStore } from './endingStore'

let sessionBest = 0
let settledRunId: number | null = null

function readStored(): number {
  try {
    return parseBest(localStorage.getItem(ENDLESS_BEST_KEY))
  } catch {
    return 0
  }
}

/** The best known score: storage, or this session's value when storage failed. */
export function readBest(): number {
  return Math.max(readStored(), sessionBest)
}

/**
 * Settles a finished Endless run once per `runId`; later calls for the same run change nothing.
 * Returns the best after settling.
 */
export function settleEndless(
  score: number,
  runId: number = useEndingStore.getState().runId,
): number {
  if (settledRunId === runId) return readBest()
  settledRunId = runId
  const { best, write } = updateBest(readBest(), score)
  if (!write) return best
  sessionBest = Math.max(sessionBest, best)
  try {
    localStorage.setItem(ENDLESS_BEST_KEY, String(best))
  } catch {
    /* the session value keeps the higher best on screen */
  }
  return best
}

/** Test hook: forget the session value and the settled run. */
export function resetEndlessSession(): void {
  sessionBest = 0
  settledRunId = null
}
