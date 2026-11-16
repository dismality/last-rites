import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASE_1_LEDGER, CASE_1_RIGHT_FLAGS, CASE_1_STONES, LEDGER_WRONG_FLAG_MESSAGE } from '../../data/cases'
import type { LedgerLine } from './caseSave'
import { applyFlag, flagTarget, joinLine, moveCursor, removeLine } from './ledgerMinigame'

const stoneIds = CASE_1_STONES.map((s) => s.id)
const entryIds = CASE_1_LEDGER.map((e) => e.id)
const own = (stoneId: string) => CASE_1_STONES.find((s) => s.id === stoneId)!.ledgerId

describe('joinLine / removeLine', () => {
  it('is idempotent and keeps one line per stone and per entry', () => {
    const a = joinLine([], 'pell', 'l-pell')
    expect(joinLine(a, 'pell', 'l-pell')).toEqual(a)
    const b = joinLine(a, 'pell', 'l-ames')
    expect(b).toEqual([{ stoneId: 'pell', ledgerId: 'l-ames', flag: null }])
    expect(joinLine(b, 'ames', 'l-ames')).toEqual([{ stoneId: 'ames', ledgerId: 'l-ames', flag: null }])
  })
  it('rubs out an unflagged line but keeps a flagged one', () => {
    const lines: LedgerLine[] = [
      { stoneId: 'pell', ledgerId: 'l-pell', flag: 'date' },
      { stoneId: 'hale', ledgerId: 'l-hale', flag: null },
    ]
    expect(removeLine(lines, 'hale')).toEqual([lines[0]])
    expect(removeLine(lines, 'pell')).toEqual(lines)
  })
})

describe('moveCursor', () => {
  it('clamps at the ends and crosses pages', () => {
    expect(moveCursor({ side: 'stone', index: 0 }, 'ArrowUp', 6, 8)).toEqual({ side: 'stone', index: 0 })
    expect(moveCursor({ side: 'entry', index: 7 }, 'ArrowDown', 6, 8)).toEqual({ side: 'entry', index: 7 })
    expect(moveCursor({ side: 'entry', index: 7 }, 'ArrowRight', 6, 8)).toEqual({ side: 'stone', index: 5 })
    expect(moveCursor({ side: 'stone', index: 2 }, 'ArrowLeft', 6, 8)).toEqual({ side: 'entry', index: 2 })
  })
  it('never leaves the grid', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'), { maxLength: 40 }),
        (keys) => {
          let c = { side: 'stone' as 'stone' | 'entry', index: 0 }
          for (const k of keys) {
            c = moveCursor(c, k, 6, 8)
            expect(c.index).toBeGreaterThanOrEqual(0)
            expect(c.index).toBeLessThan(c.side === 'stone' ? 6 : 8)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('flagTarget', () => {
  const lines: LedgerLine[] = [{ stoneId: 'pell', ledgerId: 'l-pell', flag: null }]
  it('finds the line from either page, else the selected stone', () => {
    expect(flagTarget(lines, { side: 'stone', index: stoneIds.indexOf('pell') }, stoneIds, entryIds, null)).toBe('pell')
    expect(flagTarget(lines, { side: 'entry', index: entryIds.indexOf('l-pell') }, stoneIds, entryIds, null)).toBe('pell')
    expect(flagTarget(lines, { side: 'stone', index: 0 }, stoneIds, entryIds, 'hale')).toBe('hale')
  })
})

describe('applyFlag', () => {
  it('asks for a line first', () => {
    expect(applyFlag([], 'pell', 'date').kind).toBe('no-line')
  })
  it('rejects a wrong flag with "These two agree" and changes nothing', () => {
    const lines = joinLine([], 'marsh', 'l-marsh')
    const out = applyFlag(lines, 'marsh', 'date')
    expect(out.kind).toBe('wrong')
    expect(out.message).toBe(LEDGER_WRONG_FLAG_MESSAGE)
    expect(out.lines).toEqual(lines)
  })
  it('rejects a right kind on the wrong entry', () => {
    const lines = joinLine([], 'pell', 'l-marsh')
    expect(applyFlag(lines, 'pell', 'date').kind).toBe('wrong')
  })
  it('solves after the three right flags, in any order', () => {
    const order = [...CASE_1_RIGHT_FLAGS].reverse()
    let lines: LedgerLine[] = []
    order.forEach((r, i) => {
      lines = joinLine(lines, r.stoneId, own(r.stoneId))
      const out = applyFlag(lines, r.stoneId, r.kind)
      expect(out.kind).toBe('right')
      expect(out.solved).toBe(i === order.length - 1)
      lines = out.lines
    })
  })
  it('a repeated right flag is a no-op', () => {
    const lines = joinLine([], 'pell', 'l-pell')
    const first = applyFlag(lines, 'pell', 'date')
    const again = applyFlag(first.lines, 'pell', 'date')
    expect(again.kind).toBe('repeat')
    expect(again.lines).toEqual(first.lines)
  })
  it('only the three right flags are ever accepted', () => {
    fc.assert(
      fc.property(fc.constantFrom(...stoneIds), fc.constantFrom('date', 'plot', 'certificate' as const), (stone, kind) => {
        const out = applyFlag(joinLine([], stone, own(stone)), stone, kind)
        const right = CASE_1_RIGHT_FLAGS.some((r) => r.stoneId === stone && r.kind === kind)
        expect(out.kind === 'right').toBe(right)
      }),
      { numRuns: 100 },
    )
  })
})
