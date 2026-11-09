import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ZONE_CARD_COOLDOWN_S, ZONE_CARD_SHOW_S } from '../../data/zoneCards'
import type { ZoneId } from '../../data/zones'
import {
  cardOpacity,
  recordZoneCard,
  shouldShowZoneCard,
  type ZoneLastShown,
} from './zoneCardTrigger'

const RUNS = { numRuns: 100 }
const zoneArb = fc.constantFrom<ZoneId>('grounds', 'mausoleum-row', 'chapel', 'catacombs')

describe('zoneCardTrigger', () => {
  it('shows the first card, suppresses a repeat inside 30 s, allows it at 30 s', () => {
    const last = recordZoneCard({}, 'chapel', 10)
    expect(shouldShowZoneCard(null, 'chapel', 10, {})).toBe(true)
    expect(shouldShowZoneCard('grounds', 'chapel', 39, last)).toBe(false)
    expect(shouldShowZoneCard('grounds', 'chapel', 40, last)).toBe(true)
  })

  // Feature: 06-clarity-and-hud, Property 24: Zone card cooldown
  // **Validates: Requirements 7.1, 7.3, 7.9, 7.10, 7.11**
  it('Property 24: no zone shows twice less than 30 s apart', () => {
    // Whole seconds keep the >= 30 comparison free of float edges.
    fc.assert(
      fc.property(
        fc.array(fc.tuple(zoneArb, fc.integer({ min: 0, max: 40 })), { maxLength: 60 }),
        (steps) => {
          let last: ZoneLastShown = {}
          let prev: ZoneId | null = null
          let now = 0
          const shown: Partial<Record<ZoneId, number[]>> = {}
          for (const [zone, dt] of steps) {
            now += dt
            if (shouldShowZoneCard(prev, zone, now, last)) {
              last = recordZoneCard(last, zone, now)
              ;(shown[zone] ??= []).push(now)
            }
            prev = zone
          }
          return Object.values(shown).every((ts) =>
            ts.every((t, i) => i === 0 || t - ts[i - 1] >= ZONE_CARD_COOLDOWN_S),
          )
        },
      ),
      RUNS,
    )
  })

  it('Property 24: same zone is false, unseen zone is true, inputs are not mutated', () => {
    fc.assert(
      fc.property(
        zoneArb,
        zoneArb,
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (a, b, now, t) => {
          const last: ZoneLastShown = Object.freeze({ [a]: t })
          const snapshot = JSON.stringify(last)
          const same = shouldShowZoneCard(a, a, now, last) === false
          const unseen = shouldShowZoneCard(null, b, now, {}) === true
          const next = recordZoneCard(last, b, now)
          return same && unseen && JSON.stringify(last) === snapshot && next[b] === now
        },
      ),
      RUNS,
    )
  })

  // Feature: 06-clarity-and-hud, Property 26: Card opacity
  // **Validates: Requirements 7.5, 10.8**
  it('Property 26: opacity is 0..1, zero outside the window, binary when reduced', () => {
    // Hundredths of a second avoid float-edge generators.
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 1000 }), fc.boolean(), (h, reduced) => {
        const e = h / 100
        const o = cardOpacity(e, reduced)
        const inRange = o >= 0 && o <= 1
        const outside = e < 0 || e > ZONE_CARD_SHOW_S ? o === 0 : true
        const binary = reduced ? o === 0 || o === 1 : true
        return inRange && outside && binary
      }),
      RUNS,
    )
  })

  it('fades in, holds at 1 and fades out', () => {
    expect(cardOpacity(0.125, false)).toBeCloseTo(0.5, 6)
    expect(cardOpacity(1.2, false)).toBe(1)
    expect(cardOpacity(2.375, false)).toBeCloseTo(0.5, 6)
  })
})
