import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { markAttack, markerShape, tickHitMarker } from './hitMarker'

const summary = fc
  .record({
    zombiesHit: fc.integer({ min: 0, max: 8 }),
    kills: fc.integer({ min: 0, max: 8 }),
    headshots: fc.integer({ min: 0, max: 8 }),
  })
  .map((s) => ({
    ...s,
    kills: Math.min(s.kills, s.zombiesHit),
    headshots: Math.min(s.headshots, s.zombiesHit),
  }))

describe('hitMarker', () => {
  // Feature: 07-combat-and-enemies, Property 19: Hit markers and damage numbers
  // **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.10**
  it('property: marker iff a zombie was hit; kill larger; headshot has dot and ring', () => {
    fc.assert(
      fc.property(summary, (s) => {
        const m = markAttack(null, s)
        expect(m !== null).toBe(s.zombiesHit > 0)
        if (!m) return
        const shape = markerShape(m)
        expect(shape.dot && shape.ring).toBe(s.headshots > 0)
        expect(shape.scale > 1).toBe(s.kills > 0)
      }),
    )
  })

  it('property: flashing off lasts at least 0.3 s; flashing on expires by 0.15 s', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.29, noNaN: true }), (t) => {
        const m = markAttack(null, { zombiesHit: 1, kills: 0, headshots: 0 })
        expect(tickHitMarker(m, t, false)).not.toBeNull()
        expect(tickHitMarker(m, 0.15, true)).toBeNull()
        expect(tickHitMarker(m, 0.3, false)).toBeNull()
      }),
    )
  })

  it('returns null for a miss and ignores the previous marker', () => {
    const prev = markAttack(null, { zombiesHit: 1, kills: 1, headshots: 1 })
    expect(markAttack(prev, { zombiesHit: 0, kills: 0, headshots: 0 })).toBeNull()
    expect(markAttack(prev, { zombiesHit: 1, kills: 0, headshots: 0 })?.ageS).toBe(0)
  })
})
