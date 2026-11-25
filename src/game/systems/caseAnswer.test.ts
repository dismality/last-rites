import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASES, type CaseDef, type FinalQuestionDef } from '../../data/cases'
import { checkAccusation, checkFinalAnswer, checkTypedAnswer, fillSlot, isAnswerComplete, normalizeAnswer, typedAskReply } from './caseAnswer'

// Case 1 is typed (no slots); the slot properties run on the others.
const SLOTTED = CASES.filter((c) => !c.final.typed)
const caseArb = fc.constantFrom<CaseDef>(...SLOTTED)

/** A combination of options, one per slot, as indexes into each slot's option list. */
const picks = (q: FinalQuestionDef) =>
  fc.tuple(...q.slots.map((s) => fc.nat({ max: s.options.length - 1 })))

describe('caseAnswer', () => {
  it('accepts the data answer and rejects empty, short and long answers', () => {
    const c = SLOTTED[0]
    expect(checkFinalAnswer(c, c.final.answer)).toBe(true)
    expect(checkFinalAnswer(c, c.final.answer.map(() => null))).toBe(false)
    expect(checkFinalAnswer(c, c.final.answer.slice(1))).toBe(false)
    expect(checkFinalAnswer(c, [...c.final.answer, 'x'])).toBe(false)
  })

  it('reads a typed answer without case, spaces or punctuation', () => {
    expect(normalizeAnswer('  J. Vane ')).toBe('jvane')
    expect(normalizeAnswer('J.V.')).toBe('jv')
    expect(normalizeAnswer('The Undertaker')).toBe('undertaker')
    expect(normalizeAnswer('Vane & Sons')).toBe('vaneandsons')
    expect(normalizeAnswer('the')).toBe('the')
    const c1 = CASES[0]
    expect(checkFinalAnswer(c1, [], 'JOSIAH VANE')).toBe(true)
    expect(checkFinalAnswer(c1, [], 'Pell')).toBe(false)
    expect(isAnswerComplete(c1.final, [], '')).toBe(false)
    expect(isAnswerComplete(c1.final, [], 'x')).toBe(true)
    // A question with slots is never typed.
    expect(checkTypedAnswer(SLOTTED[0].final, 'anything')).toBe(false)
  })

  it('only stage 3 has an accusation', () => {
    expect(checkAccusation(CASES[0], CASES[0].final.answer)).toBe(false)
    const c3 = CASES[2]
    expect(checkAccusation(c3, [], 'Silas Vane')).toBe(true)
    expect(checkAccusation(c3, [], 'the son')).toBe(true)
    expect(checkAccusation(c3, [], 'Josiah Vane')).toBe(false)
    expect(typedAskReply(c3.accusation!, 'vane')).toBe('Which Vane?')
    expect(typedAskReply(c3.accusation!, 'Silas')).toBeNull()
  })

  it('fillSlot fills, clears and ignores options the slot does not offer', () => {
    const q = SLOTTED[0].final
    const empty = q.slots.map(() => null)
    const a = fillSlot(q, empty, 0, q.slots[0].options[1])
    expect(a[0]).toBe(q.slots[0].options[1])
    expect(isAnswerComplete(q, a)).toBe(false)
    expect(fillSlot(q, a, 0, 'not an option')).toBe(a)
    expect(fillSlot(q, a, 9, q.slots[0].options[0])).toBe(a)
    expect(fillSlot(q, a, 0, null)[0]).toBeNull()
    const full = q.slots.reduce((acc, s, i) => fillSlot(q, acc, i, s.options[0]), empty as (string | null)[] as readonly (string | null)[])
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
})
