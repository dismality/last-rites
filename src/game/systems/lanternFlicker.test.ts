import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LANTERN_FLICKER as F, LANTERN_LIGHT as L } from '../../data/lanternLight'
import {
  brideDimFor,
  flickerIntensity,
  flickerParams,
  flickerSignal,
  lastFlare,
  signalToFlame,
  signalToGlass,
  stepBrideDim,
  type FlickerInputs,
} from './lanternFlicker'

const inputs = fc.record({
  oil: fc.double({ min: 0, max: 100, noNaN: true }),
  sprinting: fc.boolean(),
  gust: fc.boolean(),
  flashingLights: fc.boolean(),
  seed: fc.integer({ min: 0, max: 100000 }),
})
const time = fc.double({ min: 0, max: 600, noNaN: true })
const RUNS = { numRuns: 100 }

function hue(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const red = (hex: string): number => (parseInt(hex.slice(1), 16) >> 16) & 255
const blue = (hex: string): number => parseInt(hex.slice(1), 16) & 255

describe('lanternFlicker examples', () => {
  it('flares once at oil 0, then the light and emission are 0', () => {
    const p = flickerParams({ oil: 0, sprinting: false, gust: false, flashingLights: true })
    expect(flickerIntensity(5, p, 0.1)).toBeGreaterThan(1)
    expect(flickerIntensity(5, p, L.flareS + 0.01)).toBe(0)
    expect(signalToFlame(0)).toBe(0)
    expect(signalToGlass(0)).toBe(0)
    expect(lastFlare(-1)).toBeNull()
  })

  it('fades out slowly with Flashing lights off', () => {
    const p = flickerParams({ oil: 0, sprinting: false, gust: false, flashingLights: false })
    expect(flickerIntensity(5, p, F.fadeOutS)).toBe(0)
    expect(flickerIntensity(5, p, 0.3)).toBeGreaterThan(0.3)
  })

  it('dims 0.7 within 8 m and ramps slowly with Flashing lights off', () => {
    expect(brideDimFor(8)).toBeCloseTo(0.7)
    expect(brideDimFor(8.01)).toBe(1)
    expect(stepBrideDim(1, 3, 1 / 60, true)).toBeCloseTo(0.7)
    expect(stepBrideDim(1, 3, 0.1, false)).toBeCloseTo(0.93)
  })
})

describe('lanternFlicker properties', () => {
  // Feature: 11-horror-pass, Property 28: Flicker signal bounds
  // **Validates: Requirements 7.11, 7.12, 7.14**
  it('keeps the signal finite, bounded and deterministic', () => {
    fc.assert(
      fc.property(inputs, time, (i, t) => {
        const p = flickerParams(i)
        const m = flickerSignal(t, p)
        expect(Number.isFinite(m)).toBe(true)
        expect(m).toBeGreaterThanOrEqual(F.minMult)
        expect(m).toBeLessThanOrEqual(F.maxMult)
        expect(flickerSignal(t, flickerParams(i))).toBe(m)
      }),
      RUNS,
    )
  })

  it('with Flashing lights off, steps stay under 10% and power sits below 1 Hz', () => {
    fc.assert(
      fc.property(inputs, time, (i, t0) => {
        const p = flickerParams({ ...i, flashingLights: false })
        const n = 720
        const xs: number[] = []
        for (let k = 0; k < n; k++) xs.push(flickerSignal(t0 + k / 60, p))
        for (let k = 1; k < n; k++)
          expect(Math.abs(xs[k] - xs[k - 1])).toBeLessThanOrEqual(L.flashingOffMaxStep)
        const mean = xs.reduce((a, b) => a + b, 0) / n
        const w = xs.map((x, k) => (x - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1))))
        let total = 0
        let high = 0
        for (let b = 1; b < n / 2; b++) {
          let re = 0
          let im = 0
          for (let k = 0; k < n; k++) {
            re += w[k] * Math.cos((2 * Math.PI * b * k) / n)
            im -= w[k] * Math.sin((2 * Math.PI * b * k) / n)
          }
          const pw = re * re + im * im
          total += pw
          if ((b * 60) / n > L.flashingOffMaxHz) high += pw
        }
        expect(high).toBeLessThanOrEqual(0.05 * total + 1e-12)
      }),
      { numRuns: 100 },
    )
  })

  it('is 0 after the flare at oil 0, with flame and glass at 0', () => {
    fc.assert(
      fc.property(inputs, time, fc.double({ min: L.flareS, max: 60, noNaN: true }), (i, t, age) => {
        const p = flickerParams({ ...i, oil: 0, flashingLights: true })
        const m = flickerIntensity(t, p, age)
        expect(m).toBe(0)
        expect(signalToFlame(m)).toBe(0)
        expect(signalToGlass(m)).toBe(0)
        const flare = flickerIntensity(t, p, age % L.flareS)
        expect(flare).toBeLessThanOrEqual(F.maxMult + 1e-9)
      }),
      RUNS,
    )
  })

  // Feature: 11-horror-pass, Property 29: Flicker parameters respond to oil and movement
  // **Validates: Requirements 7.12, 7.13, 7.14**
  it('gutters harder on low oil and when moving, and goes redder', () => {
    fc.assert(
      fc.property(
        inputs,
        fc.double({ min: 0, max: L.lowOilBelow - 1e-6, noNaN: true }),
        fc.double({ min: L.lowOilBelow, max: 100, noNaN: true }),
        (i, low, ok) => {
          const lowP = flickerParams({ ...i, oil: low })
          const okP = flickerParams({ ...i, oil: ok })
          expect(lowP.gutterAmp).toBeGreaterThanOrEqual(2 * okP.gutterAmp)
          expect(hue(lowP.color)).toBeLessThanOrEqual(hue(L.color) + 1e-9)
          expect(red(lowP.color)).toBeGreaterThanOrEqual(red(L.color))
          expect(blue(lowP.color)).toBeLessThanOrEqual(blue(L.color))
          const walk = flickerParams({ ...i, sprinting: false, gust: false })
          const move = flickerParams({ ...i, sprinting: i.sprinting || !i.gust, gust: i.gust })
          expect(move.gutterAmp).toBeGreaterThanOrEqual(1.5 * walk.gutterAmp - 1e-12)
        },
      ),
      RUNS,
    )
  })

  it('moves flame and glass monotonically with the signal', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1.15, noNaN: true }),
        fc.double({ min: 0, max: 1.15, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a]
          expect(signalToFlame(lo)).toBeLessThanOrEqual(signalToFlame(hi))
          expect(signalToGlass(lo)).toBeLessThanOrEqual(signalToGlass(hi))
        },
      ),
      RUNS,
    )
  })

  // Feature: 11-horror-pass, Property 11: Bride lantern effect (flicker part)
  // **Validates: Requirements 2.16, 7.14**
  it('dims by 0.7 within 8 m and never changes faster than 0.7 per second with Flashing lights off', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.double({ min: 0, max: 20, noNaN: true }),
            fc.double({ min: 0.001, max: 0.5, noNaN: true }),
          ),
          {
            maxLength: 80,
          },
        ),
        fc.boolean(),
        (steps, flashing) => {
          let dim = 1
          for (const [d, dt] of steps) {
            expect(brideDimFor(d)).toBe(d <= F.brideRangeM ? 0.7 : 1)
            const next = stepBrideDim(dim, d, dt, flashing)
            if (!flashing)
              expect(Math.abs(next - dim)).toBeLessThanOrEqual(F.brideSlewPerS * dt + 1e-12)
            expect(next).toBeGreaterThanOrEqual(0.7 - 1e-12)
            expect(next).toBeLessThanOrEqual(1 + 1e-12)
            dim = next
          }
        },
      ),
      RUNS,
    )
  })

  it('has no flicker component with Flashing lights off', () => {
    const inp: FlickerInputs = { oil: 50, sprinting: true, gust: true, flashingLights: false }
    expect(flickerParams(inp).lowPass).toBe(true)
  })
})
