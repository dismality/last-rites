import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { KEEPER_HUNCH } from '../../data/keeperHunch'
import type { Phase } from '../types'
import {
  easeLean,
  flameLean,
  flameSkewDeg,
  freshHunchClock,
  hunchActive,
  hunchTarget,
  nearestCandidate,
  tickHunchClock,
  type HunchCandidate,
} from './keeperHunch'

const PHASES: Phase[] = ['day', 'dusk', 'night', 'dawn']

describe("Property 20: keeper's hunch", () => {
  it('is on exactly when 120 s of day play have passed since the last discovery and a clue is left', () => {
    const step = fc.record({
      dt: fc.double({ min: 0, max: 30, noNaN: true }),
      phase: fc.constantFrom(...PHASES),
      discover: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), fc.nat({ max: 5 }), (steps, left) => {
        let clock = freshHunchClock()
        let found = 0
        // The reference: day seconds since the last discovery, summed independently.
        let dayS = 0
        for (const s of steps) {
          if (s.discover) {
            found++
            dayS = 0
          } else if (s.phase === 'day') dayS += s.dt
          clock = tickHunchClock(clock, s.discover ? 0 : s.dt, s.phase, found)
          const want = s.phase === 'day' && dayS >= KEEPER_HUNCH.afterS && left > 0
          expect(hunchActive(clock, s.phase, left)).toBe(want)
          expect(clock.sinceClueS).toBeCloseTo(dayS, 6)
        }
      }),
    )
  })

  it('targets the nearest unfound clue', () => {
    const v = fc.tuple(fc.integer({ min: -60, max: 60 }), fc.constant(0), fc.integer({ min: -60, max: 60 }))
    fc.assert(
      fc.property(fc.array(v, { minLength: 1, maxLength: 8 }), v, (points, from) => {
        const cands: HunchCandidate[] = points.map((p, i) => ({ id: `c${i}`, position: p }))
        const on = { sinceClueS: KEEPER_HUNCH.afterS, found: 0 }
        const t = hunchTarget(on, 'day', cands, from)!
        const d = (p: readonly number[]) => Math.hypot(p[0] - from[0], p[2] - from[2])
        for (const c of cands) expect(d(t.position)).toBeLessThanOrEqual(d(c.position) + 1e-9)
      }),
    )
  })
})

describe("keeper's hunch rules", () => {
  it('holds the clock outside the day and restarts it on a new clue or a lower count', () => {
    let c = tickHunchClock(freshHunchClock(), 50, 'day', 0)
    expect(c.sinceClueS).toBe(50)
    expect(tickHunchClock(c, 50, 'night', 0)).toBe(c)
    expect(tickHunchClock(c, Number.NaN, 'day', 0)).toBe(c)
    c = tickHunchClock(c, 10, 'day', 1)
    expect(c).toEqual({ sinceClueS: 0, found: 1 })
    c = tickHunchClock({ sinceClueS: 200, found: 4 }, 1, 'day', 0)
    expect(c).toEqual({ sinceClueS: 0, found: 0 })
  })

  it('is off with no clue left or by night, and has no target then', () => {
    const on = { sinceClueS: 500, found: 2 }
    expect(hunchActive(on, 'day', 0)).toBe(false)
    expect(hunchActive(on, 'night', 3)).toBe(false)
    expect(hunchTarget(on, 'day', [], [0, 0, 0])).toBeNull()
    expect(nearestCandidate([], [0, 0, 0])).toBeNull()
  })

  it('leans toward the clue: right when it is east of a player facing north, full when behind', () => {
    const at: [number, number, number] = [0, 0, 0]
    // yaw 0 looks -Z (north).
    expect(flameLean(at, 0, [0, 0, -10])).toBeCloseTo(0)
    expect(flameLean(at, 0, [10, 0, 0])).toBeCloseTo(1)
    expect(flameLean(at, 0, [-10, 0, 0])).toBeCloseTo(-1)
    expect(flameLean(at, 0, [5, 0, -5])).toBeCloseTo(Math.SQRT1_2)
    expect(flameLean(at, 0, [1, 0, 10])).toBe(1)
    expect(flameLean(at, 0, [-1, 0, 10])).toBe(-1)
    // Facing east (yaw -π/2), a clue to the north is on the left.
    expect(flameLean(at, -Math.PI / 2, [0, 0, -10])).toBeCloseTo(-1)
    // On top of the clue, or with junk input, it stands straight.
    expect(flameLean(at, 0, [0.5, 0, 0.5])).toBe(0)
    expect(flameLean(at, Number.NaN, [10, 0, 0])).toBe(0)
  })

  it('sways only with head bob on and motion not reduced (Req 24.2)', () => {
    const t = 1 / (4 * KEEPER_HUNCH.swayHz)
    expect(flameSkewDeg(1, t, true, false)).toBeCloseTo(KEEPER_HUNCH.maxLeanDeg + KEEPER_HUNCH.swayDeg)
    expect(flameSkewDeg(1, t, false, false)).toBe(KEEPER_HUNCH.maxLeanDeg)
    expect(flameSkewDeg(1, t, true, true)).toBe(KEEPER_HUNCH.maxLeanDeg)
    expect(flameSkewDeg(0, t, true, false)).toBe(0)
  })

  it('eases the lean, or sets it at once under reduced motion', () => {
    const half = easeLean(0, 1, KEEPER_HUNCH.easeS / 2, false)
    expect(half).toBeCloseTo(0.5)
    expect(easeLean(0, 1, 10, false)).toBe(1)
    expect(easeLean(0, 1, 0.01, true)).toBe(1)
  })
})
