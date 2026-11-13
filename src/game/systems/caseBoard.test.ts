import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASES, caseOfStage, type CaseDef } from '../../data/cases'
import { STAGES, type StageNumber } from '../../data/stages'
import {
  EMPTY_BOARD,
  addLink,
  correctLinkCount,
  curseMeter,
  earnedNotes,
  linkKey,
  visibleClues,
  type BoardState,
} from './caseBoard'

const caseArb = fc.constantFrom<CaseDef>(...CASES)
const stageArb = fc.constantFrom<StageNumber>(...STAGES.map((s) => s.stage))

describe('caseBoard', () => {
  it('linkKey ignores order', () => {
    expect(linkKey('b', 'a')).toBe(linkKey('a', 'b'))
  })

  it('a listed pair gives its note and lowers the meter by one', () => {
    const c = CASES[0]
    const n = c.notes[0]
    const r = addLink(EMPTY_BOARD, c, n.b, n.a)
    expect(r.note).toBe(n)
    expect(curseMeter(r.board, c).value).toBe(c.curseSteps - 1)
    expect(earnedNotes(r.board, c)).toEqual([n])
  })

  it('a wrong pair, a self link and an unknown clue give no note and no change to the meter', () => {
    const c = CASES[0]
    const wrong = addLink(EMPTY_BOARD, c, 'hale-fresh-flowers', 'marsh-stone-toppled')
    expect(wrong.note).toBeNull()
    expect(curseMeter(wrong.board, c).value).toBe(c.curseSteps)
    expect(addLink(EMPTY_BOARD, c, 'pell-rope-cut', 'pell-rope-cut').board).toBe(EMPTY_BOARD)
    expect(addLink(EMPTY_BOARD, c, 'pell-rope-cut', 'nope').board).toBe(EMPTY_BOARD)
  })

  it('shows only found clues of the stage case', () => {
    expect(visibleClues(1, ['pell-rope-cut', 'surgeon-receipt']).map((x) => x.id)).toEqual([
      'pell-rope-cut',
    ])
  })

  // Feature: 10-curse-stages, Property 12: Linking is idempotent and note-correct
  // **Validates: Requirements 8.5, 8.6, 8.7**
  it('Property 12: linking is idempotent and note-correct', () => {
    fc.assert(
      fc.property(
        caseArb.chain((c) =>
          fc.record({
            c: fc.constant(c),
            pairs: fc.array(
              fc.tuple(
                fc.constantFrom(...c.clues.map((x) => x.id as string)),
                fc.constantFrom(...c.clues.map((x) => x.id as string)),
              ),
              { maxLength: 30 },
            ),
          }),
        ),
        ({ c, pairs }) => {
          let board: BoardState = EMPTY_BOARD
          let lastValue = c.curseSteps
          for (const [a, b] of pairs) {
            const r = addLink(board, c, a, b)
            const listed = c.notes.some((n) => linkKey(n.a, n.b) === linkKey(a, b))
            const fresh = a !== b && !board.links.includes(linkKey(a, b))
            expect(r.note !== null).toBe(listed && fresh)
            const again = addLink(r.board, c, b, a)
            expect(again.board).toEqual(r.board)
            expect(again.note).toBeNull()
            board = r.board
            const m = curseMeter(board, c)
            expect(m.value).toBeGreaterThanOrEqual(0)
            expect(m.value).toBeLessThanOrEqual(m.max)
            expect(m.value).toBeLessThanOrEqual(lastValue)
            lastValue = m.value
          }
          expect(correctLinkCount(board, c)).toBe(c.curseSteps - lastValue)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: 10-curse-stages, Property 8: Clue sets swap per stage
  // **Validates: Requirements 4.5, 7.3**
  it('Property 8: clue sets swap per stage', () => {
    const all = CASES.flatMap((c) => c.clues.map((x) => x.id as string))
    fc.assert(
      fc.property(stageArb, fc.subarray(all), (stage, found) => {
        const own = new Set(caseOfStage(stage).clues.map((x) => x.id as string))
        const shown = visibleClues(stage, found).map((x) => x.id as string)
        expect(new Set(shown)).toEqual(new Set(found.filter((id) => own.has(id))))
        for (const other of CASES.filter((c) => c.stage !== stage)) {
          for (const x of other.clues) expect(shown).not.toContain(x.id)
        }
      }),
      { numRuns: 100 },
    )
  })
})
