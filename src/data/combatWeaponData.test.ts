import { describe, expect, it } from 'vitest'
import { FIREARMS, HEAD_ZONE_M } from './firearms'
import { HEAVY_MELEE } from './heavyMelee'
import { DODGE, KICK, KNOCKDOWN_DAMAGE_MULT } from './combatMoves'
import { EFFECTS } from './effects'
import { WEAPON_UPGRADES } from './upgrades'

describe('combat weapon data matches the design bible §4', () => {
  it('firearms', () => {
    const r = FIREARMS.find((f) => f.id === 'revolver')!
    expect([r.capacity, r.reloadS, r.fireIntervalS, r.pellets, r.damage]).toEqual([6, 2.4, 0.45, 1, 34])
    expect([r.spreadHipDeg, r.spreadAimedDeg, r.headshotMult, r.rangeM]).toEqual([1.5, 0.5, 2, 40])
    expect([r.recoilUpDeg, r.recoilRecoverS, r.noiseRadiusM, r.startMagazine, r.startAmmo]).toEqual([2.5, 0.3, 30, 6, 6])
    const s = FIREARMS.find((f) => f.id === 'shotgun')!
    expect([s.capacity, s.reloadS, s.fireIntervalS, s.pellets, s.damage]).toEqual([2, 2.0, 0.3, 8, 9])
    expect([s.spreadHipDeg, s.spreadAimedDeg, s.headshotMult, s.rangeM, s.falloffEndM]).toEqual([6, 5, 1.5, 15, 20])
    expect([s.recoilUpDeg, s.recoilRecoverS, s.noiseRadiusM, s.startMagazine, s.startAmmo]).toEqual([6, 0.4, 40, 2, 4])
    expect(HEAD_ZONE_M).toBe(0.3)
  })

  it('heavy melee, kick and dodge', () => {
    const axe = HEAVY_MELEE.find((h) => h.id === 'wood-axe')!
    expect([axe.chargeS, axe.heavyDamage, axe.staminaCost, axe.knockdownS]).toEqual([0.8, 70, 25, 1.5])
    const sabre = HEAVY_MELEE.find((h) => h.id === 'silver-sabre')!
    expect([sabre.chargeS, sabre.heavyDamage, sabre.staminaCost, sabre.knockdownS, sabre.wailerBonus]).toEqual([0.6, 60, 20, 1.2, 0.5])
    expect(KICK).toMatchObject({ staminaCost: 15, damage: 5, pushM: 2, staggerS: 0.6, bruteStaggerS: 0.3, cooldownS: 1.2 })
    expect(DODGE).toMatchObject({ staminaCost: 25, distanceM: 3, durationS: 0.25, iFramesS: 0.2, cooldownS: 0.8 })
    expect(KNOCKDOWN_DAMAGE_MULT).toBe(1.25)
  })

  it('effects', () => {
    const e = Object.fromEntries(EFFECTS.map((x) => [x.id, x]))
    expect(e['blessed-rounds']).toMatchObject({ durationS: 30, glyph: '✝', mods: { firearmDamage: 2 } })
    expect(e['adrenaline']).toMatchObject({ durationS: 20, glyph: '⚡', mods: { moveSpeed: 1.3, sprintDrain: 0.5 } })
    expect(e['salt-circle']).toMatchObject({ durationS: 30, glyph: '◎' })
    expect(new Set(EFFECTS.map((x) => x.glyph)).size).toBe(3)
  })

  it('upgrades', () => {
    expect(WEAPON_UPGRADES).toHaveLength(10)
    const u = Object.fromEntries(WEAPON_UPGRADES.map((x) => [x.id, x]))
    expect(u['up-revolver-cylinder'].cost).toEqual([{ item: 'iron-nail', qty: 4 }, { item: 'lead-shot', qty: 2 }])
    expect(u['up-revolver-barrel'].changes).toEqual([{ stat: 'damage', from: 34, to: 44 }])
    expect(u['up-shotgun-heavy'].cost).toEqual([{ item: 'lead-shot', qty: 3 }, { item: 'black-powder', qty: 1 }])
    expect(u['up-axe-edge'].changes).toEqual([
      { stat: 'lightDamage', from: 30, to: 38 },
      { stat: 'heavyDamage', from: 70, to: 88 },
    ])
    expect(u['up-sabre-hilt'].changes).toEqual([{ stat: 'heavyStaminaCost', from: 20, to: 12 }])
  })

  it('no two upgrades change the same stat of the same weapon', () => {
    const seen = new Set<string>()
    for (const up of WEAPON_UPGRADES)
      for (const c of up.changes) {
        const key = `${up.weapon}:${c.stat}`
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
      }
  })

  it('every upgrade weapon is a firearm or heavy weapon, and from-values match base data', () => {
    const firearms = new Set<string>(FIREARMS.map((f) => f.id))
    const heavies = new Set<string>(HEAVY_MELEE.map((h) => h.id))
    for (const up of WEAPON_UPGRADES) expect(firearms.has(up.weapon) || heavies.has(up.weapon), up.id).toBe(true)
    const rev = FIREARMS[0], sg = FIREARMS[1]
    const from = (id: string, stat: string) => WEAPON_UPGRADES.find((x) => x.id === id)!.changes.find((c) => c.stat === stat)!.from
    expect(from('up-revolver-cylinder', 'capacity')).toBe(rev.capacity)
    expect(from('up-revolver-speedloader', 'reloadS')).toBe(rev.reloadS)
    expect(from('up-revolver-barrel', 'damage')).toBe(rev.damage)
    expect(from('up-shotgun-choke', 'spreadHipDeg')).toBe(sg.spreadHipDeg)
    expect(from('up-shotgun-belt', 'reloadS')).toBe(sg.reloadS)
    expect(from('up-shotgun-heavy', 'pelletDamage')).toBe(sg.damage)
    expect(from('up-sabre-hilt', 'heavyStaminaCost')).toBe(HEAVY_MELEE[1].staminaCost)
  })
})
