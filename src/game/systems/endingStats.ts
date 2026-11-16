// The win card's rows (spec 10 task 6.3, Req 1.4): how far the run got through the curse stages
// and the cases. Pure; the summary's full stat list stays in runStats.ts.

import { STAGE_COUNT } from '../../data/stages'
import { CASES } from '../../data/cases'
import type { EndingId } from '../types'
import type { SummaryRow } from './runStats'

export interface EndingProgress {
  ending: EndingId
  /** The stage the run was on when it ended (1..STAGE_COUNT). */
  stage: number
  /** Cases on the closed list. */
  casesSolved: number
}

/** Stages cleared: a won run cleared all of them; otherwise the ones before the stage it fell on. */
export function stagesCleared(p: Pick<EndingProgress, 'ending' | 'stage'>): number {
  if (p.ending === 'rest') return STAGE_COUNT
  const stage = Number.isFinite(p.stage) ? Math.floor(p.stage) : 1
  return Math.min(Math.max(stage - 1, 0), STAGE_COUNT)
}

export function endingProgressRows(p: EndingProgress): SummaryRow[] {
  const solved = Number.isFinite(p.casesSolved) ? Math.min(Math.max(Math.floor(p.casesSolved), 0), CASES.length) : 0
  return [
    { label: 'Stages cleared', value: `${stagesCleared(p)} of ${STAGE_COUNT}` },
    { label: 'Cases solved', value: `${solved} of ${CASES.length}` },
  ]
}
