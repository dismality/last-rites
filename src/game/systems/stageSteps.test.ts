import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { STAGE_DAY_RULES, STAGE_OPENING } from '../../data/objectiveRules'
import { stepAnnouncements } from './stageSteps'

const stages = [1, 2, 3] as const

describe('stage step announcements', () => {
  it('says nothing on the first look, so a load never replays a line', () => {
    expect(stepAnnouncements(null, { stage: 2, done: [true, true, false] })).toEqual([])
  })

  it('shows the done line of each step that has just finished, in order', () => {
    const rules = STAGE_DAY_RULES[2]
    const none = rules.map(() => false)
    const two = none.map((_, i) => i < 2)
    expect(stepAnnouncements({ stage: 2, done: none }, { stage: 2, done: two })).toEqual([rules[0].done, rules[1].done])
    // Nothing new: nothing said.
    expect(stepAnnouncements({ stage: 2, done: two }, { stage: 2, done: two })).toEqual([])
  })

  it('opens a later stage with its line, and never one when going back', () => {
    expect(stepAnnouncements({ stage: 1, done: [true, true] }, { stage: 2, done: [] })).toEqual([STAGE_OPENING[2]])
    expect(stepAnnouncements({ stage: 3, done: [] }, { stage: 1, done: [] })).toEqual([])
  })

  it('every line it can show is a done line or an opening line', () => {
    const known = new Set<string>([
      ...stages.flatMap((s) => STAGE_DAY_RULES[s].map((r) => r.done)),
      ...Object.values(STAGE_OPENING),
    ])
    fc.assert(
      fc.property(
        fc.constantFrom(...stages),
        fc.constantFrom(...stages),
        fc.array(fc.boolean(), { maxLength: 8 }),
        fc.array(fc.boolean(), { maxLength: 8 }),
        (a, b, da, db) => {
          for (const line of stepAnnouncements({ stage: a, done: da }, { stage: b, done: db })) {
            expect(known.has(line)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
