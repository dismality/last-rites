import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { BOARD_HP_MAX_SAVE, DOORS } from '../../data/barricades'
import { AMMO_STACK_LIMITS } from '../../data/items'
import { WEAPON_UPGRADES } from '../../data/upgrades'
import type { FirearmId, Inventory, UpgradeId } from '../types'
import { DURABLE_IDS, sanitizeCombat, sanitizeInventorySlots } from './combatSave'
import type { CombatSave } from './combatSave'
import { maxDurability } from './durability'
import { createInventory } from './inventory'
import type { ChapelState } from './repairs'
import { firearmStats } from './upgrades'

const noChapel: ChapelState = { completedStages: [], altarHealedToday: false, finalRiteActive: false }
const stage1: ChapelState = { ...noChapel, completedStages: ['barDoor'] }

const armed = (): Inventory => ({
  ...createInventory(),
  slots: [
    { item: 'revolver', qty: 1 },
    { item: 'shotgun', qty: 1 },
    { item: 'bone-club', qty: 1 },
    { item: 'sharpened-shovel', qty: 1 },
    { item: 'wood-axe', qty: 1 },
    { item: 'silver-sabre', qty: 1 },
  ],
})

const validCombat = fc
  .record({
    ups: fc.subarray(WEAPON_UPGRADES.map((u) => u.id)),
    rev: fc.nat(100),
    sg: fc.nat(100),
    dur: fc.tuple(fc.nat(1000), fc.nat(1000), fc.nat(1000)),
    taken: fc.subarray(['revolver', 'shotgun', 'wood-axe', 'silver-sabre'] as const),
    built: fc.boolean(),
    front: fc.array(fc.integer({ min: 1, max: BOARD_HP_MAX_SAVE }), { maxLength: 3 }),
    vestry: fc.array(fc.integer({ min: 1, max: BOARD_HP_MAX_SAVE }), { maxLength: 3 }),
  })
  .map((r): CombatSave => {
    const ups = r.ups as UpgradeId[]
    const firearms: CombatSave['firearms'] = {}
    const caps: Record<FirearmId, number> = {
      revolver: firearmStats('revolver', ups).capacity,
      shotgun: firearmStats('shotgun', ups).capacity,
    }
    firearms.revolver = { magazine: r.rev % (caps.revolver + 1) }
    firearms.shotgun = { magazine: r.sg % (caps.shotgun + 1) }
    const durability: CombatSave['durability'] = {}
    DURABLE_IDS.forEach((id, i) => {
      const max = maxDurability(id, ups) as number
      durability[id] = 1 + (r.dur[i] % max)
    })
    return {
      firearms,
      durability,
      upgrades: ups,
      takenPickups: [...r.taken],
      doors: { built: r.built, front: r.front, vestry: r.vestry },
    }
  })

