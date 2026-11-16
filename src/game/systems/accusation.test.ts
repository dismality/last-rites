import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { JUSTICE_EPILOGUE, SILAS_DEFAULT_LINE } from '../../data/endings'
import { accusationOpen, defaultLine, epilogueLines, NO_ACCUSATION, recordAccusation } from './accusation'

describe('accusation rules', () => {
  it('opens only on the last stage\'s night while the case is unsolved', () => {
    expect(accusationOpen(3, 'night', false)).toBe(true)
    expect(accusationOpen(3, 'day', false)).toBe(false)
    expect(accusationOpen(2, 'night', false)).toBe(false)
    expect(accusationOpen(3, 'night', true)).toBe(false)
  })

  it('a right accusation earns the epilogue and no default line (Req 18.3)', () => {
    const rec = recordAccusation(NO_ACCUSATION, true)
    expect(epilogueLines(rec)).toEqual(JUSTICE_EPILOGUE)
    expect(defaultLine(rec)).toBeNull()
  })

  it('a wrong or missing accusation gets the default line and no epilogue (Req 18.4)', () => {
    for (const rec of [NO_ACCUSATION, recordAccusation(NO_ACCUSATION, false)]) {
      expect(epilogueLines(rec)).toEqual([])
      expect(defaultLine(rec)).toBe(SILAS_DEFAULT_LINE)
    }
  })

  // **Validates: Requirements 18.3, 18.4**
  it('once right, always right, whatever follows', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 8 }), (verdicts) => {
        const rec = verdicts.reduce(recordAccusation, NO_ACCUSATION)
        expect(rec.correct).toBe(verdicts.some(Boolean))
        expect(rec.given).toBe(verdicts.length > 0)
      }),
    )
  })
})
