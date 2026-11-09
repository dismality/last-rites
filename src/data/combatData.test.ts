// A literal copy of the (07) tables in docs/game-design.md §2 to §8, compared with the data
// modules. If the bible changes, change the literals here by hand; a mismatch names the id
// and field. Where a value has its own file test too, this is the one-stop cross-check.
import { describe, expect, it } from 'vitest'
import { DOORS } from './barricades'
import { BOSS } from './boss'
import { EFFECT_MAP, EFFECTS } from './effects'
import { ELITE, ELITE_DROPS } from './elites'
import { ENEMY_MAP } from './enemies'
import { FIREARM_MAP, HEAD_ZONE_M } from './firearms'
import { HEAVY_MAP } from './heavyMelee'
import { ITEM_MAP } from './items'
import { RECIPE_MAP } from './recipes'
import { WEAPON_MAP } from './weapons'
import { UPGRADE_MAP, WEAPON_UPGRADES } from './upgrades'
import { NIGHTS, WAVE_ADDITIONS } from './waves'

/** Compares each expected field and fails with "<id>.<field>" in the message. */
function expectFields(id: string, actual: object | undefined, expected: Record<string, unknown>): void {
  expect(actual, `${id} is missing`).toBeDefined()
  const rec = actual as Record<string, unknown>
  for (const [field, value] of Object.entries(expected)) {
    expect(rec[field], `${id}.${field}`).toEqual(value)
  }
}

describe('§3 items (07)', () => {
  const MATERIALS = ['wood-plank', 'black-powder', 'lead-shot', 'silver-filings'] as const
  it.each(MATERIALS)('%s is a material with stack limit 10', (id) => {
    expectFields(id, ITEM_MAP[id], { kind: 'material', stackLimit: 10 })
  })
  it.each([
    ['revolver-cartridge', 36],
    ['shotgun-shell', 20],
  ] as const)('%s is ammo with stack limit %d', (id, stackLimit) => {
    expectFields(id, ITEM_MAP[id], { kind: 'ammo', stackLimit })
  })
})

describe('§4 weapons (07)', () => {
  const rows = [
    ['revolver', 'firearm', 34, 0.45, null],
    ['shotgun', 'firearm', 9, 0.3, null],
    ['wood-axe', 'heavy', 30, 0.85, 60],
    ['silver-sabre', 'heavy', 28, 0.55, null],
  ] as const
  it.each(rows)('%s is %s: damage %d, cooldown %d, durability %s', (id, kind, damage, cooldown, durability) => {
    expectFields(id, WEAPON_MAP[id], { kind, damage, cooldown, durability })
  })
  it('consumables apply their effects', () => {
    expectFields('blessed-rounds', WEAPON_MAP['blessed-rounds'], { kind: 'consumable', effect: 'blessed-rounds' })
    expectFields('kola-tonic', WEAPON_MAP['kola-tonic'], { kind: 'consumable', effect: 'adrenaline' })
  })
})

describe('§4 firearms (07)', () => {
  it('revolver', () => {
    expectFields('revolver', FIREARM_MAP.revolver, {
      ammo: 'revolver-cartridge', capacity: 6, reloadS: 2.4, fireIntervalS: 0.45, pellets: 1, damage: 34,
      spreadHipDeg: 1.5, spreadAimedDeg: 0.5, headshotMult: 2, rangeM: 40,
      recoilUpDeg: 2.5, recoilRecoverS: 0.3, noiseRadiusM: 30, startMagazine: 6, startAmmo: 6,
    })
  })
  it('shotgun', () => {
    expectFields('shotgun', FIREARM_MAP.shotgun, {
      ammo: 'shotgun-shell', capacity: 2, reloadS: 2.0, fireIntervalS: 0.3, pellets: 8, damage: 9,
      spreadHipDeg: 6, spreadAimedDeg: 5, headshotMult: 1.5, rangeM: 15, falloffEndM: 20,
      recoilUpDeg: 6, recoilRecoverS: 0.4, noiseRadiusM: 40, startMagazine: 2, startAmmo: 4,
    })
  })
  it('head zone is the top 0.3 m', () => {
    expect(HEAD_ZONE_M, 'HEAD_ZONE_M').toBe(0.3)
  })
})

