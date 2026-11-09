import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Inventory, ItemId, RecipeId } from '../types'
import { WEAPON_PICKUPS } from '../../data/weaponPickups'
import { SATCHEL_SLOTS } from '../../data/items'
import { addItem, countItem, createInventory } from './inventory'
import { canTakePickup, takePickup } from './weaponPickups'

const FILLER: ItemId[] = [
  'bone',
  'iron-nail',
  'candle-wax',
  'holy-water',
  'cloth',
  'lamp-oil',
  'grave-salt',
  'wood-plank',
  'black-powder',
  'lead-shot',
  'silver-filings',
  'bandage',
]

function filled(n: number): Inventory {
  let inv = createInventory()
  for (const id of FILLER.slice(0, n)) inv = addItem(inv, id, 1).inv
  return inv
}

const pickupArb = fc.constantFrom(...WEAPON_PICKUPS.map((p) => p.id))
const takenArb = fc.subarray(WEAPON_PICKUPS.map((p) => p.id))
const recipesArb = fc.subarray<RecipeId>(['r-bone-club', 'r-revolver-cartridge', 'r-shotgun-shell'])

describe('weaponPickups', () => {
  it('takes the revolver with 6 cartridges, a magazine and its recipe', () => {
    const r = takePickup(createInventory(), [], [], 'revolver')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(countItem(r.inv, 'revolver')).toBe(1)
    expect(countItem(r.inv, 'revolver-cartridge')).toBe(6)
    expect(r.inv.hotbar[0]).toBe('revolver')
    expect(r.taken).toEqual(['revolver'])
    expect(r.recipes).toEqual(['r-revolver-cartridge'])
    expect(r.magazine).toBe(6)
  })

  it('refuses a firearm with only one free slot, and a taken pickup', () => {
    const full = filled(SATCHEL_SLOTS - 1)
    const r = takePickup(full, [], [], 'shotgun')
    expect(r).toMatchObject({ ok: false, reason: 'satchel-full', message: 'Satchel full' })
    expect(takePickup(full, [], [], 'wood-axe').ok).toBe(true)
    expect(canTakePickup(createInventory(), ['wood-axe'], 'wood-axe')).toMatchObject({
      ok: false,
      reason: 'taken',
    })
  })

  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
  it('Feature: 07-combat-and-enemies, Property 2: pickups are atomic and happen once', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: SATCHEL_SLOTS }),
        takenArb,
        recipesArb,
        pickupArb,
        (n, taken, unlocked, id) => {
          const inv = filled(n)
          const def = WEAPON_PICKUPS.find((p) => p.id === id)!
          const r = takePickup(inv, taken, unlocked, id)
          if (taken.includes(id)) {
            expect(r).toMatchObject({ ok: false, reason: 'taken' })
          } else if (SATCHEL_SLOTS - n < def.slotsNeeded) {
            expect(r).toMatchObject({ ok: false, reason: 'satchel-full' })
          } else {
            expect(r.ok).toBe(true)
            if (!r.ok) return
            expect(countItem(r.inv, id)).toBe(1)
            if (def.ammo) expect(countItem(r.inv, def.ammo.id)).toBe(def.ammo.quantity)
            expect(r.taken).toEqual([...taken, id])
            expect(new Set(r.recipes).size).toBe(r.recipes.length)
            for (const u of unlocked) expect(r.recipes).toContain(u)
            if (def.recipe) expect(r.recipes).toContain(def.recipe)
          }
          // Refusals leave the inputs untouched.
          expect(inv.slots.length).toBe(n)
        },
      ),
    )
  })
})
