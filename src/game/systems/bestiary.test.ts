import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { FIELD_NOTE_MAX } from '../../data/bestiary'
import type { CreatureId } from '../../data/creatures'
import { bestiaryEntry, canSee, emptySeen, markSeen, normalizeSeen, visibleEntries } from './bestiary'

const idArb = fc.constantFrom<CreatureId>('crawler', 'bride', 'hound')
const seenArb = fc.uniqueArray(idArb)

describe('bestiaryEntry', () => {
  it('returns an entry only for a seen creature and exposes nothing for an unseen one', () => {
    // Feature: 11-horror-pass, Property 13: Bestiary hides unseen creatures
    // **Validates: Requirements 2.18**
    fc.assert(
      fc.property(seenArb, idArb, (seen, id) => {
        const e = bestiaryEntry(id, seen)
        if (seen.includes(id)) {
          expect(e?.id).toBe(id)
          expect(e!.fieldNote.length).toBeLessThanOrEqual(FIELD_NOTE_MAX)
        } else expect(e).toBeNull()
        const text = JSON.stringify(visibleEntries(seen))
        for (const other of ['Pale Crawler', 'Hollow Bride', 'Corpse Hound'] as const) {
          const owner = { 'Pale Crawler': 'crawler', 'Hollow Bride': 'bride', 'Corpse Hound': 'hound' }[other] as CreatureId
          if (!seen.includes(owner)) expect(text).not.toContain(other)
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe('markSeen', () => {
  it('needs the lantern cone or 10 m, and adds a creature once', () => {
    // Feature: 11-horror-pass, Property 13: Bestiary hides unseen creatures
    // **Validates: Requirements 2.18**
    const pt = fc.record({ x: fc.double({ min: -40, max: 40, noNaN: true }), z: fc.double({ min: -40, max: 40, noNaN: true }) })
    fc.assert(
      fc.property(seenArb, idArb, pt, pt, fc.boolean(), (seen, id, p, c, cone) => {
        const next = markSeen(seen, id, p, c, cone)
        const sees = cone || Math.hypot(p.x - c.x, p.z - c.z) <= 10
        expect(canSee(p, c, cone)).toBe(sees)
        expect(next.includes(id)).toBe(seen.includes(id) || sees)
        expect(next.filter((x) => x === id).length).toBeLessThanOrEqual(1)
        seen.forEach((s) => expect(next).toContain(s))
      }),
      { numRuns: 100 },
    )
  })

  it('starts empty and keeps first-seen order', () => {
    let s = emptySeen()
    s = markSeen(s, 'hound', { x: 0, z: 0 }, { x: 5, z: 0 }, false)
    s = markSeen(s, 'crawler', { x: 0, z: 0 }, { x: 50, z: 0 }, false)
    s = markSeen(s, 'bride', { x: 0, z: 0 }, { x: 50, z: 0 }, true)
    expect(s).toEqual(['hound', 'bride'])
    expect(visibleEntries(s).map((e) => e.id)).toEqual(['hound', 'bride'])
  })
})

describe('normalizeSeen', () => {
  it('drops unknown and repeated ids from a saved value', () => {
    expect(normalizeSeen(['hound', 'ghost', 'hound', 3, 'bride'])).toEqual(['hound', 'bride'])
    expect(normalizeSeen(undefined)).toEqual([])
    expect(normalizeSeen('hound')).toEqual([])
  })
})
