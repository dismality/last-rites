import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOUBT_MAX } from '../../data/stages'
import { addDoubt } from './stageWaves'
import {
  INITIAL_DOUBT,
  SHARP_EYE_BONUS,
  applyDoubt,
  doubtForNight,
  sharpEye,
  type DoubtState,
} from './caseScore'

describe('caseScore', () => {
  it('doubt grows by one a wrong answer and starts again on a new night', () => {
    const a = applyDoubt(applyDoubt(INITIAL_DOUBT, 1), 1)
    expect(a.doubt).toBe(2)
    expect(applyDoubt(a, 2)).toEqual({ nightId: 2, doubt: 1 })
    expect(doubtForNight(a, 2)).toBe(0)
  })

  it('sharp eye is 300 for a clean case', () => {
    expect(sharpEye({ hintsUsed: 0, wrongAnswers: 0 })).toBe(SHARP_EYE_BONUS)
    expect(sharpEye({ hintsUsed: 1, wrongAnswers: 0 })).toBe(0)
  })

  // Feature: 10-curse-stages, Property 14: Doubt is capped
  // **Validates: Requirements 9.4, 9.5**
  it('Property 14: doubt never exceeds 3 and the first wave gains that many Shamblers', () => {
    const base = { shambler: 4, wailer: 0, lurker: 0, bloater: 0, brute: 0 }
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 1, max: 3 }), (wrong, night) => {
        let d: DoubtState = INITIAL_DOUBT
        for (let i = 0; i < wrong; i++) d = applyDoubt(d, night)
        const doubt = doubtForNight(d, night)
        expect(doubt).toBe(Math.min(DOUBT_MAX, wrong))
        expect(addDoubt(base, doubt).shambler - base.shambler).toBe(doubt)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: 10-curse-stages, Property 15: Sharp Eye only for a clean case
  // **Validates: Requirements 9.6, 9.9**
  it('Property 15: sharp eye is 300 only with no hint and no wrong answer', () => {
    fc.assert(
      fc.property(fc.nat({ max: 5 }), fc.nat({ max: 20 }), (hintsUsed, wrongAnswers) => {
        const clean = hintsUsed === 0 && wrongAnswers === 0
        expect(sharpEye({ hintsUsed, wrongAnswers })).toBe(clean ? 300 : 0)
      }),
      { numRuns: 100 },
    )
  })
})
