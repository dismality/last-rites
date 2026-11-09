import { describe, expect, it } from 'vitest'
import { CHAPEL, CHAPEL_CENTER, GROUNDS_HALF } from './cemeteryLayout'
import { ELITE } from './elites'
import { MERCHANT_SPOT } from './merchant'
import { MODES } from './modes'
import { WAVE_GRAVES } from './waves'

const MIN_GRAVE_CLEARANCE_M = 5

describe('merchant placement (spec 08 Req 5.1)', () => {
  const spots = [
    ['cart', MERCHANT_SPOT.cart],
    ['silas', MERCHANT_SPOT.silas],
  ] as const

  for (const [name, [x, , z]] of spots) {
    it(`${name} is at least ${MIN_GRAVE_CLEARANCE_M} m from every wave grave`, () => {
      for (const g of WAVE_GRAVES) {
        expect(Math.hypot(x - g.x, z - g.z), `${name} to ${g.id}`).toBeGreaterThanOrEqual(MIN_GRAVE_CLEARANCE_M)
      }
    })

    it(`${name} is outside the chapel box`, () => {
      const inside =
        Math.abs(x - CHAPEL_CENTER[0]) <= CHAPEL.halfX && Math.abs(z - CHAPEL_CENTER[2]) <= CHAPEL.halfZ
      expect(inside, `${name} inside chapel`).toBe(false)
    })

    it(`${name} is inside the south fence`, () => {
      expect(z, `${name} z`).toBeLessThan(GROUNDS_HALF)
      expect(z, `${name} z`).toBeGreaterThan(0)
      expect(Math.abs(x), `${name} x`).toBeLessThan(GROUNDS_HALF)
    })
  }
})

describe('elite multipliers shared with spec 07', () => {
  it('Normal mode elite chance equals ELITE.chance.normal', () => {
    expect(MODES.normal.eliteChance).toBe(ELITE.chance.normal)
    expect(MODES.endless.eliteChance).toBe(ELITE.chance.normal)
  })

  it('Normal mode leaves ELITE multipliers unscaled (mode HP and damage are separate factors)', () => {
    expect(MODES.normal.hpMult).toBe(1)
    expect(MODES.normal.damageMult).toBe(1)
    expect(ELITE.hpMult).toBe(2)
    expect(ELITE.damageMult).toBe(1.25)
    expect(ELITE.speedMult).toBe(1.15)
  })

  it('Easy and Hard elite chances bracket Normal', () => {
    expect(MODES.easy.eliteChance).toBeLessThan(ELITE.chance.normal)
    expect(MODES.hard.eliteChance).toBeGreaterThan(ELITE.chance.normal)
  })
})
