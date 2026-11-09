import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  DUST_LIFETIME_S,
  DUST_PER_HIT,
  HIT_SHAKE_AMPLITUDE,
  STAGGER_S,
  forwardFromYaw,
  resolveMelee,
  shakeAllowed,
  shakeMagnitude,
  spawnDust,
  startSwing,
  swingPose,
  tickDust,
  tickStagger,
  tickSwing,
  type StaggerEnemy,
} from './melee'

const zombie = (uid: string, x: number, z: number, hp = 60): StaggerEnemy => ({
  uid,
  type: 'shambler',
  hp,
  pos: { x, z },
  stagger: 0,
})

describe('swing timing', () => {
  it('fires the hit exactly once, at the midpoint', () => {
    let s: ReturnType<typeof startSwing> | null = startSwing(0.6)
    let hits = 0
    let hitAt = -1
    for (let i = 0; s && i < 100; i++) {
      const r = tickSwing(s, 1 / 60)
      if (r.hit) {
        hits++
        hitAt = (i + 1) / 60
      }
      s = r.swing
    }
    expect(hits).toBe(1)
    expect(hitAt).toBeGreaterThanOrEqual(0.3)
    expect(hitAt).toBeLessThan(0.3 + 1 / 30)
    expect(s).toBeNull()
  })

  it('still reports the hit if one huge step jumps over the whole swing', () => {
    expect(tickSwing(startSwing(0.9), 5)).toEqual({ swing: null, hit: true })
  })

  it('pose starts and ends near rest', () => {
    expect(swingPose(0).rotX).toBeCloseTo(0)
    expect(Math.abs(swingPose(1).rotX)).toBeLessThan(0.05)
    expect(swingPose(0.5).rotX).toBeGreaterThan(0.5)
  })
})

describe('resolveMelee', () => {
  const ctx = { lanternFuel: 100 }
  it('damages and staggers zombies in the cone only', () => {
    const dir = forwardFromYaw(0) // -Z
    const r = resolveMelee({ x: 0, z: 0 }, dir, 25, [zombie('a', 0, -1.5), zombie('b', 0, 1.5), zombie('c', 0, -3)], ctx)
    expect(r.hitUids).toEqual(['a'])
    expect(r.enemies[0]).toMatchObject({ hp: 35, stagger: STAGGER_S })
    expect(r.enemies[1]).toMatchObject({ hp: 60, stagger: 0 })
  })

  it('a heavy hit knocks survivors down and caps Brute stagger', () => {
    const brute = { ...zombie('b', 0, -1, 300), type: 'brute' as const }
    const crane = { ...zombie('c', 0, -1.2, 1500), type: 'father-crane' as const }
    const r = resolveMelee({ x: 0, z: 0 }, { x: 0, z: -1 }, 70, [brute, crane, zombie('s', 0, -1.4)], ctx, { knockdownS: 1.5 })
    expect(r.enemies[0]).toMatchObject({ hp: 230, knockdown: 1.5, stagger: 0.3 })
    expect(r.enemies[1]).toMatchObject({ hp: 1430, stagger: 0 })
    expect(r.enemies[1].knockdown).toBeUndefined()
    expect(r.enemies[2]).toMatchObject({ hp: 0 })
    expect(r.enemies[2].knockdown).toBeUndefined()
  })

  it('a light hit applies no knockdown and resets rather than extends', () => {
    const down = { ...zombie('a', 0, -1), knockdown: 5 }
    const r = resolveMelee({ x: 0, z: 0 }, { x: 0, z: -1 }, 10, [down], ctx, { knockdownS: 1.2 })
    expect(r.enemies[0].knockdown).toBe(1.2)
    expect(resolveMelee({ x: 0, z: 0 }, { x: 0, z: -1 }, 10, [zombie('a', 0, -1)], ctx).enemies[0].knockdown).toBeUndefined()
  })

  it('reports kills', () => {
    const r = resolveMelee({ x: 0, z: 0 }, { x: 0, z: -1 }, 100, [zombie('a', 0, -1, 10)], ctx)
    expect(r.killedUids).toEqual(['a'])
  })

  it('never raises hp', () => {
    fc.assert(
      fc.property(fc.double({ min: -10, max: 10, noNaN: true }), fc.double({ min: -10, max: 10, noNaN: true }), fc.integer({ min: 0, max: 200 }), (x, z, dmg) => {
        const r = resolveMelee({ x: 0, z: 0 }, { x: 0, z: -1 }, dmg, [zombie('a', x, z)], ctx)
        expect(r.enemies[0].hp).toBeLessThanOrEqual(60)
        expect(r.enemies[0].hp).toBeGreaterThanOrEqual(0)
      }),
    )
  })

  it('stagger counts down to zero', () => {
    const e = [{ ...zombie('a', 0, 0), stagger: STAGGER_S }]
    expect(tickStagger(e, 0.2)[0].stagger).toBeCloseTo(0.1)
    expect(tickStagger(e, 1)[0].stagger).toBe(0)
  })
})

describe('shake', () => {
  it('is blocked by the setting or reduced motion', () => {
    expect(shakeAllowed(true, false)).toBe(true)
    expect(shakeAllowed(false, false)).toBe(false)
    expect(shakeAllowed(true, true)).toBe(false)
  })
  it('decays to zero', () => {
    expect(shakeMagnitude(0)).toBe(HIT_SHAKE_AMPLITUDE)
    expect(shakeMagnitude(1)).toBe(0)
  })
})

describe('dust', () => {
  it('spawns a burst that expires', () => {
    let ps = spawnDust({ x: 0, y: 1, z: 0 }, () => 0.5)
    expect(ps).toHaveLength(DUST_PER_HIT)
    ps = tickDust(ps, DUST_LIFETIME_S + 0.01)
    expect(ps).toHaveLength(0)
  })
})
