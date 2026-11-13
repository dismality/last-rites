import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LAST_NIGHT, NIGHT_FOG_DENSITY } from './balance'
import { CAPTIONS } from './captions'
import { STAGE_DAY_RULES } from './objectiveRules'
import { RECIPE_MAP } from './recipes'
import {
  fogOfLadderRow,
  LADDER_ROW_COUNT,
  STAGE_COUNT,
  STAGE_MAP,
  STAGES,
  type StageNumber,
} from './stages'
import { NIGHTS } from './waves'

describe('stage data (design bible §8, §13)', () => {
  it('has three stages with the bible cap, stamina and case', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT)
    expect(STAGES.map((s) => s.aliveCap)).toEqual([12, 16, 20])
    expect(STAGES.map((s) => s.maxStamina)).toEqual([100, 90, 80])
    expect(STAGES.map((s) => s.caseId)).toEqual([
      'saved-by-the-bell',
      'resurrection-men',
      'sealed-catacombs',
    ])
  })

  it('maps ladder rows to stages 1-2, 3-4, 5 with the bible fog', () => {
    expect(STAGES.map((s) => s.ladderRows)).toEqual([[1, 2], [3, 4], [5]])
    expect(NIGHT_FOG_DENSITY).toEqual([0.02, 0.03, 0.04, 0.05, 0.06])
    expect(LAST_NIGHT).toBe(LADDER_ROW_COUNT)
    expect(NIGHTS.map((n) => n.fog)).toEqual(NIGHT_FOG_DENSITY)
  })

  it('unlocks the bible recipes at the stage dawns, and only real recipes', () => {
    expect(STAGE_MAP[1].dawnUnlocks).toEqual(['r-sharpened-shovel', 'r-holy-water-flask', 'r-lantern-trap'])
    expect(STAGE_MAP[2].dawnUnlocks).toEqual(['r-nail-bomb', 'r-blessed-rounds'])
    expect(STAGE_MAP[3].dawnUnlocks).toEqual([])
    for (const s of STAGES) for (const r of s.dawnUnlocks) expect(RECIPE_MAP[r]).toBeDefined()
  })

  it('keeps fog and stamina from rising between stages (property)', () => {
    // Feature: 10-curse-stages, data check: stage tables are monotonic
    fc.assert(
      fc.property(fc.constantFrom<StageNumber>(1, 2), (n) => {
        const a = STAGE_MAP[n]
        const b = STAGE_MAP[(n + 1) as StageNumber]
        expect(b.maxStamina).toBeLessThanOrEqual(a.maxStamina)
        expect(b.aliveCap).toBeGreaterThan(a.aliveCap)
        expect(fogOfLadderRow(b.ladderRows[0])).toBeGreaterThan(fogOfLadderRow(a.ladderRows[0]))
      }),
      { numRuns: 100 },
    )
  })

  it('has day rules for every stage and altar captions', () => {
    expect(STAGE_DAY_RULES[1]).toHaveLength(2)
    expect(STAGE_DAY_RULES[2]).toHaveLength(3)
    expect(STAGE_DAY_RULES[3]).toHaveLength(3)
    expect(CAPTIONS.find((c) => c.id === 'altar-wrong')?.text).toBe('[a sour note from the altar]')
    for (const id of ['altar-wrong', 'altar-locked', 'altar-solved']) {
      expect(CAPTIONS.some((c) => c.id === id)).toBe(true)
    }
  })
})
