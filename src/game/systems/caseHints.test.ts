import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASES, HINT_COSTS } from '../../data/cases'
import {
  FREE_TIER3_AFTER_S,
  INITIAL_HINTS,
  nextHint,
  nextHintCost,
  revealedHints,
  type HintState,
} from './caseHints'

describe('caseHints', () => {
  it('costs 5, 10 and 20 in order', () => {
    let h: HintState = INITIAL_HINTS
    const paid: number[] = []
    for (let i = 0; i < 3; i++) {
      const r = nextHint(h, 100, 0, false)
      if (r.kind !== 'revealed') throw new Error('expected a hint')
      paid.push(r.cost)
      h = r.state
    }
    expect(paid).toEqual([...HINT_COSTS])
    expect(nextHint(h, 100, 0, false)).toMatchObject({ kind: 'refused', reason: 'all-revealed' })
  })

  it('refuses with too few coins and reveals nothing', () => {
    expect(nextHint(INITIAL_HINTS, 4, 0, true)).toMatchObject({ kind: 'refused', reason: 'no-coins' })
  })

  it('tier 3 is free after 3 minutes in Story, but not before and not outside Story', () => {
    const h: HintState = { revealed: 2 }
    expect(nextHintCost(h, FREE_TIER3_AFTER_S, true)).toBe(0)
    expect(nextHintCost(h, FREE_TIER3_AFTER_S - 1, true)).toBe(20)
    expect(nextHintCost(h, 999, false)).toBe(20)
    expect(nextHintCost({ revealed: 1 }, 999, true)).toBe(10)
  })

  it('returns the text of revealed tiers only', () => {
    const c = CASES[0]
    expect(revealedHints(c, { revealed: 2 })).toEqual([c.hints[0].text, c.hints[1].text])
  })

  // Feature: 10-curse-stages, Property 13: Hint tiers reveal in order
  // **Validates: Requirements 9.1, 9.2, 9.3**
  it('Property 13: hint tiers reveal in order and coins never go below zero', () => {
    const step = fc.record({
      gain: fc.integer({ min: 0, max: 30 }),
      night: fc.integer({ min: 0, max: 400 }),
      story: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.array(step, { maxLength: 20 }), (start, steps) => {
        let coins = start
        let h: HintState = INITIAL_HINTS
        for (const s of steps) {
          coins += s.gain
          const r = nextHint(h, coins, s.night, s.story)
          if (r.kind === 'revealed') {
            expect(r.tier).toBe(h.revealed + 1)
            expect(r.state.revealed).toBe(r.tier)
            expect(r.cost).toBeLessThanOrEqual(coins)
            const free = r.tier === 3 && s.story && s.night >= FREE_TIER3_AFTER_S
            expect(r.cost).toBe(free ? 0 : HINT_COSTS[r.tier - 1])
            coins -= r.cost
            h = r.state
          } else if (r.reason === 'no-coins') {
            expect(coins).toBeLessThan(r.cost)
          } else {
            expect(h.revealed).toBe(3)
          }
          expect(coins).toBeGreaterThanOrEqual(0)
        }
      }),
      { numRuns: 100 },
    )
  })
})
