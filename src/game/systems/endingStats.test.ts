import { describe, expect, it } from 'vitest'
import { endingProgressRows, stagesCleared } from './endingStats'

describe('ending progress rows (Req 1.4)', () => {
  it('counts every stage on a won run and the stages before the fall otherwise', () => {
    expect(stagesCleared({ ending: 'rest', stage: 3 })).toBe(3)
    expect(stagesCleared({ ending: 'taken', stage: 2 })).toBe(1)
    expect(stagesCleared({ ending: 'taken', stage: 1 })).toBe(0)
    expect(stagesCleared({ ending: 'taken', stage: Number.NaN })).toBe(0)
  })

  it('shows stages cleared and cases solved, clamped to the case count', () => {
    expect(endingProgressRows({ ending: 'rest', stage: 3, casesSolved: 3 })).toEqual([
      { label: 'Stages cleared', value: '3 of 3' },
      { label: 'Cases solved', value: '3 of 3' },
    ])
    expect(endingProgressRows({ ending: 'rest', stage: 3, casesSolved: 9 })[1].value).toBe('3 of 3')
    expect(endingProgressRows({ ending: 'rest', stage: 3, casesSolved: -2 })[1].value).toBe('0 of 3')
  })
})
