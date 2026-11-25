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
  handwritingSolved,
  hymnAnswer,
  hymnTiles,
  ledgerFlags,
  type LedgerFlagInput,
} from './caseMinigames'
import { CASE_3_HAND_SAMPLES, type HandSampleId } from '../../data/cases'
import { CASE_2_BOOTS, CASE_2_CRESTS, CASE_2_FRESH_GRAVES } from '../../data/cases'
import { bootMatch, crestTurns, isRightRegisterMark, registerSolved } from './caseMinigames'

const rightFlags = (): LedgerFlagInput[] =>
  CASE_1_RIGHT_FLAGS.map((r) => ({
    stoneId: r.stoneId,
    kind: r.kind,
    ledgerId: CASE_1_STONES.find((s) => s.id === r.stoneId)!.ledgerId,
  }))

const kinds: LedgerFlagKind[] = ['date', 'plot', 'cause']
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
      ['two-bells-ring', 'pell-rope-cut', 'pell-tag-early'].sort(),
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

describe('hymnTiles (3a)', () => {
  it('reads B, E, L, O, W from the psalter and accepts them', () => {
    expect(hymnAnswer().join('')).toBe('BELOW')
    expect(hymnTiles(['B', 'E', 'L', 'O', 'W'])).toEqual({ ok: true })
    expect(hymnTiles(['b', 'e', 'l', 'o', 'w'])).toEqual({ ok: true })
  })

  it('rejects other letters, reporting the first wrong tile and the message', () => {
    expect(hymnTiles(['B', 'E', 'X', 'O', 'W'])).toEqual({
      ok: false,
      firstWrong: 2,
      message: 'The tiles do not sit true',
    })
    expect(hymnTiles([null, null, null, null, null]).firstWrong).toBe(0)
  })

  // Feature: 10-curse-stages, Property 16: Right answers accepted, wrong answers rejected
  it('Property 16 (3a): accepted only for the right five letters', () => {
    // Validates: Requirements 15.2, 15.3
    const tile = fc.option(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      nil: null,
    })
    const want = hymnAnswer()
    fc.assert(
      fc.property(fc.array(tile, { maxLength: 7 }), (tiles) => {
        const v = hymnTiles(tiles)
        const right = tiles.length === 5 && want.every((w, i) => tiles[i] === w)
        expect(v.ok).toBe(right)
        if (!right) {
          const first = want.findIndex((w, i) => tiles[i] !== w)
          expect(v.firstWrong).toBe(first >= 0 ? first : 5)
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('handwritingSolved (3d)', () => {
  const ids = CASE_3_HAND_SAMPLES.map((h) => h.id)
  it('is solved once all four hands are compared, in any order', () => {
    expect(handwritingSolved([])).toBe(false)
    expect(handwritingSolved(ids.slice(0, 3))).toBe(false)
    expect(handwritingSolved([...ids].reverse())).toBe(true)
  })

  it('is solved exactly when every sample has been seen', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom<HandSampleId>(...ids), { maxLength: 8 }), (seen) => {
        expect(handwritingSolved(seen)).toBe(ids.every((id) => seen.includes(id)))
      }),
      { numRuns: 200 },
    )
  })
})

describe('register (2a)', () => {
  it('wants agrees for the two quiet graves and disturbed for Finch', () => {
    expect(isRightRegisterMark('cobb', 'agrees')).toBe(true)
    expect(isRightRegisterMark('reade', 'disturbed')).toBe(false)
    expect(isRightRegisterMark('finch', 'disturbed')).toBe(true)
    expect(isRightRegisterMark('finch', 'agrees')).toBe(false)
  })
  it('is solved only once all three lines are right', () => {
    expect(registerSolved(['cobb', 'finch'])).toBe(false)
    expect(registerSolved(CASE_2_FRESH_GRAVES.map((g) => g.id))).toBe(true)
  })
})

describe('bootMatch (2c) and crestTurns (2d)', () => {
  it("accepts Kerr's boots only", () => {
    expect(CASE_2_BOOTS.filter((b) => bootMatch(b.id).ok).map((b) => b.id)).toEqual(['kerr'])
  })
  it('turns the key only on the raven on a coffin', () => {
    expect(CASE_2_CRESTS.filter((c) => crestTurns(c.id)).map((c) => c.id)).toEqual(['raven-coffin'])
  })
})
