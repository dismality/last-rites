import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { RITE_ORDER } from '../../data/relics'
import type { RelicId } from '../types'
import { EMPTY_RITE, isRiteDone, placedCount, placeRelic, type RiteState } from './rite'

const slotArb = fc.integer({ min: -1, max: RITE_ORDER.length })
const relicArb = fc.constantFrom<RelicId>(...RITE_ORDER)
const stepsArb = fc.array(fc.tuple(slotArb, relicArb), { maxLength: 40 })

function run(steps: readonly (readonly [number, RelicId])[], craneAlive: boolean) {
  let state: RiteState = EMPTY_RITE
  for (const [slot, relic] of steps) {
    state = placeRelic(state, slot, relic, RITE_ORDER, craneAlive).state
  }
  return state
}

describe('placeRelic', () => {
  it('places the right relic and starts the rising clock on the first one only', () => {
    const first = placeRelic(EMPTY_RITE, 0, RITE_ORDER[0], RITE_ORDER, true)
    expect(first.outcome).toBe('placed')
    expect(first.startsRisingClock).toBe(true)
    const second = placeRelic(first.state, 1, RITE_ORDER[1], RITE_ORDER, true)
    expect(second.startsRisingClock).toBe(false)
  })

  it('returns a relic placed in the wrong slot and does not start the clock', () => {
    const r = placeRelic(EMPTY_RITE, 1, RITE_ORDER[0], RITE_ORDER, true)
    expect(r).toMatchObject({ outcome: 'wrong', returned: RITE_ORDER[0], startsRisingClock: false })
    expect(r.state).toBe(EMPTY_RITE)
  })

  it('refuses a taken slot and an out-of-range slot', () => {
    const a = placeRelic(EMPTY_RITE, 0, RITE_ORDER[0], RITE_ORDER, true).state
    expect(placeRelic(a, 0, RITE_ORDER[1], RITE_ORDER, true).outcome).toBe('refused')
    expect(placeRelic(a, 9, RITE_ORDER[1], RITE_ORDER, true).outcome).toBe('refused')
  })

  it('holds the placed relics while Crane lives and completes once he falls', () => {
    let s: RiteState = EMPTY_RITE
    RITE_ORDER.forEach((relic, slot) => {
      const r = placeRelic(s, slot, relic, RITE_ORDER, true)
      expect(r.complete).toBe(false)
      s = r.state
    })
    expect(placedCount(s)).toBe(5)
    expect(isRiteDone(s, RITE_ORDER, true)).toBe(false)
    expect(isRiteDone(s, RITE_ORDER, false)).toBe(true)
  })

  it('is not complete with fewer than 5 relics', () => {
    const s = run(
      RITE_ORDER.slice(0, 4).map((r, i) => [i, r] as const),
      false,
    )
    expect(isRiteDone(s, RITE_ORDER, false)).toBe(false)
  })

  // Feature: 10-curse-stages, Property 19: The rite completes only in order and with Crane fallen
  it('Property 19: completes iff all 5 are in order and Crane is not alive', () => {
    // Validates: Requirements 17.3, 17.4, 17.5, 17.6
    fc.assert(
      fc.property(stepsArb, fc.boolean(), (steps, craneAlive) => {
        const s = run(steps, craneAlive)
        // A relic only ever stays in its own slot, so a slot is filled iff the right pair was tried.
        RITE_ORDER.forEach((relic, slot) => {
          const tried = steps.some(([sl, re]) => sl === slot && re === relic)
          expect(s.placed[slot] === relic).toBe(tried)
        })
        const allRight = RITE_ORDER.every((relic, slot) => s.placed[slot] === relic)
        expect(isRiteDone(s, RITE_ORDER, craneAlive)).toBe(allRight && !craneAlive)
      }),
      { numRuns: 200 },
    )
  })

  it('Property 19: a wrong or refused placement never changes the altar', () => {
    // Validates: Requirements 17.3
    fc.assert(
      fc.property(stepsArb, slotArb, relicArb, (steps, slot, relic) => {
        const s = run(steps, true)
        const r = placeRelic(s, slot, relic, RITE_ORDER, true)
        if (r.outcome !== 'placed') expect(r.state).toBe(s)
        if (r.outcome === 'wrong') expect(r.returned).toBe(relic)
      }),
      { numRuns: 200 },
    )
  })
})
