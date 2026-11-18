import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { WEAPON_MAP } from '../../data/weapons'
import { createRng } from '../rng'
import {
  brideCanSpawn,
  brideDamage,
  brideMoveBlocked,
  brideTouch,
  brideVisible,
  createBride,
  lanternBend,
  spawnBride,
  tickBrideReturn,
  type BrideCollider,
  type BrideDamageSource,
} from './bride'

const pt = fc.record({ x: fc.double({ min: -50, max: 50, noNaN: true }), z: fc.double({ min: -50, max: 50, noNaN: true }) })

describe('bride spawning', () => {
  it('needs stage 2 or later, no living bride and an over return delay', () => {
    // Feature: 11-horror-pass, Property 7: Bride rules
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), fc.boolean(), fc.double({ min: 0, max: 70, noNaN: true }), (stage, alive, returnIn) => {
        expect(brideCanSpawn({ stage, brideAlive: alive, returnIn })).toBe(stage >= 2 && !alive && returnIn <= 0)
      }),
      { numRuns: 100 },
    )
  })

  it('spawns once, and not in stage 1', () => {
    const none = spawnBride(createBride(), { stage: 1 }, { x: 1, z: 1 })
    expect(none.alive).toBe(false)
    const one = spawnBride(createBride(), { stage: 2 }, { x: 1, z: 1 })
    expect(one).toMatchObject({ alive: true, x: 1, z: 1 })
    expect(spawnBride(one, { stage: 3 }, { x: 9, z: 9 })).toBe(one)
  })

  it('counts her return delay down to 0', () => {
    const gone = brideTouch(spawnBride(createBride(), { stage: 2 }, { x: 0, z: 0 }), 50, createRng(1)).bride
    expect(tickBrideReturn(gone, 100).returnIn).toBe(0)
  })
})

describe('brideVisible', () => {
  it('is visible iff inside the lit cone or within 3 m', () => {
    // Feature: 11-horror-pass, Property 7: Bride rules
    // **Validates: Requirements 2.7**
    fc.assert(
      fc.property(pt, pt, fc.boolean(), fc.boolean(), (b, p, lanternOn, inCone) => {
        const near = Math.hypot(b.x - p.x, b.z - p.z) <= 3
        expect(brideVisible(b, p, lanternOn, inCone)).toBe(near || (lanternOn && inCone))
      }),
      { numRuns: 100 },
    )
  })
})

describe('brideTouch', () => {
  it('leaves max(0, fuel - 20), vanishes her and sets a 30 to 60 s return', () => {
    // Feature: 11-horror-pass, Property 7: Bride rules
    // **Validates: Requirements 2.8**
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), fc.integer(), (fuel, seed) => {
        const b = spawnBride(createBride(), { stage: 2 }, { x: 0, z: 0 })
        const r = brideTouch(b, fuel, createRng(seed))
        expect(r.fuel).toBe(Math.max(0, fuel - 20))
        expect(r.bride.alive).toBe(false)
        expect(r.bride.returnIn).toBeGreaterThanOrEqual(30)
        expect(r.bride.returnIn).toBeLessThanOrEqual(60)
      }),
      { numRuns: 100 },
    )
  })
})

describe('brideMoveBlocked', () => {
  const wall: BrideCollider = { kind: 'wall', minX: -1, maxX: 1, minZ: 5, maxZ: 6 }
  const fence: BrideCollider = { kind: 'prop', minX: -1, maxX: 1, minZ: 5, maxZ: 6 }
  const r = WEAPON_MAP['salt-circle'].radius ?? 0

  it('blocks walls and salt circles but never fences or gravestones', () => {
    // Feature: 11-horror-pass, Property 7: Bride rules
    // **Validates: Requirements 2.9**
    fc.assert(
      fc.property(fc.double({ min: -0.9, max: 0.9, noNaN: true }), (x) => {
        expect(brideMoveBlocked({ x, z: 4 }, { x, z: 7 }, [wall], [])).toBe(true)
        expect(brideMoveBlocked({ x, z: 4 }, { x, z: 7 }, [fence], [])).toBe(false)
        expect(brideMoveBlocked({ x: 3, z: 0 }, { x: 4, z: 0 }, [wall, fence], [])).toBe(false)
        const salt = [{ pos: { x: 0, z: 0 } }]
        expect(brideMoveBlocked({ x: r + 1, z: 0 }, { x: r - 0.1, z: 0 }, [], salt)).toBe(true)
        expect(brideMoveBlocked({ x: r + 1, z: 0 }, { x: r + 0.5, z: 0 }, [], salt)).toBe(false)
        // Standing inside a circle, she may only step out of it.
        expect(brideMoveBlocked({ x: 0.5, z: 0 }, { x: 1, z: 0 }, [], salt)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})

describe('brideDamage', () => {
  it('lead does nothing and shows the cue; holy water, sabre and Blessed Rounds deal normal damage', () => {
    // Feature: 11-horror-pass, Property 7: Bride rules
    // **Validates: Requirements 2.10, 2.11**
    const sources: BrideDamageSource[] = ['lead', 'holy-water', 'silver-sabre', 'blessed-rounds']
    fc.assert(
      fc.property(fc.constantFrom(...sources), fc.double({ min: 0, max: 300, noNaN: true }), (s, amt) => {
        const r = brideDamage(s, amt)
        if (s === 'lead') expect(r).toEqual({ damage: 0, noEffectCue: true })
        else expect(r).toEqual({ damage: amt, noEffectCue: false })
      }),
      { numRuns: 100 },
    )
  })
})

describe('lanternBend', () => {
  it('multiplies the light by 0.7 within 8 m and 1 outside', () => {
    // Feature: 11-horror-pass, Property 11: Bride lantern effect
    // **Validates: Requirements 2.16**
    fc.assert(
      fc.property(fc.double({ min: 0, max: 30, noNaN: true }), (d) => {
        const r = lanternBend(d, 1, 1, true)
        expect(r.target).toBe(d <= 8 ? 0.7 : 1)
        expect(r.dim).toBe(r.target)
        expect(r.bend).toBeGreaterThanOrEqual(0)
        expect(r.bend).toBeLessThanOrEqual(1)
        if (d > 8) expect(r.bend).toBe(0)
      }),
      { numRuns: 100 },
    )
  })

  it('changes by at most 0.7 per second with Flashing lights off', () => {
    // Feature: 11-horror-pass, Property 11: Bride lantern effect
    // **Validates: Requirements 2.16**
    const stepArb = fc.record({ d: fc.double({ min: 0, max: 20, noNaN: true }), dt: fc.double({ min: 0.001, max: 0.5, noNaN: true }) })
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 60 }), (steps) => {
        let dim = 1
        for (const { d, dt } of steps) {
          const next = lanternBend(d, dim, dt, false).dim
          expect(Math.abs(next - dim)).toBeLessThanOrEqual(0.7 * dt + 1e-9)
          dim = next
        }
      }),
      { numRuns: 100 },
    )
  })
})
