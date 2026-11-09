import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { HEAD_ZONE_M, FIREARMS } from '../../data/firearms'
import { createRng } from '../rng'
import {
  capsuleFor,
  rayDamage,
  rayVsCapsule,
  resolveShot,
  spreadDirection,
  type Capsule,
  type FirearmStats,
  type ShotInput,
  type WallDistance,
} from './ballistics'
import type { Vec3 } from './projectiles'

const NO_WALL: WallDistance = () => Infinity
const firearm = fc.constantFrom(...FIREARMS)
const num = (min: number, max: number) => fc.double({ min, max, noNaN: true })
const vec = fc
  .tuple(num(-1, 1), num(-1, 1), num(-1, 1))
  .filter(([x, y, z]) => Math.hypot(x, y, z) > 0.05)
  .map(([x, y, z]): Vec3 => ({ x, y, z }))

const angleDeg = (a: Vec3, b: Vec3): number => {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z
  const la = Math.hypot(a.x, a.y, a.z)
  const lb = Math.hypot(b.x, b.y, b.z)
  return (Math.acos(Math.min(1, Math.max(-1, dot / (la * lb)))) * 180) / Math.PI
}

const shotAt = (stats: FirearmStats, over: Partial<ShotInput> = {}): ShotInput => ({
  weapon: stats.pellets > 1 ? 'shotgun' : 'revolver',
  origin: { x: 0, y: 1.6, z: 0 },
  aim: { x: 0, y: 0, z: 1 },
  aiming: false,
  stats,
  blessed: false,
  seed: 1,
  ...over,
})

const capsuleAt = (uid: string, z: number, x = 0): Capsule => ({
  uid,
  x,
  z,
  radius: 0.35,
  height: 1.75,
})

describe('capsuleFor', () => {
  it('uses model height times scale y, and the short capsule while knocked down', () => {
    const base = { uid: 'a', pos: { x: 1, z: 2 } }
    expect(capsuleFor({ ...base, type: 'shambler' }).height).toBeCloseTo(1.75)
    expect(capsuleFor({ ...base, type: 'brute' }).height).toBeCloseTo(1.95)
    const bloater = capsuleFor({ ...base, type: 'bloater' })
    expect(bloater.height).toBeCloseTo(1.75 * 1.1)
    expect(bloater.radius).toBeCloseTo(0.35 * 1.35)
    expect(capsuleFor({ ...base, type: 'brute', elite: true }).height).toBeCloseTo(1.95 * 1.05)
    expect(capsuleFor({ ...base, type: 'brute', knockdown: 1 }).height).toBe(0.5)
  })
})

describe('resolveShot basics', () => {
  const [revolver, shotgun] = FIREARMS
  it('zero or non-finite aim fires nothing', () => {
    const target = [capsuleAt('z', 5)]
    for (const aim of [
      { x: 0, y: 0, z: 0 },
      { x: NaN, y: 0, z: 1 },
      { x: Infinity, y: 0, z: 0 },
    ]) {
      expect(resolveShot(shotAt(revolver, { aim }), target, NO_WALL)).toEqual({ hits: [], rays: 0 })
    }
  })
  it('revolver body hit deals 34; a nearer wall hides the zombie', () => {
    const stats = { ...revolver, spreadHipDeg: 0 }
    const target = [capsuleAt('z', 10)]
    const r = resolveShot(shotAt(stats, { origin: { x: 0, y: 1.0, z: 0 } }), target, NO_WALL)
    expect(r.hits[0].damage).toBe(34)
    expect(resolveShot(shotAt(stats), target, () => 5).hits).toEqual([])
  })
  it('shotgun pellets all hit a close target and add up', () => {
    const stats = { ...shotgun, spreadHipDeg: 0 }
    const r = resolveShot(shotAt(stats, { origin: { x: 0, y: 1.0, z: 0 } }), [capsuleAt('z', 3)], NO_WALL)
    expect(r.rays).toBe(8)
    expect(r.hits).toHaveLength(1)
    expect(r.hits[0].pellets).toBe(8)
    expect(r.hits[0].damage).toBe(72)
  })
})

