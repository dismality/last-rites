// Weapon pickup rule — pure TypeScript. Req 2.1–2.7.
//
// A pickup is all-or-nothing: the weapon, its ammunition stack, the hotbar
// binding and the "taken" record land together, or nothing changes.

import type { Inventory, RecipeId } from '../types'
import type { WeaponPickupId } from '../../data/weaponPickups'
import { WEAPON_PICKUPS } from '../../data/weaponPickups'
import { SATCHEL_SLOTS } from '../../data/items'
import { addItem, assignHotbar } from './inventory'

export type PickupRefusal = 'unknown' | 'taken' | 'satchel-full'

export type PickupCheck = { ok: true } | { ok: false; reason: PickupRefusal; message: string }

export type TakeResult =
  | {
      ok: true
      inv: Inventory
      taken: WeaponPickupId[]
      recipes: RecipeId[]
      /** Rounds to load into the weapon, if it is a firearm. */
      magazine: number | null
    }
  | { ok: false; reason: PickupRefusal; message: string }

const FULL_MESSAGE = 'Satchel full'

function refuse(reason: PickupRefusal): { ok: false; reason: PickupRefusal; message: string } {
  const message = reason === 'satchel-full' ? FULL_MESSAGE : reason === 'taken' ? 'Already taken' : 'Unknown pickup'
  return { ok: false, reason, message }
}

/** Slots are checked first, against the pickup's declared need (Req 2.2, 2.3). */
export function canTakePickup(
  inv: Inventory,
  taken: readonly WeaponPickupId[],
  id: WeaponPickupId,
  capacity: number = SATCHEL_SLOTS,
): PickupCheck {
  const def = WEAPON_PICKUPS.find((p) => p.id === id)
  if (!def) return refuse('unknown')
  if (taken.includes(id)) return refuse('taken')
  if (capacity - inv.slots.length < def.slotsNeeded) return refuse('satchel-full')
  return { ok: true }
}

export function takePickup(
  inv: Inventory,
  taken: readonly WeaponPickupId[],
  unlocked: readonly RecipeId[],
  id: WeaponPickupId,
  capacity: number = SATCHEL_SLOTS,
): TakeResult {
  const check = canTakePickup(inv, taken, id, capacity)
  if (!check.ok) return check
  const def = WEAPON_PICKUPS.find((p) => p.id === id)!

  const weapon = addItem(inv, id, 1)
  if (weapon.added !== 1) return refuse('satchel-full')
  let next = weapon.inv
  if (def.ammo) {
    const ammo = addItem(next, def.ammo.id, def.ammo.quantity)
    // A partial ammo grant would break atomicity, so treat it as a refusal.
    if (ammo.rejected > 0) return refuse('satchel-full')
    next = ammo.inv
  }

  const empty = next.hotbar.indexOf(null)
  if (empty >= 0) next = assignHotbar(next, empty, id)

  const recipes =
    def.recipe && !unlocked.includes(def.recipe) ? [...unlocked, def.recipe] : [...unlocked]
  return { ok: true, inv: next, taken: [...taken, id], recipes, magazine: def.magazine ?? null }
}
