import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { SKY_TRANSITION_S } from '../../data/skyPalette'
import { hexToRgb, lerpBlend, lerpRgb, targetBlend, transitionProgress } from './skyTransition'

describe('skyTransition', () => {
  it('parses hex colours', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0])
  })

  it('progress clamps and completes at the transition duration', () => {
    expect(transitionProgress(-1)).toBe(0)
    expect(transitionProgress(SKY_TRANSITION_S)).toBe(1)
    expect(transitionProgress(SKY_TRANSITION_S * 3)).toBe(1)
  })

  it('blend endpoints equal the inputs', () => {
    const a = targetBlend('day', 0.02)
    const b = targetBlend('night', 0.04)
    expect(lerpBlend(a, b, 0)).toEqual(a)
    expect(lerpBlend(a, b, 1)).toEqual(b)
  })

  it('lerpRgb stays between its endpoints for any k in [0,1]', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (k) => {
        const [r] = lerpRgb([0.2, 0, 0], [0.8, 0, 0], k)
        return r >= 0.2 - 1e-9 && r <= 0.8 + 1e-9
      })
    )
  })
})