describe('ballistics properties', () => {
  // Feature: 07-combat-and-enemies, Property 3: Spread stays inside the cone
  it('Property 3: spread directions are unit vectors inside the cone', () => {
    // **Validates: Requirements 3.13**
    fc.assert(
      fc.property(vec, num(0, 30), fc.integer(), (aim, cone, seed) => {
        const rng = createRng(seed)
        for (let i = 0; i < 8; i++) {
          const d = spreadDirection(aim, cone, rng)
          expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6)
          // acos amplifies rounding near 0°, so allow a small angular slack.
          expect(angleDeg(aim, d)).toBeLessThanOrEqual(cone + 1e-3)
        }
      }),
      { numRuns: 200 },
    )
  })

  // Feature: 07-combat-and-enemies, Property 4: Damage is non-negative, bounded by range, and monotone in distance
  it('Property 4: damage is non-negative, range bounded and non-increasing', () => {
    // **Validates: Requirements 3.6, 3.7, 3.14**
    fc.assert(
      fc.property(firearm, num(0, 80), num(0, 80), fc.boolean(), fc.boolean(), (f, d1, d2, head, blessed) => {
        const near = Math.min(d1, d2)
        const far = Math.max(d1, d2)
        const dn = rayDamage(f, near, head, blessed)
        const df = rayDamage(f, far, head, blessed)
        expect(dn).toBeGreaterThanOrEqual(0)
        expect(df).toBeLessThanOrEqual(dn)
        if (f.id === 'revolver' && far > 40) expect(df).toBe(0)
        if (f.id === 'shotgun') {
          if (far >= 20) expect(df).toBe(0)
          if (near <= 15) expect(dn).toBe(rayDamage(f, 0, head, blessed))
        }
      }),
      { numRuns: 200 },
    )
  })

  it('Property 4: shotgun falloff is linear between 15 m and 20 m', () => {
    // **Validates: Requirements 3.7**
    const shotgun = FIREARMS[1]
    fc.assert(
      fc.property(num(15, 20), (d) => {
        const full = rayDamage(shotgun, 0, false, false)
        expect(rayDamage(shotgun, d, false, false)).toBeCloseTo(full * ((20 - d) / 5), 9)
      }),
    )
  })

  // Feature: 07-combat-and-enemies, Property 5: Headshots never deal less than body hits; Blessed doubles
  it('Property 5: headshot multiplies, never lowers; Blessed doubles', () => {
    // **Validates: Requirements 3.4, 3.11, 3.15**
    fc.assert(
      fc.property(firearm, num(0, 60), fc.boolean(), (f, d, head) => {
        const body = rayDamage(f, d, false, false)
        const headshot = rayDamage(f, d, true, false)
        expect(headshot).toBeGreaterThanOrEqual(body)
        expect(headshot).toBeCloseTo(body * f.headshotMult, 9)
        expect(rayDamage(f, d, head, true)).toBeCloseTo(2 * rayDamage(f, d, head, false), 9)
      }),
      { numRuns: 200 },
    )
  })

  // Feature: 07-combat-and-enemies, Property 6: The head zone is the top 0.3 m of the capsule
  it('Property 6: headshot iff hit height is within the top 0.3 m', () => {
    // **Validates: Requirements 3.1, 3.4**
    const stats = { ...FIREARMS[0], spreadHipDeg: 0 }
    fc.assert(
      fc.property(num(0.4, 3), num(1.2, 2.4), num(3, 30), (_h, _unused, dist) => {
        // Shoot horizontally at heights spanning the body, away from the exact threshold.
        for (const y of [0.4, 0.9, 1.4, 1.74 - HEAD_ZONE_M, 1.75 - HEAD_ZONE_M + 0.02, 1.7]) {
          const r = resolveShot(shotAt(stats, { origin: { x: 0, y, z: 0 } }), [capsuleAt('z', dist)], NO_WALL)
          expect(r.hits).toHaveLength(1)
          expect(r.hits[0].headshot).toBe(y >= 1.75 - HEAD_ZONE_M)
        }
      }),
      { numRuns: 50 },
    )
  })

  it('Property 6: the nearest zombie wins and a nearer wall hides everything', () => {
    // **Validates: Requirements 3.1**
    const stats = { ...FIREARMS[0], spreadHipDeg: 0 }
    fc.assert(
      fc.property(num(2, 10), num(1, 10), num(0.5, 30), (nearZ, gap, wallM) => {
        const targets = [capsuleAt('far', nearZ + gap + 1), capsuleAt('near', nearZ)]
        const shot = shotAt(stats, { origin: { x: 0, y: 1.0, z: 0 } })
        const r = resolveShot(shot, targets, NO_WALL)
        expect(r.hits.map((h) => h.uid)).toEqual(['near'])
        const walled = resolveShot(shot, targets, () => wallM)
        const expectNear = wallM > nearZ - 0.35
        expect(walled.hits.length).toBe(expectNear ? 1 : 0)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 6: a ray that misses the capsule returns null', () => {
    // **Validates: Requirements 3.1**
    expect(rayVsCapsule({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 50, capsuleAt('z', 5, 1))).toBeNull()
  })

  // Feature: 07-combat-and-enemies, Property 7: A shot spends exactly one round and merges hits per zombie
  it('Property 7: 1 or 8 rays, unique zombie ids, summed damage', () => {
    // **Validates: Requirements 3.1, 3.2, 3.3, 3.12, 10.4**
    fc.assert(
      fc.property(
        firearm,
        fc.integer(),
        fc.boolean(),
        fc.array(fc.tuple(num(-2, 2), num(2, 18)), { minLength: 0, maxLength: 6 }),
        (f, seed, aiming, spots) => {
          const targets = spots.map(([x, z], i) => capsuleAt(`z${i}`, z, x))
          const r = resolveShot(shotAt(f, { seed, aiming }), targets, NO_WALL)
          expect(r.rays).toBe(f.id === 'shotgun' ? 8 : 1)
          const ids = r.hits.map((h) => h.uid)
          expect(new Set(ids).size).toBe(ids.length)
          expect(r.hits.reduce((n, h) => n + h.pellets, 0)).toBeLessThanOrEqual(r.rays)
          for (const h of r.hits) expect(h.damage).toBeGreaterThan(0)
        },
      ),
      { numRuns: 150 },
    )
  })

  it('Property 7: with no spread, merged damage equals the sum of the rays', () => {
    // **Validates: Requirements 3.12, 10.4**
    const stats = { ...FIREARMS[1], spreadHipDeg: 0 }
    fc.assert(
      fc.property(num(1, 14), fc.boolean(), (z, blessed) => {
        const r = resolveShot(shotAt(stats, { blessed, origin: { x: 0, y: 1.0, z: 0 } }), [capsuleAt('z', z)], NO_WALL)
        expect(r.hits).toHaveLength(1)
        const hit = r.hits[0]
        expect(hit.pellets).toBe(8)
        expect(hit.damage).toBeCloseTo(8 * rayDamage(stats, hit.nearestM, false, blessed), 6)
      }),
    )
  })
})
