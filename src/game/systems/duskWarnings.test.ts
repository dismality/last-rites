import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CAPTIONS } from '../../data/captions'
import { DUSK_WARNINGS } from '../../data/duskWarnings'
import { duskWarningsCrossed } from './duskWarnings'

const [toll, tremble] = DUSK_WARNINGS

describe('dusk warnings', () => {
  it('sounds each warning once as the clock passes its mark', () => {
    expect(duskWarningsCrossed(toll.leftS + 0.5, toll.leftS - 0.5).map((w) => w.id)).toEqual(['dusk-toll'])
    expect(duskWarningsCrossed(toll.leftS - 0.5, toll.leftS - 1)).toEqual([])
    expect(duskWarningsCrossed(tremble.leftS + 0.1, tremble.leftS).map((w) => w.id)).toEqual(['dusk-tremble'])
  })

  it('stays quiet on the first look and when the clock goes back up', () => {
    expect(duskWarningsCrossed(null, toll.leftS - 1)).toEqual([])
    expect(duskWarningsCrossed(tremble.leftS - 1, toll.leftS + 100)).toEqual([])
  })

  it('every warning has its caption, on its own sound', () => {
    for (const w of DUSK_WARNINGS) {
      const c = CAPTIONS.find((x) => x.id === w.caption)
      expect(c?.event).toBe(w.sound)
    }
  })

  it('over a whole day each warning sounds exactly once, whatever the step size', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0.01, max: 5, noNaN: true }), { minLength: 1, maxLength: 400 }), (steps) => {
        let left = toll.leftS * 3
        let prev: number | null = null
        const heard: string[] = []
        for (const dt of [...steps, left]) {
          heard.push(...duskWarningsCrossed(prev, left).map((w) => w.id))
          prev = left
          left = Math.max(0, left - dt)
        }
        heard.push(...duskWarningsCrossed(prev, left).map((w) => w.id))
        expect(heard).toEqual(DUSK_WARNINGS.map((w) => w.id))
      }),
      { numRuns: 100 },
    )
  })
})
