import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOORS } from '../../data/barricades'
import type { EnemyId } from '../../data/enemies'
import type { DoorId } from '../types'
import {
  boardDamageFor,
  buildBarricades,
  canBeDoorAttacker,
  damageDoor,
  doorAttackerCount,
  doorLine,
  type BarricadeState,
} from './barricade'

const enemies: EnemyId[] = ['shambler', 'lurker', 'wailer', 'bloater', 'brute', 'father-crane']
const doorArb = fc.constantFrom<DoorId>('front', 'vestry')
const boardsArb = fc.array(fc.integer({ min: 1, max: 75 }), { maxLength: DOORS.slots })
const stateArb: fc.Arbitrary<BarricadeState> = fc.record({
  built: fc.constant(true),
  doors: fc.record({ front: boardsArb, vestry: boardsArb }),
})

describe('barricade', () => {
  it('builds 2 full boards per door', () => {
    const s = buildBarricades(60)
    expect(s.doors.front).toEqual([60, 60])
    expect(s.doors.vestry).toEqual([60, 60])
  })

  it('formats door lines', () => {
    expect(doorLine('front', [60, 41])).toBe('Front door 2/3 (60, 41)')
    expect(doorLine('vestry', [])).toBe('Vestry 0/3')
  })

  it('limits door attackers to shamblers and brutes', () => {
    expect(enemies.filter(canBeDoorAttacker)).toEqual(['shambler', 'brute'])
  })

  it('damages only the lowest board and drops the excess', () => {
    const s: BarricadeState = { built: true, doors: { front: [60, 10], vestry: [60] } }
    const r = damageDoor(s, 'front', 50)
    expect(r.applied).toBe(10)
    expect(r.removed).toBe(true)
    expect(r.state.doors.front).toEqual([60])
  })

  // Feature: 07-combat-and-enemies, Property 25: Barricade state stays valid and conserves health and materials
  it('Property 25: damage keeps bounds and conserves health', () => {
    // **Validates: Requirements 16.10, 16.11, 16.14, 16.15**
    fc.assert(
      fc.property(stateArb, doorArb, fc.array(fc.integer({ min: 0, max: 200 }), { maxLength: 12 }), (s0, id, hits) => {
        let s = s0
        for (const h of hits) {
          const before = s.doors[id]
          const r = damageDoor(s, id, h)
          const after = r.state.doors[id]
          const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)
          expect(sum(before) - sum(after)).toBeCloseTo(r.applied, 9)
          if (before.length > 0) expect(r.applied).toBe(Math.min(h, Math.min(...before)))
          expect(after.length).toBeGreaterThanOrEqual(0)
          expect(after.length).toBeLessThanOrEqual(DOORS.slots)
          expect(after.every((b) => b > 0 && b <= 75)).toBe(true)
          const other: DoorId = id === 'front' ? 'vestry' : 'front'
          expect(r.state.doors[other]).toBe(s.doors[other])
          s = r.state
        }
      }),
    )
  })

  it('Property 25: Brute and rite multipliers', () => {
    // **Validates: Requirements 14.9, 16.10**
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.constantFrom(...enemies), fc.boolean(), (hit, e, rite) => {
        const m = (e === 'brute' ? 2 : 1) * (rite ? 2 : 1)
        expect(boardDamageFor(hit, e, rite)).toBe(hit * m)
      }),
    )
  })

  it('Property 25: door attacker count', () => {
    // **Validates: Requirements 16.9, 16.15**
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 1, max: 5 }), (n, night) => {
        expect(doorAttackerCount(n, night)).toBe(Math.max(Math.floor(n / 3), night >= 2 ? 1 : 0))
      }),
    )
  })
})
