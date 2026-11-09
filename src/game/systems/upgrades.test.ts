import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Inventory, ItemId, UpgradeId } from '../types'
import { WEAPON_UPGRADES, UPGRADE_MAP } from '../../data/upgrades'
import { FIREARM_MAP } from '../../data/firearms'
import { addItem, countItem, createInventory } from './inventory'
import {
  buyUpgrade,
  canBuyUpgrade,
  deriveStats,
  firearmStats,
  listableUpgrades,
  missingReason,
  upgradeLines,
} from './upgrades'

const IDS = WEAPON_UPGRADES.map((u) => u.id)

/** An inventory with every weapon plus `extra` of each cost material. */
function richInv(extra = 0): Inventory {
  let inv = createInventory()
  for (const w of ['revolver', 'shotgun', 'wood-axe', 'silver-sabre'] as ItemId[]) {
    inv = addItem(inv, w, 1).inv
  }
  const mats = new Set<ItemId>(WEAPON_UPGRADES.flatMap((u) => u.cost.map((c) => c.item)))
  for (const m of mats) inv = addItem(inv, m, extra).inv
  return inv
}

describe('upgrades', () => {
  it('Feature: 07-combat-and-enemies, Property 20: any buy order gives the same stats', () => {
    // **Validates: Requirements 8.13, 11.1, 11.2, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11**
    fc.assert(
      fc.property(fc.subarray(IDS), fc.infiniteStream(fc.nat()), (subset, rnd) => {
        const shuffled = [...subset].sort(() => rnd.next().value - 5)
        for (const w of ['revolver', 'shotgun', 'wood-axe', 'silver-sabre'] as const) {
          expect(deriveStats(w, shuffled)).toEqual(deriveStats(w, subset))
        }
      }),
    )
  })

  it('Property 20: a purchase removes exactly the cost and records once', () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDS), (id) => {
        const inv = richInv(10)
        const r = buyUpgrade(inv, [], id)
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.bought).toEqual([id])
        for (const c of UPGRADE_MAP[id].cost) {
          expect(countItem(r.inv, c.item)).toBe(countItem(inv, c.item) - c.qty)
        }
        const again = buyUpgrade(r.inv, r.bought, id)
        expect(again).toEqual({ ok: false, reason: 'already-bought' })
      }),
    )
  })

  it('Property 20: rejections leave state alone and name the shortfall', () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDS), fc.nat(3), (id, keep) => {
        const def = UPGRADE_MAP[id]
        let inv = addItem(createInventory(), def.weapon, 1).inv
        const total = def.cost.reduce((n, c) => n + c.qty, 0)
        // Give fewer materials than the cost needs.
        let given = 0
        for (const c of def.cost) {
          const q = Math.min(c.qty, Math.max(0, Math.min(keep, total - 1) - given))
          if (q > 0) inv = addItem(inv, c.item, q).inv
          given += q
        }
        const r = buyUpgrade(inv, [], id)
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.reason).toBe('missing')
        expect(r.missing!.length).toBeGreaterThan(0)
        for (const m of r.missing!) {
          const need = def.cost.filter((c) => c.item === m.item).reduce((n, c) => n + c.qty, 0)
          expect(m.qty).toBe(need - countItem(inv, m.item))
        }
        expect(missingReason(r.missing!)).toMatch(/^Need \d+ more /)
      }),
    )
  })

  it('refuses when the weapon is not owned and lists only owned weapons', () => {
    const inv = addItem(createInventory(), 'iron-nail', 10).inv
    expect(canBuyUpgrade(inv, [], 'up-shotgun-choke')).toEqual({ ok: false, reason: 'weapon-not-owned' })
    expect(listableUpgrades(inv)).toEqual([])
    const withGun = addItem(inv, 'shotgun', 1).inv
    expect(listableUpgrades(withGun)).toEqual([
      'up-shotgun-choke',
      'up-shotgun-belt',
      'up-shotgun-heavy',
    ])
    expect(canBuyUpgrade(withGun, [], 'nope' as UpgradeId)).toEqual({ ok: false, reason: 'unknown' })
  })

  it('applies table values and does not touch the rounds loaded', () => {
    const all = IDS as UpgradeId[]
    const rev = firearmStats('revolver', all)
    expect(rev.capacity).toBe(8)
    expect(rev.reloadS).toBe(1.4)
    expect(rev.damage).toBe(44)
    const sg = firearmStats('shotgun', all)
    expect(sg.spreadHipDeg).toBe(4)
    expect(sg.reloadS).toBe(1.3)
    expect(sg.damage).toBe(12)
    expect(firearmStats('revolver', []).capacity).toBe(6)
    expect(deriveStats('wood-axe', all)).toMatchObject({
      durability: 100,
      lightDamage: 38,
      heavyDamage: 88,
    })
    expect(deriveStats('silver-sabre', all)).toMatchObject({ heavyStaminaCost: 12, heavyDamage: 72 })
  })

  it('aimed shotgun spread is never wider than hip, and mods apply', () => {
    fc.assert(
      fc.property(fc.subarray(IDS), (subset) => {
        const s = firearmStats('shotgun', subset)
        expect(s.spreadAimedDeg).toBeLessThanOrEqual(s.spreadHipDeg)
      }),
    )
    expect(firearmStats('shotgun', ['up-shotgun-choke']).spreadAimedDeg).toBe(4)
    const m = firearmStats('revolver', [], { reloadMult: 0.5, headshotAdd: 0.25 })
    expect(m.reloadS).toBeCloseTo(FIREARM_MAP.revolver.reloadS * 0.5)
    expect(m.headshotMult).toBe(2.25)
  })

  it('formats lines', () => {
    expect(upgradeLines('up-revolver-cylinder')).toEqual(['Capacity 6 → 8'])
    expect(upgradeLines('up-axe-edge')).toEqual(['Damage 30 → 38', 'Heavy damage 70 → 88'])
    expect(missingReason([{ item: 'iron-nail', qty: 2 }])).toBe('Need 2 more iron nails')
  })
})
