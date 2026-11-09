import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { HEALTH_BAR } from '../../data/healthBar'
import {
  chunkFraction,
  healthFraction,
  healthText,
  initHealthDisplay,
  lowFrame,
  stepHealthDisplay,
  type HealthDisplayState,
} from './healthDisplay'

const RUNS = { numRuns: 100 }
const EPS = 1e-9

const maxArb = fc.integer({ min: 1, max: 300 })
const dtArb = fc.double({ min: 0, max: 2, noNaN: true })
const weirdNumber = fc.oneof(
  fc.double({ min: -500, max: 500 }),
  fc.constantFrom(NaN, Infinity, -Infinity),
)

const inRange = (s: HealthDisplayState): boolean =>
  s.fill >= 0 && s.fill <= s.maxHp && s.chunk >= 0 && s.chunk <= s.maxHp

describe('healthDisplay', () => {
  it('Feature: 06-clarity-and-hud, Property 1: chunk >= fill and both stay in 0..max', () => {
    fc.assert(
      fc.property(
        maxArb,
        fc.array(fc.tuple(fc.integer({ min: -20, max: 320 }), fc.option(maxArb), dtArb, fc.boolean()), {
          maxLength: 40,
        }),
        (startMax, events) => {
          let s = initHealthDisplay(startMax, startMax)
          for (const [hp, newMax, dt, flashing] of events) {
            s = stepHealthDisplay(s, { hp, maxHp: newMax ?? s.maxHp }, flashing, dt)
            expect(s.chunk).toBeGreaterThanOrEqual(s.fill - EPS)
            expect(inRange(s)).toBe(true)
          }
        },
      ),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 2: fill follows HP and max HP', () => {
    fc.assert(
      fc.property(maxArb, maxArb, fc.nat(300), fc.nat(300), (max1, max2, a, b) => {
        const hp1 = Math.min(a, max1)
        let s = initHealthDisplay(hp1, max1)
        // HP drop in the same frame
        const dropTo = Math.min(b, hp1)
        s = stepHealthDisplay(s, { hp: dropTo, maxHp: max1 }, true, 0)
        expect(healthFraction(s)).toBeCloseTo(dropTo / max1, 9)
        expect(healthText(dropTo, max1)).toBe(`${dropTo} / ${max1}`)
        // A rise eases in over HEALTH_BAR.easeS (Req 1.12), so give it time to finish.
        const hp2 = Math.min(b, max2)
        s = stepHealthDisplay(s, { hp: hp2, maxHp: max2 }, true, 1)
        expect(healthFraction(s)).toBeCloseTo(hp2 / max2, 9)
        expect(healthText(hp2, max2)).toBe(`${hp2} / ${max2}`)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 3: recent-damage chunk holds 0.15 s then drains over 0.6 s', () => {
    fc.assert(
      fc.property(
        maxArb,
        fc.integer({ min: 2, max: 300 }),
        fc.integer({ min: 1, max: 299 }),
        (max, a0, b0) => {
          const a = Math.min(a0, max)
          const b = Math.min(b0, a - 1)
          fc.pre(b >= 0 && a > b)
          let s = initHealthDisplay(a, max)
          s = stepHealthDisplay(s, { hp: b, maxHp: max }, true, 0)
          expect(s.chunk).toBe(a)
          s = stepHealthDisplay(s, { hp: b, maxHp: max }, true, HEALTH_BAR.holdS - 0.01)
          expect(s.chunk).toBe(a)
          s = stepHealthDisplay(s, { hp: b, maxHp: max }, true, 0.01 + HEALTH_BAR.drainS + 0.001)
          expect(s.chunk).toBeCloseTo(b, 9)
        },
      ),
      RUNS,
    )
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.74, noNaN: true }),
        fc.integer({ min: 1, max: 40 }),
        (wait, extra) => {
          let s = initHealthDisplay(100, 100)
          s = stepHealthDisplay(s, { hp: 60, maxHp: 100 }, true, wait)
          const shown = s.chunk
          s = stepHealthDisplay(s, { hp: Math.max(0, 60 - extra), maxHp: 100 }, true, 0)
          expect(s.chunk).toBeGreaterThanOrEqual(Math.min(shown, 100) - EPS)
          expect(s.holdLeft).toBe(HEALTH_BAR.holdS)
        },
      ),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 4: healing eases up and lands after 0.4 s', () => {
    fc.assert(
      fc.property(
        maxArb,
        fc.nat(300),
        fc.nat(300),
        fc.array(fc.double({ min: 0.001, max: 0.1, noNaN: true }), { minLength: 1, maxLength: 20 }),
        (max, a0, b0, dts) => {
          const a = Math.min(a0, max)
          const b = Math.min(Math.max(b0, a), max)
          let s = initHealthDisplay(a, max)
          let prev = s.fill
          let elapsed = 0
          for (const dt of dts) {
            s = stepHealthDisplay(s, { hp: b, maxHp: max }, true, dt)
            elapsed += dt
            expect(s.fill).toBeGreaterThanOrEqual(prev - EPS)
            expect(s.fill).toBeLessThanOrEqual(b + EPS)
            prev = s.fill
          }
          s = stepHealthDisplay(s, { hp: b, maxHp: max }, true, HEALTH_BAR.easeS)
          expect(elapsed).toBeGreaterThan(0)
          expect(s.fill).toBeCloseTo(b, 9)
        },
      ),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 5: flashing decides the hit effect and the low frame', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.integer({ min: 0, max: 99 }), (flashing, hp) => {
        const s = stepHealthDisplay(initHealthDisplay(100, 100), { hp, maxHp: 100 }, flashing, 0)
        expect(s.fx).toBe(flashing ? 'flash' : 'thick')
        expect(s.fxLeft).toBe(flashing ? HEALTH_BAR.flashS : HEALTH_BAR.thickenS)
        const after = stepHealthDisplay(
          s,
          { hp, maxHp: 100 },
          flashing,
          (flashing ? HEALTH_BAR.flashS : HEALTH_BAR.thickenS) + 0.001,
        )
        expect(after.fx).toBe('none')
      }),
      RUNS,
    )
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300 }), fc.boolean(), (hp, flashing) => {
        const f = lowFrame(hp, flashing)
        expect(f.low).toBe(hp < 30)
        if (f.pulse) expect(flashing).toBe(true)
        if (f.thick) expect(flashing).toBe(false)
        expect(f.pulse).toBe(f.low && flashing)
        expect(f.thick).toBe(f.low && !flashing)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 6: invalid HP input is clamped', () => {
    fc.assert(
      fc.property(weirdNumber, weirdNumber, weirdNumber, fc.boolean(), (hp, max, dt, flashing) => {
        let s = initHealthDisplay(hp, max)
        expect(inRange(s)).toBe(true)
        s = stepHealthDisplay(s, { hp, maxHp: max }, flashing, dt)
        expect(inRange(s)).toBe(true)
        expect(Number.isFinite(s.fill) && Number.isFinite(s.chunk)).toBe(true)
        expect(healthFraction(s)).toBeGreaterThanOrEqual(0)
        expect(chunkFraction(s)).toBeLessThanOrEqual(1)
        expect(() => healthText(hp, max)).not.toThrow()
        expect(() => lowFrame(hp, flashing)).not.toThrow()
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 7: fresh display after Retry Night', () => {
    fc.assert(
      fc.property(fc.nat(300), maxArb, (hp0, max) => {
        const hp = Math.min(hp0, max)
        const s = initHealthDisplay(hp, max)
        expect(s.chunk).toBe(s.fill)
        expect(s.fill).toBe(hp)
        expect(s.holdLeft).toBe(0)
        expect(s.fx).toBe('none')
        expect(s.fxLeft).toBe(0)
        // No drain or ease runs: a settled step changes nothing.
        const next = stepHealthDisplay(s, { hp, maxHp: max }, true, 1)
        expect(next.fill).toBe(hp)
        expect(next.chunk).toBe(hp)
      }),
      RUNS,
    )
  })

  it('shows "72 / 100" and the Low tag threshold', () => {
    expect(healthText(72, 100)).toBe('72 / 100')
    expect(lowFrame(29, true).low).toBe(true)
    expect(lowFrame(30, true).low).toBe(false)
  })
})
