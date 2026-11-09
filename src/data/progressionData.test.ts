// A literal copy of docs/game-design.md §12 compared with every spec-08 data file.
// Each assertion carries the value's name so a mismatch says which one drifted.
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, ACHIEVEMENT_THRESHOLDS } from './achievements'
import { CONTRACTS, CONTRACTS_PER_DAWN, UNHURT_MAX_DAMAGE } from './contracts'
import { DAWN_UPGRADES, OFFER_SIZE, UPGRADE_PER_RANK } from './dawnUpgrades'
import { COIN_DROPS, ELITE_COIN_BONUS } from './graveCoins'
import { MERCHANT_ROWS, MERCHANT_SPOT, MERCHANT_STAY_S } from './merchant'
import { ENDLESS, MODES } from './modes'
import { MUSIC, STEM_WEIGHTS } from './music'
import { BOSS_POINTS, COMBO, ELITE_POINTS_MULT, HEADSHOT_BONUS, KILL_POINTS, NIGHT_SCORE } from './scoring'
import { LIGHTNING, RAIN, STORM, STORM_CHANCE_DAY, STORM_CHANCE_NIGHT } from './storms'

function expectAll(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(expected)) {
    expect(actual[name], name).toEqual(value)
  }
}

describe('§12 dawn upgrades', () => {
  const table = [
    ['iron-constitution', 2],
    ['steady-hands', 2],
    ['long-wick', 2],
    ['deep-pockets', 1],
    ['second-wind', 2],
    ['gravedigger', 1],
    ['hardened-boards', 1],
    ['grim-harvest', 2],
    ['marksman', 1],
    ['blessed-reach', 1],
  ] as const

  it('ids, order and max ranks', () => {
    expect(DAWN_UPGRADES.map((u) => [u.id, u.maxRank])).toEqual(table.map((r) => [...r]))
  })
  it('per-rank effects and offer size', () => {
    expectAll(UPGRADE_PER_RANK, {
      maxHealth: 15,
      reload: 0.15,
      lanternDrain: 0.2,
      satchelSlots: 2,
      staminaRegen: 0.25,
      digTime: 0.3,
      boardHp: 0.25,
      coinDrop: 0.25,
      headshot: 0.25,
      flaskRadiusM: 1,
    })
    expect(OFFER_SIZE, 'OFFER_SIZE').toBe(3)
  })
})

describe('§12 score and combo', () => {
  it('kill points', () => {
    expectAll(KILL_POINTS, { shambler: 10, wailer: 25, lurker: 30, bloater: 30, brute: 75 })
    expect(BOSS_POINTS, 'BOSS_POINTS').toBe(1000)
    expect(ELITE_POINTS_MULT, 'ELITE_POINTS_MULT').toBe(2)
    expect(HEADSHOT_BONUS, 'HEADSHOT_BONUS').toBe(5)
  })
  it('combo and night score', () => {
    expectAll(COMBO, { step: 0.25, cap: 3, windowS: 4, base: 1 })
    expectAll(NIGHT_SCORE, { clearPerNight: 100, noDamageBonus: 200 })
  })
})

describe('§12 grave coins', () => {
  it('drops', () => {
    expect(COIN_DROPS.shambler, 'COIN_DROPS.shambler').toEqual({ amount: 1, chance: 0.5 })
    for (const id of ['wailer', 'lurker', 'bloater'] as const) {
      expect(COIN_DROPS[id], `COIN_DROPS.${id}`).toEqual({ amount: 2, chance: 1 })
    }
    expect(COIN_DROPS.brute, 'COIN_DROPS.brute').toEqual({ amount: 5, chance: 1 })
    expect(ELITE_COIN_BONUS, 'ELITE_COIN_BONUS').toBe(5)
  })
})

describe('§12 merchant', () => {
  const rows = [
    ['bandage', 6, 3, 'fixed'],
    ['lamp-oil', 4, 3, 'fixed'],
    ['revolver-cartridges', 10, 2, 'pool'],
    ['shotgun-shells', 12, 2, 'pool'],
    ['holy-water', 8, 2, 'pool'],
    ['black-powder', 6, 3, 'pool'],
    ['lead-shot', 5, 3, 'pool'],
    ['wood-planks', 3, 5, 'pool'],
    ['kola-tonic', 15, 1, 'pool'],
    ['silver-filings', 20, 1, 'pool'],
  ] as const

  it('rows: id, price, daily quantity, stock kind', () => {
    expect(MERCHANT_ROWS.map((r) => [r.id, r.price, r.dailyQty, r.stock])).toEqual(rows.map((r) => [...r]))
  })
  it('batch sizes and weapon needs', () => {
    const byId = Object.fromEntries(MERCHANT_ROWS.map((r) => [r.id, r]))
    expect(byId['revolver-cartridges'].count, 'revolver-cartridges.count').toBe(6)
    expect(byId['shotgun-shells'].count, 'shotgun-shells.count').toBe(4)
    expect(byId['revolver-cartridges'].needs, 'revolver-cartridges.needs').toBe('revolver')
    expect(byId['shotgun-shells'].needs, 'shotgun-shells.needs').toBe('shotgun')
  })
  it('stay time and spots', () => {
    expect(MERCHANT_STAY_S, 'MERCHANT_STAY_S').toBe(90)
    expect([...MERCHANT_SPOT.cart], 'MERCHANT_SPOT.cart').toEqual([-9, 0, 37])
    expect([...MERCHANT_SPOT.silas], 'MERCHANT_SPOT.silas').toEqual([-7.2, 0, 36.2])
  })
})

