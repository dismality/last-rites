import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { FIXED_SPAWNS, SPAWN_POINTS, ZONE_BOUNDS } from '../../data/zones'
import { zoneAt } from './zoneAt'

const RUNS = { numRuns: 100 }
const ZONES = ['grounds', 'mausoleum-row', 'chapel', 'catacombs']
const coord = fc.double({ min: -200, max: 200, noNaN: true })

describe('zoneAt', () => {
  it('falls back to grounds for non-finite input', () => {
    expect(zoneAt(Number.NaN, Number.NaN)).toBe('grounds')
  })

  // Feature: 06-clarity-and-hud, Property 25: Zone lookup
  // **Validates: Requirements 7.2, 7.1**
  it('Property 25: always returns one of the four zones', () => {
    fc.assert(
      fc.property(coord, coord, (x, z) => ZONES.includes(zoneAt(x, z))),
      RUNS,
    )
  })

  it('Property 25: points inside a rect resolve to the first matching zone', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: ZONE_BOUNDS.length - 1 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (i, u, v) => {
          const { rect } = ZONE_BOUNDS[i]
          const x = rect.minX + u * (rect.maxX - rect.minX)
          const z = rect.minZ + v * (rect.maxZ - rect.minZ)
          const first = ZONE_BOUNDS.find(
            (b) => x >= b.rect.minX && x <= b.rect.maxX && z >= b.rect.minZ && z <= b.rect.maxZ,
          )
          return zoneAt(x, z) === first?.zone
        },
      ),
      RUNS,
    )
  })

  it('Property 25: every spawn point and fixed spawn resolves to its declared zone', () => {
    const all = [...SPAWN_POINTS, ...FIXED_SPAWNS]
    fc.assert(
      fc.property(fc.constantFrom(...all), (s) => zoneAt(s.position[0], s.position[2]) === s.zone),
      { numRuns: Math.max(100, all.length * 4) },
    )
    for (const s of all) expect(zoneAt(s.position[0], s.position[2])).toBe(s.zone)
  })
})