describe('§4 heavy melee (07)', () => {
  it('wood-axe', () => {
    expectFields('wood-axe', HEAVY_MAP['wood-axe'], {
      chargeS: 0.8, heavyDamage: 70, staminaCost: 25, knockdownS: 1.5, wailerBonus: 0,
    })
  })
  it('silver-sabre', () => {
    expectFields('silver-sabre', HEAVY_MAP['silver-sabre'], {
      chargeS: 0.6, heavyDamage: 60, staminaCost: 20, knockdownS: 1.2, wailerBonus: 0.5,
    })
  })
})

describe('§4 weapon upgrades (07)', () => {
  type Row = [string, string, [string, number][], [string, number, number][]]
  const rows: Row[] = [
    ['up-revolver-cylinder', 'revolver', [['iron-nail', 4], ['lead-shot', 2]], [['capacity', 6, 8]]],
    ['up-revolver-speedloader', 'revolver', [['cloth', 2], ['wood-plank', 1], ['iron-nail', 2]], [['reloadS', 2.4, 1.4]]],
    ['up-revolver-barrel', 'revolver', [['iron-nail', 3], ['silver-filings', 1]], [['damage', 34, 44]]],
    ['up-shotgun-choke', 'shotgun', [['iron-nail', 3]], [['spreadHipDeg', 6, 4]]],
    ['up-shotgun-belt', 'shotgun', [['cloth', 2], ['lead-shot', 1]], [['reloadS', 2.0, 1.3]]],
    ['up-shotgun-heavy', 'shotgun', [['lead-shot', 3], ['black-powder', 1]], [['pelletDamage', 9, 12]]],
    ['up-axe-haft', 'wood-axe', [['iron-nail', 3], ['wood-plank', 1]], [['durability', 60, 100]]],
    ['up-axe-edge', 'wood-axe', [['iron-nail', 2], ['bone', 1]], [['lightDamage', 30, 38], ['heavyDamage', 70, 88]]],
    ['up-sabre-blessed', 'silver-sabre', [['holy-water', 1], ['silver-filings', 1]], [['lightDamage', 28, 34], ['heavyDamage', 60, 72]]],
    ['up-sabre-hilt', 'silver-sabre', [['iron-nail', 3], ['cloth', 1]], [['heavyStaminaCost', 20, 12]]],
  ]
  it('has exactly the ten bible rows', () => {
    expect(WEAPON_UPGRADES.map((u) => u.id)).toEqual(rows.map((r) => r[0]))
  })
  it.each(rows)('%s', (id, weapon, cost, changes) => {
    expectFields(id, UPGRADE_MAP[id as keyof typeof UPGRADE_MAP], {
      weapon,
      cost: cost.map(([item, qty]) => ({ item, qty })),
      changes: changes.map(([stat, from, to]) => ({ stat, from, to })),
    })
  })
})

describe('§4 timed effects (07)', () => {
  it.each([
    ['blessed-rounds', 30, '✝', { firearmDamage: 2 }],
    ['adrenaline', 20, '⚡', { moveSpeed: 1.3, sprintDrain: 0.5 }],
    ['salt-circle', 30, '◎', {}],
  ] as const)('%s', (id, durationS, glyph, mods) => {
    expectFields(id, EFFECT_MAP[id], { durationS, glyph, mods })
  })
  it('has exactly three effects', () => {
    expect(EFFECTS.map((e) => e.id)).toEqual(['blessed-rounds', 'adrenaline', 'salt-circle'])
  })
})

