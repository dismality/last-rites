// The Stage 3 accusation (spec 10 task 4.6, Req 18). Pure rules: when it can be given, what a
// verdict does to the record, and which closing text the run earns. The answer check itself is
// `caseAnswer.checkAccusation`; the altar's verdict is `altarAnswer.giveAnswer(..., 'accusation')`.
// The accusation never changes whether the run is won (Req 18.5).

import { JUSTICE_EPILOGUE, SILAS_DEFAULT_LINE } from '../../data/endings'
import type { Phase } from '../types'

export interface AccusationRecord {
  /** The accusation was put to the altar at least once. */
  given: boolean
  /** It was right. Once right, always right. */
  correct: boolean
}

export const NO_ACCUSATION: AccusationRecord = { given: false, correct: false }

/** It is given at the altar on the last stage's night, while the rite is still open. */
export function accusationOpen(stage: number, phase: Phase, caseSolved: boolean): boolean {
  return stage === 3 && phase === 'night' && !caseSolved
}

/** A judged accusation: a right one sticks, a wrong one only marks it as given. */
export function recordAccusation(prev: AccusationRecord, correct: boolean): AccusationRecord {
  return { given: true, correct: prev.correct || correct }
}

/** The epilogue beats for a right accusation; empty otherwise (Req 18.3). */
export function epilogueLines(rec: AccusationRecord): readonly string[] {
  return rec.correct ? JUSTICE_EPILOGUE : []
}

/** The line the Rest summary shows when the accusation was wrong or never given (Req 18.4). */
export function defaultLine(rec: AccusationRecord): string | null {
  return rec.correct ? null : SILAS_DEFAULT_LINE
}
