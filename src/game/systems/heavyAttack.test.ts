// Tests for src/game/systems/heavyAttack.ts
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  startCharge,
  tickCharge,
  resolveRelease,
  meleeDamageFor,
  heavyStatsFor,
} from './heavyAttack'
import { WEAPON_MAP } from '../../data/weapons'
import type { HeavyMeleeId } from '../types'

const axe = heavyStatsFor('wood-axe')
const sabre = heavyStatsFor('silver-sabre')

describe('heavyStatsFor', () => {
  it('matches the bible with no upgrades', () => {
    expect(axe).toMatchObject({ chargeS: 0.8, lightDamage: 30, heavyDamage: 70, staminaCost: 25 })
    expect(sabre).toMatchObject({ chargeS: 0.6, lightDamage: 28, heavyDamage: 60, staminaCost: 20 })
  })

  it('honours upgrades', () => {
    expect(heavyStatsFor('wood-axe', ['up-axe-edge'])).toMatchObject({ lightDamage: 38, heavyDamage: 88 })
    expect(heavyStatsFor('silver-sabre', ['up-sabre-hilt']).staminaCost).toBe(12)
    expect(heavyStatsFor('silver-sabre', ['up-sabre-blessed'])).toMatchObject({ lightDamage: 34, heavyDamage: 72 })
  })

  it('ignores upgrades for another weapon', () => {
    expect(heavyStatsFor('wood-axe', ['up-sabre-hilt']).staminaCost).toBe(25)
  })
})

describe('charge and release', () => {
  it('is full exactly at the charge time', () => {
    let c = startCharge(false)
    let r = tickCharge(c, 0.79, 0.8)
    expect(r.full).toBe(false)
    c = r.charge
    r = tickCharge(c, 0.01, 0.8)
    expect(r.full).toBe(true)
  })

  it('auto charge releases itself when full; manual does not', () => {
    expect(tickCharge(startCharge(true), 1, 0.6).autoRelease).toBe(true)
    expect(tickCharge(startCharge(false), 1, 0.6).autoRelease).toBe(false)
  })

  it('early release is a normal attack with no stamina spent', () => {
    expect(resolveRelease({ heldS: 0.3, auto: false }, axe, 100)).toEqual({
      kind: 'normal', tooTired: false, staminaSpent: 0,
    })
  })

  it('full release with enough stamina is heavy and spends the cost', () => {
    expect(resolveRelease({ heldS: 0.8, auto: false }, axe, 25)).toEqual({
      kind: 'heavy', tooTired: false, staminaSpent: 25,
    })
  })

  it('full release below the cost is normal, too tired, free', () => {
    expect(resolveRelease({ heldS: 0.6, auto: true }, sabre, 19.9)).toEqual({
      kind: 'normal', tooTired: true, staminaSpent: 0,
    })
  })
})

describe('meleeDamageFor', () => {
  it('sabre heavy against a Wailer is 90, against a Shambler 60', () => {
    expect(meleeDamageFor(sabre, 'heavy', 'wailer')).toBe(90)
    expect(meleeDamageFor(sabre, 'heavy', 'shambler')).toBe(60)
  })

  it('axe has no Wailer bonus; normal swings use light damage', () => {
    expect(meleeDamageFor(axe, 'heavy', 'wailer')).toBe(70)
    expect(meleeDamageFor(axe, 'normal', 'shambler')).toBe(30)
    expect(meleeDamageFor(sabre, 'normal', 'shambler')).toBe(28)
  })

  it('plain weapon defs use their damage', () => {
    expect(meleeDamageFor(WEAPON_MAP['bone-club'], 'normal', 'wailer')).toBe(25)
  })
})

describe('property tests', () => {
  const arbId = fc.constantFrom<HeavyMeleeId>('wood-axe', 'silver-sabre')
  const arbDt = fc.double({ min: 0, max: 0.5, noNaN: true })

  // Feature: 07-combat-and-enemies, Property 15: Heavy release rules never overspend stamina
  // **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.13, 8.14**
  it('Property 15: release rules never overspend stamina', () => {
    fc.assert(
      fc.property(
        arbId,
        fc.subarray(['up-axe-edge', 'up-sabre-hilt', 'up-sabre-blessed', 'up-axe-haft'] as const),
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.boolean(),
        (id, ups, heldS, stamina, auto) => {
          const h = heavyStatsFor(id, ups)
          const r = resolveRelease({ heldS, auto }, h, stamina)
          const full = heldS >= h.chargeS
          expect(stamina - r.staminaSpent).toBeGreaterThanOrEqual(0)
          if (!full) expect(r).toEqual({ kind: 'normal', tooTired: false, staminaSpent: 0 })
          else if (stamina >= h.staminaCost) expect(r).toEqual({ kind: 'heavy', tooTired: false, staminaSpent: h.staminaCost })
          else expect(r).toEqual({ kind: 'normal', tooTired: true, staminaSpent: 0 })
        },
      ),
      { numRuns: 300 },
    )
  })

  // Feature: 07-combat-and-enemies, Property 15 (meter)
  it('Property 15: the meter is non-decreasing and full exactly at the charge time', () => {
    fc.assert(
      fc.property(arbId, fc.array(arbDt, { maxLength: 40 }), (id, dts) => {
        const chargeS = heavyStatsFor(id).chargeS
        let c = startCharge(false)
        let total = 0
        for (const dt of dts) {
          const r = tickCharge(c, dt, chargeS)
          expect(r.charge.heldS).toBeGreaterThanOrEqual(c.heldS)
          total += dt
          expect(r.full).toBe(total >= chargeS || r.charge.heldS >= chargeS)
          c = r.charge
        }
        expect(c.heldS).toBeLessThanOrEqual(chargeS)
      }),
      { numRuns: 200 },
    )
  })
})