describe('§5 recipes (07)', () => {
  it.each([
    ['r-revolver-cartridge', [['black-powder', 1], ['lead-shot', 1]], 'revolver-cartridge', 6, { type: 'pickup', weapon: 'revolver' }],
    ['r-shotgun-shell', [['black-powder', 1], ['lead-shot', 2], ['cloth', 1]], 'shotgun-shell', 4, { type: 'pickup', weapon: 'shotgun' }],
    ['r-blessed-rounds', [['holy-water', 1], ['silver-filings', 1]], 'blessed-rounds', 1, { type: 'night', night: 2 }],
  ] as const)('%s', (id, inputs, item, qty, unlock) => {
    expectFields(id, RECIPE_MAP[id], {
      inputs: inputs.map(([i, q]) => ({ item: i, qty: q })),
      output: { item, qty },
      unlock,
    })
  })
})

describe('§7 enemies (07)', () => {
  it.each([
    ['bloater', 80, 1.0, 15],
    ['brute', 300, 1.1, 30],
    ['father-crane', 1500, 1.2, 30],
  ] as const)('%s', (id, hp, speed, damage) => {
    expectFields(id, ENEMY_MAP[id], { hp, speed, damage })
  })
  it('bloater and brute attack at 1.2 m every 1.5 s', () => {
    for (const id of ['bloater', 'brute'] as const) {
      expectFields(id, ENEMY_MAP[id], { attackRange: 1.2, attackCooldown: 1.5 })
    }
  })
})

describe('§7 elites (07)', () => {
  it('modifiers', () => {
    expectFields('ELITE', ELITE, {
      fromNight: 2, maxPerWave: 1, hpMult: 2, speedMult: 1.15, damageMult: 1.25, scale: 1.05,
      eligible: ['shambler', 'bloater', 'brute'],
    })
    expect(ELITE.chance.normal, 'ELITE.chance.normal').toBe(0.06)
  })
  it('drops', () => {
    expect(ELITE_DROPS.map((d) => [d.item, d.qty, d.weight])).toEqual([
      ['revolver-cartridge', 6, 30],
      ['shotgun-shell', 2, 25],
      ['silver-filings', 1, 20],
      ['kola-tonic', 1, 15],
      ['black-powder', 2, 10],
    ])
  })
})

describe('§8 wave additions (07)', () => {
  const additions = { 3: [{}, {}, { bloater: 1 }], 4: [{}, {}, {}, { bloater: 1, brute: 1 }], 5: [{}, {}, {}, { bloater: 2, brute: 1 }, { bloater: 2, brute: 1 }] }
  it('match the "Added in spec 07" column', () => {
    expect(WAVE_ADDITIONS[1]).toEqual([])
    expect(WAVE_ADDITIONS[2]).toEqual([])
    for (const night of [3, 4, 5] as const) {
      expect(WAVE_ADDITIONS[night], `night ${night} additions`).toEqual(additions[night])
    }
  })
  it('night 5 has five waves, the last two with 2 bloaters and 1 brute', () => {
    const waves = NIGHTS.find((n) => n.night === 5)!.waves
    expect(waves).toHaveLength(5)
    for (const w of waves.slice(3)) expectFields('night-5 wave', w, { bloater: 2, brute: 1 })
  })
})

describe('§2 and §7 boss and barricades (07)', () => {
  it('boss', () => {
    expectFields('BOSS', BOSS, {
      riseAfterS: 10, riseTelegraphS: 1.5, nameCardS: 3, riteCapS: 44, deathQuietS: 4,
      phaseAt: { two: 0.6, three: 0.25 },
      speed: { 1: 1.2, 2: 1.5, 3: 1.7 },
      saltSpeedMult: 0.5,
      censer: { windupS: 1.0, arcDeg: 120, reachM: 3, damage: 30 },
      toll: { everyS: 12, telegraphS: 1.2, radiusM: 8, damage: 20, pushM: 3 },
      congregation: { everyS: { 1: 25, 2: 25, 3: 18 }, telegraphS: 1.0, count: 3 },
    })
  })
  it('doors', () => {
    expectFields('DOORS', DOORS, {
      ids: ['front', 'vestry'], slots: 3, boardHp: 60, nailTimeS: 2, bruteMult: 2, riteMult: 2,
      nailCost: [{ item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 2 }],
    })
  })
})
