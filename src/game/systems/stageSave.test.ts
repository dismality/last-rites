import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { freshStageSave, migrateSave, sanitizeStageSave, stageOfOldNight } from './stageSave'

describe('stageSave', () => {
  it('maps old nights 1-5 to stages 1, 1, 2, 2, 3', () => {
    expect([1, 2, 3, 4, 5].map(stageOfOldNight)).toEqual([1, 1, 2, 2, 3])
  })

  it('migrates a story save without a stage block to a fresh stage', () => {
    const m = migrateSave({ nightNumber: 4 }, undefined, true)
    expect(m.nightNumber).toBe(2)
    expect(m.stage).toEqual(freshStageSave(2))
  })

  it('keeps a save that already has a stage block, clamped to the stages', () => {
    const raw = { ...freshStageSave(3), caseSolved: true, nightElapsed: 12 }
    const m = migrateSave({ nightNumber: 3 }, raw, true)
    expect(m.nightNumber).toBe(3)
    expect(m.stage.caseSolved).toBe(true)
    expect(m.stage.nightElapsed).toBe(12)
  })

  it('leaves Endless night numbers alone', () => {
    expect(migrateSave({ nightNumber: 9 }, undefined, false).nightNumber).toBe(9)
  })

  it('sanitises junk to a fresh block', () => {
    expect(sanitizeStageSave('junk', 2)).toEqual(freshStageSave(2))
    const s = sanitizeStageSave({ stage: 9, altar: { wrong: -4, lockedUntil: 'x' }, nightElapsed: NaN }, 1)
    expect(s.stage).toBe(1)
    expect(s.altar).toEqual({ lockedUntil: 0, wrong: 0, linksAtLastWrong: 0 })
    expect(s.nightElapsed).toBe(0)
  })

  /** **Validates: Requirements 4.7** */
  it('Feature: 10-curse-stages, Property 11: old saves migrate monotonically', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }), (a, b) => {
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        const mLo = migrateSave({ nightNumber: lo }, undefined, true)
        const mHi = migrateSave({ nightNumber: hi }, undefined, true)
        expect(mLo.stage.stage).toBeLessThanOrEqual(mHi.stage.stage)
        expect(mLo.stage.stage).toBeGreaterThanOrEqual(1)
        expect(mHi.stage.stage).toBeLessThanOrEqual(3)
        expect(mHi.nightNumber).toBe(mHi.stage.stage)
      }),
      { numRuns: 100 },
    )
  })

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.boolean(), (n, raw, story) => {
        const m = migrateSave({ nightNumber: n as number }, raw, story)
        expect([1, 2, 3]).toContain(m.stage.stage)
      }),
      { numRuns: 100 },
    )
  })
})
