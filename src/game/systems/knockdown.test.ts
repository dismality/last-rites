import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import type { EnemyId } from '../../data/enemies'
import { SHOTGUN_BRUTE_KNOCKDOWN } from '../../data/firearms'
import { applyDamage } from './combat'
import { applyKnockdown, applyStagger, knockdownDamageMult, shotKnocksDown } from './knockdown'
import type { StaggerEnemy } from './melee'

const IDS: EnemyId[] = ['shambler', 'lurker', 'wailer', 'bloater', 'brute', 'father-crane']
const arbType = fc.constantFrom<EnemyId>(...IDS)
const mk = (type: EnemyId, knockdown?: number, hp = 1000): StaggerEnemy => ({
  uid: 'z',
  type,
  hp,
  pos: { x: 0, z: 0 },
  stagger: 0,
  knockdown,
})

describe('knockdown', () => {
  it('sets, resets and never extends the timer', () => {
    expect(applyKnockdown(mk('shambler'), 1.5).knockdown).toBe(1.5)
    expect(applyKnockdown(mk('shambler', 5), 1.2).knockdown).toBe(1.2)
  })

  it('leaves Father Crane unchanged', () => {
    const crane = mk('father-crane')
    expect(applyKnockdown(crane, 1.5)).toBe(crane)
    expect(applyStagger(crane, 0.6)).toBe(crane)
  })

  it('caps Brute stagger at 0.3 s', () => {
    expect(applyStagger(mk('brute'), 0.6).stagger).toBe(0.3)
    expect(applyStagger(mk('brute'), 0.1).stagger).toBe(0.1)
    expect(applyStagger(mk('shambler'), 0.6).stagger).toBe(0.6)
  })

  it('multiplies damage by 1.25 only while down', () => {
    expect(knockdownDamageMult({ knockdown: 0.5 })).toBe(1.25)
    expect(knockdownDamageMult({ knockdown: 0 })).toBe(1)
    expect(knockdownDamageMult({})).toBe(1)
  })

  it('knocks a Brute down from 3 m or closer only', () => {
    expect(shotKnocksDown('brute', 3)).toBe(true)
    expect(shotKnocksDown('brute', 3.01)).toBe(false)
    expect(shotKnocksDown('shambler', 1)).toBe(false)
  })

  // Feature: 07-combat-and-enemies, Property 16: Knockdown resets, never extends, and disarms
  // **Validates: Requirements 8.6, 8.7, 8.8, 8.9, 9.2, 9.3, 14.3, 14.4, 14.5, 14.6, 17.11**
  it('property 16: timer resets to the duration; Crane immune', () => {
    fc.assert(
      fc.property(arbType, fc.double({ min: 0, max: 10, noNaN: true }), fc.double({ min: 0.1, max: 3, noNaN: true }), (type, before, dur) => {
        const out = applyKnockdown(mk(type, before), dur)
        expect(out.knockdown).toBe(type === 'father-crane' ? before : dur)
      }),
    )
  })

  it('property 16: Brute stagger <= 0.3 s, Crane untouched', () => {
    fc.assert(
      fc.property(arbType, fc.double({ min: 0, max: 5, noNaN: true }), (type, s) => {
        const out = applyStagger(mk(type), s)
        if (type === 'father-crane') expect(out.stagger).toBe(0)
        else if (type === 'brute') expect(out.stagger).toBeLessThanOrEqual(0.3)
        else expect(out.stagger).toBe(s)
      }),
    )
  })

  it('property 16: x1.25 while down, Sabre +50% on Wailers only, never negative HP', () => {
    fc.assert(
      fc.property(arbType, fc.double({ min: 0, max: 100, noNaN: true }), fc.boolean(), (type, dmg, sabre) => {
        const ctx = { lanternFuel: 100, weapon: sabre ? ('silver-sabre' as const) : undefined }
        const up = applyDamage(mk(type, 0, 5000), dmg, ctx)
        const down = applyDamage(mk(type, 1, 5000), dmg, ctx)
        expect(5000 - down.hp).toBeCloseTo((5000 - up.hp) * 1.25, 6)
        const bonus = sabre && type === 'wailer' ? 1.5 : 1
        expect(5000 - up.hp).toBeCloseTo(dmg * bonus, 6)
        expect(down.hp).toBeGreaterThanOrEqual(0)
      }),
    )
  })

  it('property 16: shotgun knocks a Brute down iff nearest hit within 3 m', () => {
    fc.assert(
      fc.property(arbType, fc.double({ min: 0, max: 20, noNaN: true }), (type, d) => {
        expect(shotKnocksDown(type, d)).toBe(type === 'brute' && d <= SHOTGUN_BRUTE_KNOCKDOWN.withinM)
      }),
    )
  })
})
