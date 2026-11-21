// Dusk warnings (playtest 11r): which warnings the day clock passed between two ticks. Pure; the
// progression tick keeps the last reading and plays what comes back.
import { DUSK_WARNINGS, type DuskWarningDef } from '../../data/duskWarnings'

/**
 * Warnings whose mark lies in (nowLeftS, prevLeftS]: seconds of day left going down past it. The
 * first reading (`prevLeftS` null), a clock that went up (a new day, a load) or a day shorter than
 * the mark sound nothing, so a warning never plays out of turn.
 */
export function duskWarningsCrossed(
  prevLeftS: number | null,
  nowLeftS: number,
  warnings: readonly DuskWarningDef[] = DUSK_WARNINGS,
): DuskWarningDef[] {
  if (prevLeftS === null || nowLeftS >= prevLeftS) return []
  return warnings.filter((w) => prevLeftS > w.leftS && nowLeftS <= w.leftS)
}
