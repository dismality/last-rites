import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  AUTUMN_AMBIENCE,
  CANDLE_FLICKER,
  HARVEST_MOON,
  LEAVES,
  TURNIP_LANTERNS,
} from '../../data/allHallows'
import { GROUNDS_HALF, isInsideHut } from '../../data/cemeteryLayout'
import {
  candleFlicker,
  createAmbienceClock,
  createLeafField,
  easeMoonShow,
  gustFactor,
  moonDirection,
  moonShowTarget,
  stepAmbience,
  stepLeaves,
  windLevel,
  wrapAround,
  type AmbienceCue,
} from './allHallows'
import type { Phase } from '../types'

const PHASES: readonly Phase[] = ['day', 'dusk', 'night', 'dawn']
const seeded = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('turnip lantern placement', () => {
  it('keeps every lantern inside the grounds and out of the hut', () => {
    for (const { position: [x, y, z] } of TURNIP_LANTERNS) {
      expect(Math.abs(x)).toBeLessThan(GROUNDS_HALF)
      expect(Math.abs(z)).toBeLessThan(GROUNDS_HALF)
      expect(y).toBe(0)
      expect(isInsideHut(x, z)).toBe(false)
    }
  })

  it('keeps the hut doorway clear', () => {
    for (const { position: [x, , z] } of TURNIP_LANTERNS) {
      if (z > 0 && z < 5) expect(Math.abs(x)).toBeGreaterThan(0.9)
    }
  })
})

describe('candleFlicker', () => {
  // Feature: all-hallows, Property 1: the flame stays within its swing
  it('stays within 1 ± the swing, and a calm flame within the calm swing', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), fc.double({ min: -100, max: 100, noNaN: true }), (t, seed) => {
        const wild = candleFlicker(t, seed, false)
        const calm = candleFlicker(t, seed, true)
        expect(Math.abs(wild - 1)).toBeLessThanOrEqual(CANDLE_FLICKER.amount + 1e-9)
        expect(Math.abs(calm - 1)).toBeLessThanOrEqual(CANDLE_FLICKER.calmAmount + 1e-9)
      }),
      { numRuns: 200 },
    )
  })

  it('returns a steady 1 for bad input', () => {
    expect(candleFlicker(Number.NaN, 1, false)).toBe(1)
    expect(candleFlicker(1, Number.POSITIVE_INFINITY, false)).toBe(1)
  })

  it('does not pulse two lanterns together', () => {
    expect(candleFlicker(3.2, 0, false)).not.toBeCloseTo(candleFlicker(3.2, 1.7, false), 3)
  })
})