describe('sanitizeCombat', () => {
  /** Property 30: Combat saves round-trip and sanitise per field. Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.7, 19.8 */
  it('round-trips any valid combat state through JSON', () => {
    fc.assert(
      fc.property(validCombat, (c) => {
        const back = sanitizeCombat(JSON.parse(JSON.stringify(c)), { inventory: armed(), chapel: noChapel })
        expect(back).toEqual(c)
      }),
    )
  })

  it('replaces only invalid entries and keeps valid ones', () => {
    fc.assert(
      fc.property(validCombat, fc.integer({ min: 1, max: 500 }), (c, extra) => {
        const cap = firearmStats('revolver', c.upgrades).capacity
        const dirty = {
          ...c,
          firearms: { ...c.firearms, revolver: { magazine: cap + extra }, ghost: { magazine: 1 } },
          durability: { ...c.durability, 'bone-club': 0, 'rusty-shovel': 5 },
          upgrades: [...c.upgrades, 'up-nope'],
          takenPickups: [...c.takenPickups, 'nope'],
          doors: { ...c.doors, front: [...c.doors.front, 0, BOARD_HP_MAX_SAVE + 1] },
        }
        const out = sanitizeCombat(dirty, { inventory: armed(), chapel: noChapel })
        expect(out.firearms.revolver!.magazine).toBeLessThanOrEqual(cap)
        expect(out.firearms.shotgun).toEqual(c.firearms.shotgun)
        expect(out.durability['bone-club']).toBe(maxDurability('bone-club', c.upgrades))
        expect(out.durability['wood-axe']).toBe(c.durability['wood-axe'])
        expect(out.upgrades).toEqual(c.upgrades)
        expect(out.takenPickups).toEqual(c.takenPickups)
        expect(out.doors.front).toEqual(c.doors.front.slice(0, DOORS.slots))
        expect(out.doors.vestry).toEqual(c.doors.vestry)
      }),
    )
  })

  it('drops upgrades, magazines and durability for weapons not in the satchel', () => {
    const inv = { ...createInventory(), slots: [{ item: 'revolver' as const, qty: 1 }] }
    const out = sanitizeCombat(
      {
        firearms: { revolver: { magazine: 3 }, shotgun: { magazine: 1 } },
        durability: { 'wood-axe': 10 },
        upgrades: ['up-revolver-cylinder', 'up-shotgun-choke', 'up-revolver-cylinder'],
      },
      { inventory: inv, chapel: noChapel },
    )
    expect(out.firearms).toEqual({ revolver: { magazine: 3 } })
    expect(out.durability).toEqual({})
    expect(out.upgrades).toEqual(['up-revolver-cylinder'])
  })

  it('accepts a magazine of 8 only with the Larger Cylinder', () => {
    const inv = { ...createInventory(), slots: [{ item: 'revolver' as const, qty: 1 }] }
    const base = { firearms: { revolver: { magazine: 8 } } }
    expect(sanitizeCombat(base, { inventory: inv, chapel: noChapel }).firearms.revolver!.magazine).toBe(6)
    const withUp = { ...base, upgrades: ['up-revolver-cylinder'] }
    expect(sanitizeCombat(withUp, { inventory: inv, chapel: noChapel }).firearms.revolver!.magazine).toBe(8)
  })

  it('gives a pre-07 save defaults, with two full boards per door once stage 1 is built', () => {
    const built = sanitizeCombat(undefined, { inventory: armed(), chapel: stage1 })
    expect(built.doors).toEqual({
      built: true,
      front: [DOORS.boardHp, DOORS.boardHp],
      vestry: [DOORS.boardHp, DOORS.boardHp],
    })
    const none = sanitizeCombat('junk', { inventory: createInventory(), chapel: noChapel })
    expect(none).toEqual({
      firearms: {},
      durability: {},
      upgrades: [],
      takenPickups: [],
      doors: { built: false, front: [], vestry: [] },
    })
  })
})

describe('sanitizeInventorySlots', () => {
  it('drops bad slot entries and nulls hotbar entries naming them', () => {
    const out = sanitizeInventorySlots({
      slots: [
        { item: 'bone', qty: 4 },
        { item: 'cloth', qty: 11 },
        { item: 'ghost', qty: 1 },
        { item: 'iron-nail', qty: 1.5 },
        { item: 'lamp-oil', qty: 0 },
        { item: 'revolver-cartridge', qty: AMMO_STACK_LIMITS['revolver-cartridge'] },
      ],
      keyItems: [],
      relics: [],
      hotbar: ['bone', 'cloth', 'ghost', null],
    }) as Inventory
    expect(out.slots.map((s) => s.item)).toEqual(['bone', 'revolver-cartridge'])
    expect(out.hotbar).toEqual(['bone', null, null, null])
  })

  it('leaves a structurally broken inventory untouched', () => {
    const junk = { slots: 'x' }
    expect(sanitizeInventorySlots(junk)).toBe(junk)
    expect(sanitizeInventorySlots(null)).toBeNull()
  })
})
