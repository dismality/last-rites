import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { muzzleOpacity, muzzleProfile } from './muzzleFlash'

describe('muzzleFlash', () => {
  it('flashing on is a short bright pop with a light', () => {
    expect(muzzleProfile(true)).toEqual({ durationS: 0.06, peak: 1, light: true })
    expect(muzzleOpacity(muzzleProfile(true), 0)).toBe(1)
  })

  it('is invisible before and after its duration', () => {
    const p = muzzleProfile(false)
    expect(muzzleOpacity(p, -1)).toBe(0)
    expect(muzzleOpacity(p, p.durationS)).toBe(0)
  })
})

describe('Feature: 07-combat-and-enemies, Property 12: Muzzle flash obeys Flashing lights', () => {
  // **Validates: Requirements 5.7, 5.8, 21.1, 21.2**
  it('flashing off has no light, a lower peak and at least 0.3 s', () => {
    const on = muzzleProfile(true)
    const off = muzzleProfile(false)
    expect(off.light).toBe(false)
    expect(on.light).toBe(true)
    expect(off.peak).toBeLessThan(on.peak)
    expect(off.durationS).toBeGreaterThanOrEqual(0.3)
  })

  it('opacity stays within the peak and changes no faster than the sine arc allows', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.5, noNaN: true }),
        fc.double({ min: 0, max: 0.05, noNaN: true }),
        (age, dt) => {
          const p = muzzleProfile(false)
          const a = muzzleOpacity(p, age)
          const b = muzzleOpacity(p, age + dt)
          expect(a).toBeGreaterThanOrEqual(0)
          expect(a).toBeLessThanOrEqual(p.peak + 1e-12)
          // max slope of peak * sin(pi t / D) is peak * pi / D
          expect(Math.abs(b - a)).toBeLessThanOrEqual((p.peak * Math.PI * dt) / p.durationS + 1e-9)
        },
      ),
    )
  })
})