describe('leaves', () => {
  // Feature: all-hallows, Property 2: leaves stay in the box around the camera and never sink
  it('keeps every leaf in the box around the camera, between the ground and the top', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.array(
          fc.record({
            dt: fc.integer({ min: 1, max: 100 }).map((ms) => ms / 1000),
            cx: fc.integer({ min: -400, max: 400 }).map((v) => v / 10),
            cz: fc.integer({ min: -400, max: 400 }).map((v) => v / 10),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        fc.integer({ min: 0, max: 30 }).map((v) => v / 10),
        (seed, steps, windScale) => {
          const rand = seeded(seed)
          const f = createLeafField(24, 0, 0, rand)
          let t = 0
          for (const s of steps) {
            t += s.dt
            stepLeaves(f, s.dt, t, windScale, s.cx, s.cz, rand)
            for (let i = 0; i < f.count; i++) {
              expect(Math.abs(f.x[i] - s.cx)).toBeLessThanOrEqual(LEAVES.boxM / 2 + 1e-3)
              expect(Math.abs(f.z[i] - s.cz)).toBeLessThanOrEqual(LEAVES.boxM / 2 + 1e-3)
              expect(f.y[i]).toBeGreaterThanOrEqual(0)
              expect(f.y[i]).toBeLessThanOrEqual(LEAVES.topM + 1e-6)
              expect(f.color[i]).toBeLessThan(LEAVES.colors.length)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('lets falling leaves land and landed leaves lift off again', () => {
    const rand = seeded(7)
    const f = createLeafField(40, 0, 0, rand)
    let landed = 0
    let liftedOff = 0
    for (let k = 0; k < 2000; k++) {
      const before = Array.from(f.ground, (g) => g >= 0)
      stepLeaves(f, 0.05, k * 0.05, 1, 0, 0, rand)
      for (let i = 0; i < f.count; i++) {
        if (!before[i] && f.ground[i] >= 0) landed++
        if (before[i] && f.ground[i] < 0) liftedOff++
      }
    }
    expect(landed).toBeGreaterThan(0)
    expect(liftedOff).toBeGreaterThan(0)
  })

  it('ignores a zero, negative or non-finite step', () => {
    const f = createLeafField(5, 0, 0, seeded(3))
    const before = Array.from(f.x)
    stepLeaves(f, 0, 1, 1, 0, 0, Math.random)
    stepLeaves(f, -1, 1, 1, 0, 0, Math.random)
    stepLeaves(f, Number.NaN, 1, 1, 0, 0, Math.random)
    expect(Array.from(f.x)).toEqual(before)
  })

  it('wraps a value into the box and leaves values inside it alone', () => {
    expect(wrapAround(3, 0, 10)).toBe(3)
    expect(wrapAround(6, 0, 10)).toBeCloseTo(-4)
    expect(wrapAround(-26, 0, 10)).toBeCloseTo(4)
  })

  it('gusts between 1 - gust and 1 + gust', () => {
    for (let t = 0; t < 30; t += 0.37) {
      expect(gustFactor(t)).toBeGreaterThanOrEqual(1 - LEAVES.gust - 1e-9)
      expect(gustFactor(t)).toBeLessThanOrEqual(1 + LEAVES.gust + 1e-9)
    }
  })
})

describe('harvest moon', () => {
  it('points low and above the horizon, towards +Z behind the chapel', () => {
    const [x, y, z] = moonDirection()
    expect(Math.hypot(x, y, z)).toBeCloseTo(1)
    expect(y).toBeGreaterThan(0)
    expect(Math.asin(y)).toBeLessThan((25 * Math.PI) / 180)
    expect(z).toBeGreaterThan(0)
    expect(x).toBeGreaterThan(0)
  })

  it('is hidden by day, full at night and faint under a storm', () => {
    expect(moonShowTarget('day', false)).toBe(0)
    expect(moonShowTarget('night', false)).toBe(1)
    expect(moonShowTarget('night', true)).toBe(HARVEST_MOON.stormShow)
  })

  // Feature: all-hallows, Property 3: the moon eases without overshooting
  it('eases towards the target without overshooting', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }).map((v) => v / 100),
        fc.integer({ min: 0, max: 100 }).map((v) => v / 100),
        fc.integer({ min: 1, max: 500 }).map((ms) => ms / 1000),
        (from, to, dt) => {
          const next = easeMoonShow(from, to, dt)
          expect(Math.abs(to - next)).toBeLessThanOrEqual(Math.abs(to - from) + 1e-12)
          expect(Math.abs(next - from)).toBeLessThanOrEqual(dt / HARVEST_MOON.fadeS + 1e-12)
        },
      ),
      { numRuns: 200 },
    )
  })
})

describe('autumn ambience', () => {
  it('blows the wind hardest at night', () => {
    for (const p of PHASES) expect(windLevel('night')).toBeGreaterThanOrEqual(windLevel(p))
  })

  // Feature: all-hallows, Property 4: crows never call at night and the bell only tolls at night
  it('keeps crows out of the night and the bell in it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.array(fc.record({ phase: fc.constantFrom(...PHASES), seconds: fc.integer({ min: 1, max: 400 }) }), {
          minLength: 1,
          maxLength: 8,
        }),
        (seed, legs) => {
          const rand = seeded(seed)
          const clock = createAmbienceClock(rand)
          let tolling = false
          for (const leg of legs) {
            for (let s = 0; s < leg.seconds * 4; s++) {
              const cues: AmbienceCue[] = stepAmbience(clock, 0.25, leg.phase, rand)
              for (const c of cues) {
                if (c.kind === 'crow') {
                  expect(AUTUMN_AMBIENCE.crowPhases).toContain(leg.phase)
                  expect(c.distanceM).toBeGreaterThanOrEqual(AUTUMN_AMBIENCE.crowDistanceM.min)
                  expect(c.distanceM).toBeLessThanOrEqual(AUTUMN_AMBIENCE.crowDistanceM.max)
                } else if (!tolling) {
                  // The first toll of a set starts only at night; the rest of the set may finish after.
                  expect(leg.phase).toBe('night')
                }
                if (c.kind === 'bell') tolling = clock.tollsLeft > 0
              }
              if (clock.tollsLeft === 0) tolling = false
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rings the bell in sets of tolls a few seconds apart', () => {
    const rand = seeded(11)
    const clock = createAmbienceClock(rand)
    const times: number[] = []
    for (let s = 0; s < 4 * 600; s++) {
      for (const c of stepAmbience(clock, 0.25, 'night', rand)) if (c.kind === 'bell') times.push(s * 0.25)
    }
    expect(times.length).toBeGreaterThanOrEqual(AUTUMN_AMBIENCE.bellTolls)
    expect(times[1] - times[0]).toBeCloseTo(AUTUMN_AMBIENCE.bellTollGapS, 0)
    expect(times[2] - times[1]).toBeCloseTo(AUTUMN_AMBIENCE.bellTollGapS, 0)
  })
})
