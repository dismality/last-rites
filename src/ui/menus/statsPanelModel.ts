// Pure view-models for the stats panel and the taken screen (no DOM, testable in Node).
import { MODES } from '../../data/modes'
import { statRows, type RunStats, type SummaryRow } from '../../game/systems/runStats'
import type { ModeId } from '../../game/types'

export interface StatsPanelModel {
  rows: SummaryRow[]
  /** Close takes focus so the keyboard can leave the panel at once. */
  closeAutofocus: true
}

export function statsPanelModel(
  stats: RunStats,
  score: number,
  relics: number,
  mode: ModeId,
  endlessBest: number,
): StatsPanelModel {
  const story = MODES[mode].story
  const extra = { score, relics, story, ...(story ? {} : { endlessBest }) }
  return { rows: statRows(stats, extra), closeAutofocus: true }
}

export interface TakenModel {
  showRetry: boolean
  showStats: boolean
}

/** Endless has no Retry Night, so death ends the run and shows its stats. */
export function takenModel(mode: ModeId): TakenModel {
  const story = MODES[mode].story
  return { showRetry: story, showStats: !story }
}
