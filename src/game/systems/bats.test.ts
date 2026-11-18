import source from './bats.ts?raw'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BAT } from '../../data/bats'
import { createRng } from '../rng'
import type { PerchBox } from './batPerches'
import {
  batOpacity,
  chitterAllowed,
  createBat,
  headYaw,
  readyToReturn,
  returnBat,
  stepBat,
  type Bat,
  type BatInput,
} from './bats'

const far: BatInput = { playerDist: 50, shotDist: null, bearing: 0 }
const boxes: PerchBox[] = Array.from({ length: 6 }, (_, i) => ({
  center: [i * 3, 0.5, 0],
  half: [0.3, 0.5, 0.3],
}))

describe('bats.ts import boundary', () => {
  it('imports neither playerHealth nor screenScares', () => {
    const imports = source
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l))
      .join('\n')
    expect(imports).not.toMatch(/playerHealth/)
    expect(imports).not.toMatch(/screenScares/)
    expect(imports).not.toMatch(/react|three|howler/i)
  })
})

describe('stepBat', () => {
  it('takes off inside 3 m, not at exactly 3 m', () => {
    const b = createBat(0, 0)
    expect(stepBat(b, { ...far, playerDist: 2.99 }, 0.1).phase).toBe('fleeing')
    expect(stepBat(b, { ...far, playerDist: 3 }, 0.1).phase).toBe('perched')
  })

  it('takes off on a shot within 10 m only', () => {
    const b = createBat(0, 0)
    expect(stepBat(b, { ...far, shotDist: 10 }, 0.1).phase).toBe('fleeing')
    expect(stepBat(b, { ...far, shotDist: 10.5 }, 0.1).phase).toBe('perched')
  })

  it('flies 6 s, fades, and is gone by 7 s', () => {
    let b = stepBat(createBat(0, 0), { ...far, playerDist: 1 }, 0.1)
    for (let i = 0; i < 60; i++) b = stepBat(b, far, 0.1)
    expect(b.phase).toBe('fleeing')
    expect(batOpacity(b)).toBe(1)
    for (let i = 0; i < 11; i++) b = stepBat(b, far, 0.1) // 0.1 s steps accumulate float error
    expect(b.phase).toBe('gone')
  })

  it('returns after 120 s on a different box', () => {
    let b: Bat = { ...createBat(2, 0), phase: 'gone', t: 119.9 }
    expect(returnBat(b, boxes, [], createRng(1), 0).phase).toBe('gone')
    b = stepBat(b, far, 0.2)
    expect(readyToReturn(b)).toBe(true)
    const r = returnBat(b, boxes, [0, 1], createRng(1), 0)
    expect(r.phase).toBe('perched')
    expect(r.boxIndex).not.toBe(2)
    expect([0, 1]).not.toContain(r.boxIndex)
  })
})

describe('chitterAllowed', () => {
  it('needs 20 s and a perched bat', () => {
    expect(chitterAllowed(null, 0, 1)).toBe(true)
    expect(chitterAllowed(0, 19.9, 1)).toBe(false)
    expect(chitterAllowed(0, 20, 1)).toBe(true)
    expect(chitterAllowed(null, 100, 0)).toBe(false)
  })
})

describe('headYaw', () => {
  // Feature: 11-horror-pass, Property 17: Bat head turn
  it('Property 17: never exceeds 120 degrees from rest', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.array(
          fc.record({
            bearing: fc.double({ min: -180, max: 180, noNaN: true }),
            dist: fc.double({ min: 0, max: 40, noNaN: true }),
            dt: fc.double({ min: 0, max: 1, noNaN: true }),
          }),
          { maxLength: 60 },
        ),
        (rest, steps) => {
          let y = rest
          for (const s of steps) {
            y = headYaw(rest, s.bearing, y, s.dist, s.dt)
            expect(Math.abs(y - rest)).toBeLessThanOrEqual(BAT.maxYawDeg + 1e-6)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 17: converges toward the clamped bearing in range and returns to rest in 2 s out of range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        fc.double({ min: 0, max: BAT.watchRangeM, noNaN: true }),
        fc.double({ min: BAT.watchRangeM + 0.01, max: 60, noNaN: true }),
        (rest, rel, near, farDist) => {
          const bearing = rest + rel
          const target = rest + Math.max(-BAT.maxYawDeg, Math.min(BAT.maxYawDeg, rel))
          let y = rest
          for (let i = 0; i < 200; i++) y = headYaw(rest, bearing, y, near, 0.05)
          expect(Math.abs(y - target)).toBeLessThan(1)
          for (let i = 0; i < 40; i++) y = headYaw(rest, bearing, y, farDist, 0.05)
          expect(Math.abs(y - rest)).toBeLessThan(1)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('bat state machine', () => {
  // Feature: 11-horror-pass, Property 18: Bat state machine
  it('Property 18: leaves perch only on proximity or a near shot, is gone after flight plus fade, and returns after 120 s elsewhere', () => {
    const stepArb = fc.record({
      dist: fc.double({ min: 0, max: 30, noNaN: true }),
      shot: fc.option(fc.double({ min: 0, max: 30, noNaN: true }), { nil: null }),
      dt: fc.double({ min: 0.01, max: 2, noNaN: true }),
    })
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 400 }), fc.integer(), (steps, seed) => {
        const rng = createRng(seed)
        let b = createBat(0, 0)
        let fleeStart = 0
        let goneStart = 0
        let now = 0
        let lastChitter: number | null = null
        for (const s of steps) {
          const before = b
          b = stepBat(b, { playerDist: s.dist, shotDist: s.shot, bearing: 0 }, s.dt)
          now += s.dt
          if (before.phase === 'perched' && b.phase === 'fleeing') {
            expect(s.dist < BAT.takeoffM || (s.shot !== null && s.shot <= BAT.gunRangeM)).toBe(true)
            fleeStart = now
          }
          if (before.phase === 'perched' && b.phase === 'perched') {
            expect(s.dist < BAT.takeoffM || (s.shot !== null && s.shot <= BAT.gunRangeM)).toBe(
              false,
            )
          }
          if (before.phase === 'fleeing' && b.phase === 'gone') {
            expect(now - fleeStart).toBeGreaterThanOrEqual(BAT.flightS)
            expect(now - fleeStart).toBeLessThanOrEqual(BAT.flightS + BAT.fadeS + s.dt + 1e-9)
            goneStart = now
          }
          if (b.phase === 'gone') {
            const r = returnBat(b, boxes, [], rng, 0)
            if (r.phase === 'perched') {
              expect(now - goneStart).toBeGreaterThanOrEqual(BAT.returnS - 1e-9)
              expect(r.boxIndex).not.toBe(b.boxIndex)
              expect(r.previousBox).toBe(b.boxIndex)
              b = r
            }
          }
          if (chitterAllowed(lastChitter, now, b.phase === 'perched' ? 1 : 0)) {
            if (lastChitter !== null)
              expect(now - lastChitter).toBeGreaterThanOrEqual(BAT.chitterGapS)
            expect(b.phase).toBe('perched')
            lastChitter = now
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})
