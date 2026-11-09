import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { numberText, spawnNumbers, tickNumbers, type DamageNumber } from './damageNumbers'

const hit = fc.record({
  point: fc.tuple(
    fc.double({ min: -50, max: 50, noNaN: true }),
    fc.double({ min: 0, max: 3, noNaN: true }),
    fc.double({ min: -50, max: 50, noNaN: true }),
  ),
  damage: fc.integer({ min: 1, max: 300 }),
  headshot: fc.boolean(),
})

describe('damageNumbers', () => {
  // Feature: 07-combat-and-enemies, Property 19: Hit markers and damage numbers
  // **Validates: Requirements 10.4, 10.5, 10.6, 10.7, 10.12**
  it('property: one number per hit, none when disabled, headshot text ends with "!"', () => {
    fc.assert(
      fc.property(fc.array(hit, { maxLength: 6 }), fc.boolean(), (hits, enabled) => {
        const r = spawnNumbers([], hits, enabled, 5)
        expect(r.list.length).toBe(enabled ? hits.length : 0)
        r.list.forEach((n) => expect(numberText(n).endsWith('!')).toBe(n.headshot))
      }),
    )
  })

  it('property: no number outlives 0.8 s and the list never exceeds 24', () => {
    fc.assert(
      fc.property(
        fc.array(hit, { minLength: 1, maxLength: 40 }),
        fc.array(fc.double({ min: 0, max: 0.3, noNaN: true }), { maxLength: 20 }),
        (hits, steps) => {
          let list: DamageNumber[] = spawnNumbers([], hits, true, 0).list
          expect(list.length).toBeLessThanOrEqual(24)
          for (const dt of steps) {
            list = tickNumbers(list, dt)
            list.forEach((n) => expect(n.ageS).toBeLessThan(0.8))
          }
        },
      ),
    )
  })

  it('rises at 1.2 m/s and drops the oldest past the cap', () => {
    const { list } = spawnNumbers([], [{ point: [0, 1, 0], damage: 34, headshot: true }], true, 0)
    expect(tickNumbers(list, 0.5)[0].y).toBeCloseTo(1.6)
    expect(tickNumbers(list, 0.8)).toEqual([])
    const many = spawnNumbers(
      [],
      Array.from({ length: 30 }, () => ({ point: [0, 0, 0] as const, damage: 1, headshot: false })),
      true,
      0,
    )
    expect(many.list[0].id).toBe(6)
    expect(numberText(list[0])).toBe('34!')
  })
})
