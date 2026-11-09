import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOORS } from './barricades'
import { BOSS } from './boss'
import { ELITE, ELITE_DROPS } from './elites'
import { BLOATER, ENEMY_CAPSULE, ENEMY_LOOKS, ENEMY_MAP, ENEMY_MODEL_HEIGHT } from './enemies'
import type { EnemyId } from './enemies'
import { REPAIR_STAGES } from './repairs'

describe('new enemy stats (§7)', () => {
  it.each([
    ['bloater', 80, 1.0, 15],
    ['brute', 300, 1.1, 30],
    ['father-crane', 1500, 1.2, 30],
  ] as const)('%s has hp %d, speed %d, damage %d', (id, hp, speed, damage) => {
    expect(ENEMY_MAP[id]).toMatchObject({ hp, speed, damage })
  })

  it('has bloater burst and capsule numbers', () => {
    expect(BLOATER).toEqual({ swellS: 0.8, burstRadiusM: 3, burstDamage: 25 })
    expect(ENEMY_CAPSULE).toEqual({ radiusM: 0.35, downHeightM: 0.5 })
    expect(ENEMY_MODEL_HEIGHT).toEqual({ zombie: 1.75, brute: 1.95 })
  })

  it('has the looks table', () => {
    expect(ENEMY_LOOKS.bloater).toEqual({
      model: 'zombie',
      tint: '#9aa58a',
      scale: [1.35, 1.1, 1.35],
    })
    expect(ENEMY_LOOKS.brute).toEqual({ model: 'brute', tint: '#b5a99a', scale: 1 })
    expect(ENEMY_LOOKS['father-crane']).toEqual({ model: 'brute', tint: '#3a3440', scale: 1.2 })
  })

  it('gives every enemy a distinct audio cue', () => {
    const ids = Object.keys(ENEMY_LOOKS) as EnemyId[]
    expect(new Set(ids.map((i) => ENEMY_MAP[i].audio)).size).toBe(ids.length)
  })
})

describe('elites (§7)', () => {
  it('has the modifiers', () => {
    expect(ELITE).toMatchObject({
      fromNight: 2,
      maxPerWave: 1,
      chance: { normal: 0.06 },
      hpMult: 2,
      speedMult: 1.15,
      damageMult: 1.25,
      scale: 1.05,
    })
    expect([...ELITE.eligible]).toEqual(['shambler', 'bloater', 'brute'])
  })

  it('has drops with weights 30/25/20/15/10 summing to 100', () => {
    expect(ELITE_DROPS.map((d) => [d.item, d.qty, d.weight])).toEqual([
      ['revolver-cartridge', 6, 30],
      ['shotgun-shell', 2, 25],
      ['silver-filings', 1, 20],
      ['kola-tonic', 1, 15],
      ['black-powder', 2, 10],
    ])
    expect(ELITE_DROPS.reduce((n, d) => n + d.weight, 0)).toBe(100)
  })
})

describe('boss (§7)', () => {
  it('has the timers, phases and attacks', () => {
    expect(BOSS).toMatchObject({
      riseAfterS: 10,
      riseTelegraphS: 1.5,
      nameCardS: 3,
      riteCapS: 44,
      deathQuietS: 4,
      phaseAt: { two: 0.6, three: 0.25 },
      speed: { 1: 1.2, 2: 1.5, 3: 1.7 },
      saltSpeedMult: 0.5,
      censer: { windupS: 1.0, arcDeg: 120, reachM: 3, damage: 30 },
      toll: { everyS: 12, telegraphS: 1.2, radiusM: 8, damage: 20, pushM: 3 },
      congregation: { everyS: { 1: 25, 2: 25, 3: 18 }, telegraphS: 1.0, count: 3 },
    })
  })

  it('phase speeds never decrease', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 2), (p) => {
        expect(BOSS.speed[(p + 1) as 2 | 3]).toBeGreaterThan(BOSS.speed[p as 1 | 2])
      }),
    )
  })
})

describe('doors (§2)', () => {
  it('has the barricade rules', () => {
    expect([...DOORS.ids]).toEqual(['front', 'vestry'])
    expect(DOORS).toMatchObject({
      slots: 3,
      boardHp: 60,
      startBoards: 2,
      nailTimeS: 2,
      bruteMult: 2,
      riteMult: 2,
      nailMoveEpsM: 0.05,
    })
    expect(DOORS.nailCost).toEqual([
      { item: 'wood-plank', qty: 1 },
      { item: 'iron-nail', qty: 2 },
    ])
  })

  it('stage 1 repair is the doors repair with unchanged cost', () => {
    const s = REPAIR_STAGES[0]
    expect(s.label).toBe('Bar the Doors')
    expect(s.description).toBe(
      'Fits barricade frames on both doors and nails 2 boards on each. Zombies cannot enter while both doors hold.',
    )
    expect(s.cost).toEqual([
      { item: 'iron-nail', qty: 4 },
      { item: 'bone', qty: 2 },
    ])
  })
})
