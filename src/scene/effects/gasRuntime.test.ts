import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { GAS_LIFE_S, GAS_POOL, spawnGas, tickGas } from './gasRuntime'
import { glyphIndex } from './damageNumberAtlas'
import { numberText } from '../../game/systems/damageNumbers'

describe('grave gas', () => {
  it('puffs expire after the 1.2 s life', () => {
    const puffs = spawnGas({ x: 0, z: 0 }, () => 0.5)
    expect(tickGas(puffs, GAS_LIFE_S - 0.1)).toHaveLength(puffs.length)
    expect(tickGas(puffs, GAS_LIFE_S + 0.01)).toHaveLength(0)
  })

  it('never exceeds the 96-quad pool', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (bursts) => {
        let all = spawnGas({ x: 0, z: 0 }, Math.random).slice(0, 0)
        for (let i = 0; i < bursts; i++) all = all.concat(spawnGas({ x: i, z: 0 }, Math.random))
        expect(tickGas(all, 0.01).length).toBeLessThanOrEqual(GAS_POOL)
      }),
    )
  })
})

describe('damage number glyphs', () => {
  it('every character of a number has an atlas cell, headshots include "!"', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9999 }), fc.boolean(), (value, headshot) => {
        const text = numberText({ id: 1, x: 0, y: 0, z: 0, value, headshot, ageS: 0 })
        expect([...text].every((c) => glyphIndex(c) >= 0)).toBe(true)
        expect(text.endsWith('!')).toBe(headshot)
      }),
    )
  })
})
