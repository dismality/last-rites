// Stage step announcements (playtest 11r): when a day step of the stage finishes, its `done` line
// says what was learned and where it points; when a new stage begins, its opening line says where
// the case starts. Pure: the caller shows the lines (the clue reveal) and keeps the state.

import { STAGE_DAY_RULES, STAGE_OPENING } from '../../data/objectiveRules'

export interface StepWatch {
  stage: 1 | 2 | 3
  done: readonly boolean[]
}

/**
 * Lines to show going from `prev` to `now`. The first look (no `prev`) shows nothing, so a load or
 * Continue never replays them. Moving on to a later stage shows its opening line; within a stage,
 * each step that has just finished shows its `done` line, in step order.
 */
export function stepAnnouncements(prev: StepWatch | null, now: StepWatch): string[] {
  if (!prev) return []
  if (now.stage !== prev.stage) {
    const opening = now.stage > prev.stage ? STAGE_OPENING[now.stage] : undefined
    return opening ? [opening] : []
  }
  const rules = STAGE_DAY_RULES[now.stage]
  const out: string[] = []
  now.done.forEach((d, i) => {
    if (d && !prev.done[i] && rules[i]) out.push(rules[i].done)
  })
  return out
}
