import { describe, expect, it } from 'vitest'
import { COMPASS } from './compass'
import { CHAPEL_ALTAR, CHAPEL_CENTER } from './cemeteryLayout'
import { MAP_PX } from './mapLandmarks'
import { ZONE_CARDS, ZONE_CARD_COOLDOWN_S, ZONE_CARD_FADE_S, ZONE_CARD_SHOW_S } from './zoneCards'
import { FIXED_SPAWNS, SPAWN_POINTS, ZONE_BOUNDS, type ZoneId } from './zones'

// Rect check only; the pure zoneAt arrives in task 2.7.
const resolve = (x: number, z: number): ZoneId =>
  ZONE_BOUNDS.find(
    ({ rect: r }) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ,
  )?.zone ?? 'grounds'

describe('ZONE_CARDS', () => {
  it('matches the design bible text exactly', () => {
    expect(ZONE_CARDS).toEqual({
      grounds: { name: "Keeper's Hut and Grounds", line: 'Crooked stones and dead oaks.' },
      'mausoleum-row': {
        name: 'Mausoleum Row',
        line: 'The great families sleep here. Not all of them.',
      },
      chapel: { name: 'Hollowmere Chapel', line: 'Candle smoke and old prayers.' },
      catacombs: { name: 'The Catacombs', line: 'They were not dead when they came down.' },
    })
  })

  it('uses the specified timings', () => {
    expect(ZONE_CARD_SHOW_S).toBe(2.5)
    expect(ZONE_CARD_COOLDOWN_S).toBe(30)
    expect(ZONE_CARD_FADE_S).toBeGreaterThanOrEqual(0.15)
    expect(ZONE_CARD_FADE_S).toBeLessThanOrEqual(0.3)
  })
})

describe('ZONE_BOUNDS', () => {
  it('resolves every spawn point to its declared zone', () => {
    for (const s of [...SPAWN_POINTS, ...FIXED_SPAWNS]) {
      expect(resolve(s.position[0], s.position[2]), s.id).toBe(s.zone)
    }
  })

  it('puts the altar in the chapel and the origin on the grounds', () => {
    expect(resolve(CHAPEL_ALTAR[0], CHAPEL_ALTAR[2])).toBe('chapel')
    expect(resolve(0, 0)).toBe('grounds')
    expect(CHAPEL_ALTAR).toEqual([CHAPEL_CENTER[0], 0, CHAPEL_CENTER[2] + 4.5])
  })
})

describe('compass and map constants', () => {
  it('spans 180 degrees with 15 degree ticks', () => {
    expect(COMPASS.halfSpanDeg * 2).toBe(180)
    expect(COMPASS.tickStepDeg).toBe(15)
  })
  it('keeps the map pixel layout', () => {
    expect(MAP_PX).toEqual({ cellPx: 28, marginPx: 16 })
  })
})
