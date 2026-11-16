import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  CASE_1_BELLS,
  CASE_1_LEDGER,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  type BellPostId,
  type LedgerFlagKind,
} from '../../data/cases'
import {
  bellClues,
  bellPosts,
  candidateGraves,
  ledgerFlags,
  type LedgerFlagInput,
} from './caseMinigames'

const rightFlags = (): LedgerFlagInput[] =>
  CASE_1_RIGHT_FLAGS.map((r) => ({
    stoneId: r.stoneId,
    kind: r.kind,
    ledgerId: CASE_1_STONES.find((s) => s.id === r.stoneId)!.ledgerId,
  }))

const kinds: LedgerFlagKind[] = ['date', 'plot', 'certificate']
const postIds: BellPostId[] = CASE_1_BELLS.map((p) => p.id)
const cutId = CASE_1_BELLS.find((p) => p.condition === 'rope-cut')!.id

describe('ledgerFlags (1a)', () => {
  it('accepts the 3 right flags and narrows to 3 graves', () => {
    expect(ledgerFlags(rightFlags())).toEqual({ ok: true })
    expect(candidateGraves()).toHaveLength(3)
  })

  it('is not solved yet with 2 right flags', () => {
    expect(ledgerFlags(rightFlags().slice(0, 2))).toEqual({ ok: false })
  })

  it('rejects a flag on two lines that agree with the message', () => {
    const v = ledgerFlags([{ stoneId: 'marsh', ledgerId: 'l-marsh', kind: 'date' }])
    expect(v).toEqual({ ok: false, firstWrong: 0, message: 'These two agree' })
  })

  // Feature: 10-curse-stages, Property 16: Right answers accepted, wrong answers rejected
  it('Property 16 (1a): only the right flags are accepted, first wrong index reported', () => {
    // Validates: Requirements 12.2, 12.3, 12.4
    const flag = fc.record({
      stoneId: fc.constantFrom(...CASE_1_STONES.map((s) => s.id)),
      ledgerId: fc.constantFrom(...CASE_1_LEDGER.map((l) => l.id)),
      kind: fc.constantFrom(...kinds),
    })
    const isRight = (f: LedgerFlagInput) =>
      CASE_1_STONES.find((s) => s.id === f.stoneId)!.ledgerId === f.ledgerId &&
      CASE_1_RIGHT_FLAGS.some((r) => r.stoneId === f.stoneId && r.kind === f.kind)
    fc.assert(
      fc.property(fc.array(flag, { maxLength: 8 }), (flags) => {
        const v = ledgerFlags(flags)
        const wrong = flags.findIndex((f) => !isRight(f))
        if (wrong >= 0) {
          expect(v.ok).toBe(false)
          expect(v.firstWrong).toBe(wrong)
        } else {
          expect(v.firstWrong).toBeUndefined()
          const all = CASE_1_RIGHT_FLAGS.every((r) =>
            flags.some((f) => f.stoneId === r.stoneId && f.kind === r.kind),
          )
          expect(v.ok).toBe(all)
        }
      }),
      { numRuns: 200 },
    )
    expect(ledgerFlags(rightFlags()).ok).toBe(true)
  })
})

describe('bellPosts (1b)', () => {
  it('pins the cut rope, the rusted bell and the early tag once all posts are examined', () => {
    expect(bellClues(postIds).sort()).toEqual(
      ['ames-bell-rusted', 'pell-rope-cut', 'pell-tag-early'].sort(),
    )
  })

  it('gives no clues before any post is examined', () => {
    expect(bellClues([])).toEqual([])
  })

  it('rejects the wrong post as the cut bell', () => {
    const v = bellPosts({ examined: postIds, cutAnswer: 'bell-hale' })
    expect(v.ok).toBe(false)
    expect(v.firstWrong).toBe(0)
    expect(v.message).toBeTruthy()
  })

  // Feature: 10-curse-stages, Property 16: Right answers accepted, wrong answers rejected
  it('Property 16 (1b): accepted only with the cut post named and all posts examined', () => {
    // Validates: Requirements 13.2, 13.4
    fc.assert(
      fc.property(
        fc.subarray(postIds),
        fc.option(fc.constantFrom(...postIds), { nil: undefined }),
        (examined, cutAnswer) => {
          const v = bellPosts({ examined, cutAnswer })
          const wrongAnswer = cutAnswer !== undefined && cutAnswer !== cutId
          expect(v.ok).toBe(
            !wrongAnswer && cutAnswer === cutId && examined.length === postIds.length,
          )
          if (wrongAnswer) expect(v.firstWrong).toBe(0)
        },
      ),
      { numRuns: 200 },
    )
  })
})
