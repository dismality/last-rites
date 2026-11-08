import { describe, it, expect } from 'vitest'
import { ENEMIES, ENEMY_MAP } from './enemies'
import { NIGHTS, NIGHT_MAP, LIVE_ENEMY_CAP, WAVE_GAP, SPAWN_MIN_DISTANCE, waveSize } from './waves'

describe('enemy data', () => {
  it('matches the design bible stats', () => {
    expect(ENEMIES.map((e) => e.id)).toEqual(['shambler', 'lurker', 'wailer'])
    expect(ENEMY_MAP.shambler).toMatchObject({ hp: 60, speed: 1.4, damage: 10, attackRange: 1.2 })
    expect(ENEMY_MAP.lurker).toMatchObject({ hp: 90, speed: 6, damage: 20 })
    expect(ENEMY_MAP.wailer).toMatchObject({ hp: 50, speed: 2.0, damage: 5 })
  })

  it('gives each enemy a distinct audio cue', () => {
    expect(new Set(ENEMIES.map((e) => e.audio)).size).toBe(ENEMIES.length)
  })
})

describe('wave data', () => {
  it('defines nights 1-5 with rising fog and wave counts 2,3,3,4,5', () => {
    expect(NIGHTS.map((n) => n.waves.length)).toEqual([2, 3, 3, 4, 5])
    const fog = NIGHTS.map((n) => n.fog)
    expect(fog).toEqual([0.02, 0.03, 0.04, 0.05, 0.06])
  })

  it('only night 5 has the final rite', () => {
    expect(NIGHTS.filter((n) => n.finalRite).map((n) => n.night)).toEqual([5])
  })

  it('night 2 has a wailer in the last wave only', () => {
    expect(NIGHT_MAP[2].waves.map((w) => w.wailer)).toEqual([0, 0, 1])
  })

  it('exports the tuning constants', () => {
    expect([WAVE_GAP, SPAWN_MIN_DISTANCE, LIVE_ENEMY_CAP]).toEqual([15, 15, 14])
  })

  it('no single wave exceeds the live cap', () => {
    for (const n of NIGHTS) for (const w of n.waves) expect(waveSize(w)).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
  })
})
