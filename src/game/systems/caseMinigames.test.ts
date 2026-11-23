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
  evidenceTimeline,
  hymnAnswer,
  hymnTiles,
  ledgerFlags,
  type LedgerFlagInput,
} from './caseMinigames'
import { CASE_3_EVIDENCE, CASE_3_TIMELINE_ORDER, type EvidenceCardId } from '../../data/cases'
import {
  CASE_2_BOOTS,
  CASE_2_CASTS,
  CASE_2_CREST_LOCK,
  CASE_2_CREST_ORDER,
  CASE_2_WATCH_ORDER,
  CASE_2_WATCH_SHELF,
  type CrestId,
} from '../../data/cases'
import { bootMatch, crestDials, watchOrder } from './caseMinigames'

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

describe('evidenceTimeline (3b)', () => {
  it('accepts the right order of the six cards', () => {
    expect(CASE_3_EVIDENCE).toHaveLength(6)
    expect(evidenceTimeline(CASE_3_TIMELINE_ORDER)).toEqual({ ok: true })
  })

  it('reports the first card out of place', () => {
    const swapped = [...CASE_3_TIMELINE_ORDER]
    ;[swapped[3], swapped[4]] = [swapped[4], swapped[3]]
    expect(evidenceTimeline(swapped)).toEqual({ ok: false, firstWrong: 3 })
  })

  // Feature: 10-curse-stages, Property 16: Right answers accepted, wrong answers rejected
  it('Property 16 (3b): only the right order is accepted; first-wrong is the first difference', () => {
    // Validates: Requirements 16.2, 16.4
    const ids = CASE_3_EVIDENCE.map((c) => c.id)
    fc.assert(
      fc.property(
        fc.oneof(
          fc.shuffledSubarray(ids, { minLength: 0, maxLength: 6 }),
          fc.array(fc.constantFrom<EvidenceCardId>(...ids), { maxLength: 8 }),
        ),
        (order) => {
          const v = evidenceTimeline(order)
          const same =
            order.length === CASE_3_TIMELINE_ORDER.length &&
            order.every((c, i) => c === CASE_3_TIMELINE_ORDER[i])
          expect(v.ok).toBe(same)
          if (!same) {
            let first = 0
            while (order[first] === CASE_3_TIMELINE_ORDER[first]) first++
            expect(v.firstWrong).toBe(first)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('crestDials (2a)', () => {
  it('opens for the founders by year: tower, leaf, star, moon', () => {
    expect(CASE_2_CREST_ORDER).toEqual(['tower', 'leaf', 'star', 'moon'])
    expect(crestDials(['tower', 'leaf', 'star', 'moon'])).toEqual({ ok: true })
  })

  it('rejects a wrong or unfinished setting with "The lock does not give"', () => {
    const r = crestDials(['tower', 'star', 'leaf', 'moon'])
    expect(r).toMatchObject({ ok: false, firstWrong: 1, message: 'The lock does not give' })
    expect(crestDials(['tower', 'leaf', null, null])).toMatchObject({ ok: false, firstWrong: 2 })
  })

  it('Property 16 (2a): only the founders order is accepted', () => {
    const dial = fc.option(fc.constantFrom<CrestId>(...CASE_2_CREST_LOCK.dialCrests), { nil: null })
    fc.assert(
      fc.property(fc.array(dial, { minLength: 4, maxLength: 4 }), (dials) => {
        const right = dials.every((d, i) => d === CASE_2_CREST_ORDER[i])
        expect(crestDials(dials).ok).toBe(right)
      }),
    )
  })
})

describe('watchOrder (2b)', () => {
  it('accepts the night in order and rejects the shelf order', () => {
    expect(watchOrder(CASE_2_WATCH_ORDER)).toEqual({ ok: true })
    expect(watchOrder(CASE_2_WATCH_SHELF)).toMatchObject({ ok: false, firstWrong: 0 })
  })

  it('Property 16 (2b): only the right order; first-wrong is the first difference', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([...CASE_2_WATCH_ORDER], { minLength: 8, maxLength: 8 }), (order) => {
        const v = watchOrder(order)
        const diff = order.findIndex((id, i) => id !== CASE_2_WATCH_ORDER[i])
        expect(v.ok).toBe(diff < 0)
        if (diff >= 0) expect(v.firstWrong).toBe(diff)
      }),
    )
  })
})

describe('bootMatch (2c)', () => {
  it('matches the full print to the lodge keeper only', () => {
    expect(bootMatch('cast-full', 'lodge-keeper')).toEqual({ ok: true })
    expect(bootMatch('cast-full', 'gravedigger')).toMatchObject({ ok: false, message: 'The hobnails do not agree.' })
  })

  it('names the first feature that disagrees, or says the cast is too worn', () => {
    expect(bootMatch('cast-full', 'sexton').message).toBe('The tread does not agree.')
    expect(bootMatch('cast-narrow', 'doctor').message).toBe('The size does not agree.')
    expect(bootMatch('cast-heel', 'sexton').message).toBe('This cast is too worn to match anything.')
  })

  it('Property 16 (2c): exactly one pair of the 12 is accepted', () => {
    const ok = CASE_2_CASTS.flatMap((c) => CASE_2_BOOTS.map((b) => [c.id, b.owner] as const)).filter(
      ([c, b]) => bootMatch(c, b).ok,
    )
    expect(ok).toEqual([['cast-full', 'lodge-keeper']])
    for (const c of CASE_2_CASTS) for (const b of CASE_2_BOOTS) if (!bootMatch(c.id, b.owner).ok) expect(bootMatch(c.id, b.owner).message).toBeTruthy()
  })
})
