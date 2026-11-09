import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { CONTRACTS, UNHURT_MAX_DAMAGE } from '../../data/contracts'
import { createRng } from '../rng'
import type { DamageSource } from '../types'
import { advanceContracts, dealContracts, finishNight, possibleContracts } from './contracts'
import type { ContractContext, ContractEvent, DealtContract } from './contracts'

const DEFS = new Map(CONTRACTS.map((c) => [c.id, c]))

const ctxArb: fc.Arbitrary<ContractContext> = fc.record({
  owns: fc.record({ revolver: fc.boolean(), shotgun: fc.boolean() }),
  barricadeBuilt: fc.boolean(),
  wailersNextNight: fc.integer({ min: 0, max: 4 }),
})

const sources: DamageSource[] = ['melee', 'heavy', 'kick', 'revolver', 'shotgun', 'nail-bomb']
const eventArb: fc.Arbitrary<ContractEvent> = fc.oneof(
  fc.record({
    type: fc.constant('kill' as const),
    enemy: fc.constantFrom('shambler', 'wailer', 'lurker'),
    source: fc.constantFrom(...sources),
    headshot: fc.boolean(),
  }),
  fc.constant({ type: 'dig' as const }),
  fc.constant({ type: 'board' as const }),
  fc.constant({ type: 'material' as const }),
)

const fullList: DealtContract[] = CONTRACTS.map((c) => ({ id: c.id, progress: 0, done: false }))

describe('contracts', () => {
  it('excludes boards without a barricade and wailers with fewer than 2', () => {
    const ids = possibleContracts({ owns: { revolver: false, shotgun: false }, barricadeBuilt: false, wailersNextNight: 1 })
    expect(ids).not.toContain('c-boards-3')
    expect(ids).not.toContain('c-wailer-2')
    expect(ids).not.toContain('c-shotgun-5')
    expect(ids).toContain('c-dig-3')
  })

  it('c-unhurt pays at exactly 50 damage and not at 51', () => {
    const list = [{ id: 'c-unhurt' as const, progress: 0, done: false }]
    expect(finishNight(list, UNHURT_MAX_DAMAGE).completed).toHaveLength(1)
    expect(finishNight(list, UNHURT_MAX_DAMAGE + 1).completed).toHaveLength(0)
  })

  /** **Validates: Requirements 6.1, 6.2, 6.3, 6.12** */
  it('Property 18: contracts are dealt validly', () => {
    fc.assert(
      fc.property(fc.integer(), ctxArb, (seed, ctx) => {
        const dealt = dealContracts(createRng(seed), ctx)
        const possible = possibleContracts(ctx)
        expect(dealt.length).toBe(Math.min(2, possible.length))
        expect(new Set(dealt.map((d) => d.id)).size).toBe(dealt.length)
        for (const d of dealt) {
          expect(possible).toContain(d.id)
          expect(d.progress).toBe(0)
          expect(d.done).toBe(false)
        }
        expect(dealContracts(createRng(seed), ctx)).toEqual(dealt)
      }),
    )
  })

  /** **Validates: Requirements 6.4, 6.6, 6.7, 6.10, 6.11** */
  it('Property 19: progress is monotone, capped and paid once', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 60 }), fc.integer({ min: 0, max: 120 }), (events, damage) => {
        let list = fullList
        const paid = new Map<string, number>()
        for (const e of events) {
          const r = advanceContracts(list, e)
          r.list.forEach((c, i) => {
            const before = list[i]
            expect(c.progress).toBeGreaterThanOrEqual(before.progress)
            expect(c.progress).toBeLessThanOrEqual(DEFS.get(c.id)!.goal)
            if (before.done) expect(c).toEqual(before)
            expect(c.id).toBe(before.id)
            if (c.id === 'c-unhurt') expect(c.progress).toBe(0)
          })
          for (const p of r.completed) paid.set(p.id, (paid.get(p.id) ?? 0) + 1)
          list = r.list
        }
        const end = finishNight(list, damage)
        for (const p of end.completed) paid.set(p.id, (paid.get(p.id) ?? 0) + 1)
        for (const n of paid.values()) expect(n).toBe(1)
        const unhurt = end.list.find((c) => c.id === 'c-unhurt')!
        expect(unhurt.done).toBe(damage <= UNHURT_MAX_DAMAGE)
        // A repeat settle pays nothing more.
        expect(finishNight(end.list, damage).completed).toHaveLength(0)
        for (const c of end.list) if (c.done) expect(c.progress).toBe(DEFS.get(c.id)!.goal)
      }),
    )
  })
})
