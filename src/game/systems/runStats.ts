// Run statistics shown after an ending (Req 6.2). Pure and immutable.

import { LAST_NIGHT } from '../../data/balance'
import type { EndingId } from '../types'

export interface RunStats {
  nightsSurvived: number
  zombiesBanished: number
}

export interface SummaryRow {
  label: string
  value: string
}

export function createRunStats(): RunStats {
  return { nightsSurvived: 0, zombiesBanished: 0 }
}

export function recordBanished(s: RunStats): RunStats {
  return { ...s, zombiesBanished: s.zombiesBanished + 1 }
}

/** Dawn of night N means N nights survived. Never goes backwards (a retried night is not counted twice). */
export function recordNightSurvived(s: RunStats, night: number): RunStats {
  const n = Math.min(Math.max(Math.floor(night), 0), LAST_NIGHT)
  return n > s.nightsSurvived ? { ...s, nightsSurvived: n } : s
}

/** Completing the rite means night 5 was survived; the Taken ending does not. */
export function finalizeStats(s: RunStats, ending: EndingId): RunStats {
  return ending === 'taken' ? s : recordNightSurvived(s, LAST_NIGHT)
}

export function summaryRows(
  s: RunStats,
  relicCount: number,
  cluesFound: number,
  totalClues: number,
): SummaryRow[] {
  return [
    { label: 'Nights survived', value: `${s.nightsSurvived} of ${LAST_NIGHT}` },
    { label: 'Zombies banished', value: String(s.zombiesBanished) },
    { label: 'Relics', value: `${relicCount} of 5` },
    { label: 'Clues found', value: `${cluesFound} of ${totalClues}` },
  ]
}