describe('§12 contracts', () => {
  it('ids, goals and rewards', () => {
    expect(CONTRACTS.map((c) => [c.id, c.goal, c.reward])).toEqual([
      ['c-dig-3', 3, 15],
      ['c-shotgun-5', 5, 20],
      ['c-revolver-head-3', 3, 20],
      ['c-melee-10', 10, 15],
      ['c-wailer-2', 2, 20],
      ['c-boards-3', 3, 10],
      ['c-gather-8', 8, 10],
      ['c-unhurt', 1, 30],
    ])
  })
  it('per-dawn count and unhurt limit', () => {
    expect(CONTRACTS_PER_DAWN, 'CONTRACTS_PER_DAWN').toBe(2)
    expect(UNHURT_MAX_DAMAGE, 'UNHURT_MAX_DAMAGE').toBe(50)
  })
})

describe('§12 modes', () => {
  it('modifier table', () => {
    const table = {
      easy: [0.75, 0.6, 0.75, 0.04, 0.75],
      normal: [1, 1, 1, 0.06, 1],
      hard: [1.25, 1.4, 1, 0.1, 1.5],
    } as const
    for (const [id, [hp, dmg, drain, elite, score]] of Object.entries(table)) {
      const m = MODES[id as keyof typeof table]
      expect([m.hpMult, m.damageMult, m.lanternDrainMult, m.eliteChance, m.scoreMult], `MODES.${id}`).toEqual([
        hp,
        dmg,
        drain,
        elite,
        score,
      ])
    }
  })
  it('endless', () => {
    expect(ENDLESS.dayS, 'ENDLESS.dayS').toBe(120)
    expect(ENDLESS.waveBase, 'ENDLESS.waveBase').toBe(2)
    expect(ENDLESS.waveCap, 'ENDLESS.waveCap').toBe(6)
    expect(ENDLESS.shamblerBase, 'ENDLESS.shamblerBase').toBe(4)
    expect(ENDLESS.hpScale, 'ENDLESS.hpScale').toBe(1.08)
    expect(ENDLESS.hpScaleAfterNight, 'ENDLESS.hpScaleAfterNight').toBe(5)
    expect(MODES.endless.retryNight, 'MODES.endless.retryNight').toBe(false)
  })
})

describe('§12 achievements', () => {
  it('ids, names and goals', () => {
    expect(ACHIEVEMENTS.map((a) => [a.id, a.name, a.goal])).toEqual([
      ['a-first-light', 'First Light', 'Survive night 1'],
      ['a-grave-robber', 'Grave Robber', 'Dig 10 graves in one run'],
      ['a-marksman', 'Marksman', 'Make 10 headshot kills in one night'],
      ['a-close-shave', 'Close Shave', 'Clear a night with 10 HP or less'],
      ['a-combo', 'Requiem', 'Reach a ×3.0 combo'],
      ['a-barricade', 'Hold the Door', 'Nail 20 barricade boards in one run'],
      ['a-pages', "The Keeper's Account", 'Read all 5 journal pages'],
      ['a-relics', 'Every Relic', 'Hold all 5 relics'],
      ['a-crane', 'Forgive Them', 'Put Father Crane to rest'],
      ['a-rest', 'Rest', 'Reach the Rest ending'],
      ['a-endless-10', 'Long Night', 'Reach night 10 in Endless Survival'],
      ['a-patron', 'Valued Custom', 'Spend 100 Grave Coins in one run'],
    ])
  })
  it('thresholds', () => {
    expectAll(ACHIEVEMENT_THRESHOLDS, {
      digs: 10,
      headshotsPerNight: 10,
      closeShaveHp: 10,
      comboCap: 3,
      boards: 20,
      pages: 5,
      relics: 5,
      endlessNight: 10,
      coinsSpent: 100,
    })
  })
})

describe('§12 storms', () => {
  it('chances', () => {
    expect(STORM_CHANCE_NIGHT, 'STORM_CHANCE_NIGHT').toEqual({ 1: 0, 2: 0.25, 3: 0.4, 4: 0.5, 5: 1 })
    expect(STORM_CHANCE_DAY, 'STORM_CHANCE_DAY').toBe(0.15)
  })
  it('storm, lightning and rain tuning', () => {
    expectAll(STORM, {
      gapMinS: 20,
      gapMaxS: 45,
      thunderMinS: 1,
      thunderMaxS: 4,
      fogAdd: 0.01,
      lanternDrainMult: 1.2,
      closeThunderMaxS: 2,
      rainFadeS: 3,
    })
    expectAll(LIGHTNING, { flashS: 0.15, slowRiseS: 1.5, slowFallS: 1.5, slowPeak: 0.3, ambientBoost: 1.4, moonBoost: 1.6 })
    expect(RAIN.count, 'RAIN.count').toBe(600)
    expect([...RAIN.boxM], 'RAIN.boxM').toEqual([36, 20, 36])
  })
})

describe('§12 reactive music', () => {
  it('distances and fades', () => {
    expect(MUSIC.distance, 'MUSIC.distance').toEqual({ danger: 6, tension: 15, unease: 30 })
    expectAll(MUSIC, { crossfadeS: 2, duckFadeS: 0.3, fadeInS: 2, silenceBeforeBeatS: 1.5, silenceAfterBeatS: 2 })
  })
  it('stem weights', () => {
    expect(
      [0, 1, 2, 3].map((l) => [...STEM_WEIGHTS[l as 0 | 1 | 2 | 3]]),
      'STEM_WEIGHTS',
    ).toEqual([
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0.8, 1, 1, 0],
      [1, 1, 1, 1],
    ])
  })
})
