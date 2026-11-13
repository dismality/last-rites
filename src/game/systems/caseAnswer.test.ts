import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASES, type CaseDef, type FinalQuestionDef } from '../../data/cases'
import { checkAccusation, checkFinalAnswer, fillSlot, isAnswerComplete } from './caseAnswer'

const caseArb = fc.constantFrom<CaseDef>(...CASES)

/** A combination of options, one per slot, as indexes into each slot's option list. */
const picks = (q: FinalQuestionDef) =>
  fc.tuple(...q.slots.map((s) => fc.nat({ max: s.options.length - 1 })))

describe('caseAnswer', () => {
  it('accepts the data answer and rejects empty, short and long answers', () => {
    const c = CASES[0]
    expect(checkFinalAnswer(c, c.final.answer)).toBe(true)
    expect(checkFinalAnswer(c, c.final.answer.map(() => null))).toBe(false)
    expect(checkFinalAnswer(c, c.final.answer.slice(1))).toBe(false)
    expect(checkFinalAnswer(c, [...c.final.answer, 'x'])).toBe(false)
  })

  it('only stage 3 has an accusation', () => {
    expect(checkAccusation(CASES[0], CASES[0].final.answer)).toBe(false)
    const c3 = CASES[2]
    expect(checkAccusation(c3, c3.accusation!.answer)).toBe(true)
  })

  it('fillSlot fills, clears and ignores options the slot does not offer', () => {
    const q = CASES[0].final
    const empty = q.slots.map(() => null)
    const a = fillSlot(q, empty, 0, q.slots[0].options[1])
    expect(a[0]).toBe(q.slots[0].options[1])
    expect(isAnswerComplete(q, a)).toBe(false)
    expect(fillSlot(q, a, 0, 'not an option')).toBe(a)
    expect(fillSlot(q, a, 9, q.slots[0].options[0])).toBe(a)
    expect(fillSlot(q, a, 0, null)[0]).toBeNull()
    const full = fillSlot(q, fillSlot(q, empty, 0, q.slots[0].options[0]), 1, q.slots[1].options[0])
    expect(isAnswerComplete(q, full)).toBe(true)
  })

  // Feature: 10-curse-stages, Property 16: Right answers accepted, wrong answers rejected
  // **Validates: Requirements 8.8**
  it('Property 16: the right final answer is accepted and every other combination is rejected', () => {
    fc.assert(
      fc.property(
        caseArb.chain((c) => fc.tuple(fc.constant(c), picks(c.final))),
        ([c, idx]) => {
          const answer = idx.map((i, s) => c.final.slots[s].options[i])
          const same = answer.every((o, s) => o === c.final.answer[s])
          expect(checkFinalAnswer(c, answer)).toBe(same)
          expect(checkFinalAnswer(c, c.final.answer)).toBe(true)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('Property 16: the accusation answer is accepted and every other combination is rejected', () => {
    const c = CASES[2]
    const q = c.accusation!
    fc.assert(
      fc.property(picks(q), (idx) => {
        const answer = idx.map((i, s) => q.slots[s].options[i])
        expect(checkAccusation(c, answer)).toBe(answer.every((o, s) => o === q.answer[s]))
      }),
      { numRuns: 200 },
    )
  })
})
