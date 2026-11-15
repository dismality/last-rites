import { describe, expect, it } from 'vitest'
import { INTERIOR_FOG, easeInterior, interiorFogLook, isInterior } from './interiorFog'

describe('interior fog', () => {
  it('open air is unchanged and full interior is denser and warmer', () => {
    const base = { density: 0.04, color: [0.3, 0.4, 0.5] as const }
    expect(interiorFogLook(base.density, base.color, 0)).toEqual({ density: 0.04, color: [0.3, 0.4, 0.5] })
    const inner = interiorFogLook(base.density, base.color, 1)
    expect(inner.density).toBeCloseTo(0.04 * INTERIOR_FOG.densityScale, 9)
    expect(inner.color[0]).toBeLessThan(base.color[0])
    // Warm: red stays above blue relative to the base's red/blue ratio.
    expect(inner.color[0] / inner.color[2]).toBeGreaterThan(base.color[0] / base.color[2])
  })

  it('the chapel is interior and the hut doorstep is not', () => {
    expect(isInterior(10, 5)).toBe(true)
    expect(isInterior(0, 6)).toBe(false)
  })

  it('eases without overshooting', () => {
    expect(easeInterior(0, 1, 0.1)).toBeCloseTo(0.25, 9)
    expect(easeInterior(0.9, 1, 1)).toBe(1)
    expect(easeInterior(0.1, 0, 1)).toBe(0)
  })
})
