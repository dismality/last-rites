import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { SPRINT_STEP_LENGTH_M, STEP_LENGTH_M, stepSurface, tickStride } from './footsteps'

describe('tickStride', () => {
  it('fires one step per stride of ground', () => {
    let carry = 0
    let steps = 0
    for (let i = 0; i < 101; i++) {
      const r = tickStride(carry, 0.08, true, false)
      carry = r.carry
      if (r.step) steps++
    }
    // 8.08 m walked at 0.8 m a stride (the extra frame absorbs float drift).
    expect(steps).toBe(Math.floor(8 / STEP_LENGTH_M))
  })

  it('takes longer strides when sprinting', () => {
    expect(tickStride(STEP_LENGTH_M - 0.01, 0.02, true, true).step).toBe(false)
    expect(tickStride(SPRINT_STEP_LENGTH_M - 0.01, 0.02, true, true).step).toBe(true)
  })

  it('never steps in the air, standing still, or on bad input', () => {
    expect(tickStride(0.79, 0.5, false, false)).toEqual({ carry: 0.79, step: false })
    expect(tickStride(0.79, 0, true, false)).toEqual({ carry: 0.79, step: false })
    expect(tickStride(0.79, Number.NaN, true, false).step).toBe(false)
  })

  it('keeps the carry inside one stride', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.79, noNaN: true }), fc.double({ min: 0, max: 0.5, noNaN: true }), (c, d) => {
        const r = tickStride(c, d, true, false)
        expect(r.carry).toBeGreaterThanOrEqual(0)
        expect(r.carry).toBeLessThan(STEP_LENGTH_M)
      }),
    )
  })
})

describe('stepSurface', () => {
  it('is wood in the hut and grass on the open grounds', () => {
    expect(stepSurface(0, 0)).toBe('wood')
    expect(stepSurface(-15, 14)).toBe('grass')
  })
})
