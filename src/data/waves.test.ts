import { describe, it, expect } from 'vitest'
import { ENEMIES, ENEMY_MAP } from './enemies'
import {
  BASE_WAVES,
  LIVE_ENEMY_CAP,
  NIGHTS,
  NIGHT_MAP,
  SPAWN_MIN_DISTANCE,
  WAVE_ADDITIONS,
  WAVE_GAP,
  waveAdditions,
  waveSize,
} from './waves'

describe('enemy data', () => {
  it('matches the design bible stats', () => {
    expect(ENEMIES.map((e) => e.id)).toEqual([
      'shambler',
      'lurker',
      'wailer',
      'bloater',
      'brute',
      'father-crane',
    ])
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

  // Night 5's last two waves reach 15 with the spec 07 additions; the spawner queues the overflow.
  it('no base wave exceeds the live cap', () => {
    for (const n of [1, 2, 3, 4, 5] as const)
      for (const w of BASE_WAVES[n]) expect(waveSize(w)).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
  })
})

describe('base columns of §8 (shambler, wailer, lurker)', () => {
  const cols = (n: 1 | 2 | 3 | 4 | 5) =>
    NIGHT_MAP[n].waves.map((w) => [w.shambler, w.wailer, w.lurker])

  it('are unchanged by the spec 07 additions', () => {
    expect(cols(1)).toEqual([
      [4, 0, 0],
      [4, 0, 0],
    ])
    expect(cols(2)).toEqual([
      [5, 0, 0],
      [5, 0, 0],
      [5, 1, 0],
    ])
    expect(cols(3)).toEqual([
      [6, 1, 1],
      [6, 1, 1],
      [6, 1, 1],
    ])
    expect(cols(4)).toEqual([
      [6, 2, 2],
      [6, 2, 2],
      [6, 2, 2],
      [6, 2, 2],
    ])
    expect(cols(5)).toEqual([
      [8, 2, 2],
      [8, 2, 2],
      [8, 2, 2],
      [8, 2, 2],
      [8, 2, 2],
    ])
  })
})

describe('spec 07 wave additions', () => {
  const added = (n: 1 | 2 | 3 | 4 | 5) => NIGHT_MAP[n].waves.map((w) => [w.bloater, w.brute])

  it('match the §8 "Added in spec 07" column', () => {
    expect(added(1)).toEqual([
      [0, 0],
      [0, 0],
    ])
    expect(added(2)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ])
    expect(added(3)).toEqual([
      [0, 0],
      [0, 0],
      [1, 0],
    ])
    expect(added(4)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [1, 1],
    ])
    expect(added(5)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [2, 1],
      [2, 1],
    ])
  })

  it('waveAdditions is empty outside nights 1 to 5 and matches WAVE_ADDITIONS inside', () => {
    for (const bad of [0, -1, 6, 99, 2.5, NaN]) expect(waveAdditions(bad)).toEqual([])
    expect(waveAdditions(4)).toBe(WAVE_ADDITIONS[4])
  })
})
