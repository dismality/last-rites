import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { LANTERN_FLICKER_BELOW } from '../../data/balance'
import { flameBrightness, flameSize, gutterActive, gutterFactor, oilLabel } from './lanternGauge'

const RUNS = { numRuns: 100 }
const fuelArb = fc.double({ min: 0, max: 100, noNaN: true })
const lowFuelArb = fc.double({ min: 0, max: LANTERN_FLICKER_BELOW, noNaN: true }).filter((f) => f < LANTERN_FLICKER_BELOW)
const okFuelArb = fc.double({ min: LANTERN_FLICKER_BELOW, max: 100, noNaN: true })
const timeArb = fc.double({ min: 0, max: 600, noNaN: true })

describe('lanternGauge', () => {
  it('Feature: 06-clarity-and-hud, Property 8: Flame depends on fuel only and is monotonic', () => {
    // Validates: Requirements 2.1, 2.2, 2.10
    fc.assert(
      fc.property(fuelArb, fuelArb, (x, y) => {
        const a = Math.min(x, y)
        const b = Math.max(x, y)
        expect(flameSize(a)).toBeLessThanOrEqual(flameSize(b))
        expect(flameBrightness(a)).toBeLessThanOrEqual(flameBrightness(b))
        expect(flameSize(a)).toBeGreaterThanOrEqual(0.12)
        expect(flameSize(b)).toBeLessThanOrEqual(1)
      }),
      RUNS,
    )
    expect(flameSize.length).toBe(1)
    expect(flameBrightness.length).toBe(1)
  })

  it('Feature: 06-clarity-and-hud, Property 9: Oil label rule', () => {
    // Validates: Requirements 2.3, 2.4, 2.5, 10.3
    fc.assert(
      fc.property(fuelArb, (fuel) => {
        const label = oilLabel(fuel)
        if (fuel < LANTERN_FLICKER_BELOW) expect(label).toBe('Low oil')
        else expect(label).toBe(`Oil ${Math.round(fuel)}%`)
        expect(label === 'Low oil').toBe(fuel < LANTERN_FLICKER_BELOW)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 10: Gutter only when allowed', () => {
    // Validates: Requirements 2.6, 2.7, 10.1
    fc.assert(
      fc.property(timeArb, fuelArb, (t, fuel) => {
        expect(gutterFactor(t, fuel, false)).toBe(1)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(timeArb, okFuelArb, fc.boolean(), (t, fuel, flashing) => {
        expect(gutterFactor(t, fuel, flashing)).toBe(1)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(timeArb, lowFuelArb, (t, fuel) => {
        const values = [0, 0.1, 0.225, 0.45, 0.675].map((d) => gutterFactor(t + d, fuel, true))
        expect(new Set(values).size).toBeGreaterThan(1)
        for (const v of values) {
          expect(v).toBeGreaterThan(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }),
      RUNS,
    )
  })

  it('handles non-finite fuel as empty', () => {
    expect(oilLabel(Number.NaN)).toBe('Low oil')
    expect(flameSize(Number.NaN)).toBeCloseTo(0.12)
    expect(gutterFactor(Number.NaN, 0, true)).toBeGreaterThan(0)
  })

  it('gutterActive is true only for low fuel with flashing lights on (browser playtest regression)', () => {
    expect(gutterActive(0, true)).toBe(true)
    expect(gutterActive(LANTERN_FLICKER_BELOW - 1, true)).toBe(true)
    expect(gutterActive(0, false)).toBe(false)
    expect(gutterActive(LANTERN_FLICKER_BELOW, true)).toBe(false)
  })
})
