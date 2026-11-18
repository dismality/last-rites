import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { CRAWLER } from '../../data/creatures'
import { freshCreatureSave, sanitizeCreatureSave } from './creatureSave'

const crawler = fc.record({
  id: fc.stringMatching(/^[a-z0-9-]{1,8}$/),
  phase: fc.constantFrom('hidden' as const, 'emerged' as const),
  x: fc.integer({ min: -500, max: 500 }).map((n) => n / 10),
  z: fc.integer({ min: -500, max: 500 }).map((n) => n / 10),
  grabCooldown: fc.integer({ min: 0, max: 15 }).map((n) => n / 10),
  emergedS: fc.integer({ min: 0, max: 300 }).map((n) => n / 10),
  wave: fc.boolean(),
})

describe('sanitizeCreatureSave', () => {
  it('defaults for a missing or non-object block', () => {
    for (const raw of [undefined, null, 'x', 5, []]) expect(sanitizeCreatureSave(raw)).toEqual(freshCreatureSave())
  })

  it('drops bad crawlers one by one and keeps the good ones', () => {
    const good = { id: 'a', phase: 'hidden', x: 1, z: 2, grabCooldown: 0, emergedS: 0, wave: false }
    const back = sanitizeCreatureSave({
      crawlers: [good, { ...good, id: 'a' }, { ...good, id: 'b', phase: 'flying' }, { ...good, id: 'c', x: NaN }, 7],
    })
    expect(back.crawlers.map((c) => c.id)).toEqual(['a'])
  })

  it('clamps the bride delay and ignores a bride with no position', () => {
    expect(sanitizeCreatureSave({ bride: { alive: true, returnIn: 9999 } }).bride).toEqual({
      alive: false,
      x: 0,
      z: 0,
      returnIn: 120,
    })
  })

  // Feature: 11-horror-pass, Property 20: Creature save round trip
  it('round-trips any valid block through JSON', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(crawler, { selector: (c) => c.id, maxLength: CRAWLER.spotsMax }),
        fc.record({ alive: fc.boolean(), x: fc.integer({ min: -40, max: 40 }), z: fc.integer({ min: -40, max: 40 }), returnIn: fc.integer({ min: 0, max: 60 }) }),
        (crawlers, bride) => {
          // A bride who is not alive has no position to keep.
          const save = { seededNight: 2, crawlers, bride: bride.alive ? bride : { ...bride, x: 0, z: 0 } }
          expect(sanitizeCreatureSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
        },
      ),
      { numRuns: 100 },
    )
  })
})
