// Inventory system — pure TypeScript, no React / three.js / Howler.
//
// Operates on the shared `Inventory` shape from ../types. Every function
// returns a new inventory; callers (stores) decide what to do with refused
// items. Refused items stay in the world, so we only report the count.

import { ITEM_MAP, SATCHEL_SLOTS, usesSatchelSlot } from '../../data/items'
import type { Inventory, ItemId, ItemStack, KeyItemId, RelicId } from '../types'

export type AddRefusal = 'stack-full' | 'satchel-full' | 'duplicate'

export interface AddResult {
  inv: Inventory
  added: number
  rejected: number
  reason: AddRefusal | null
  /** Player-facing toast text; null when everything was accepted. */
  message: string | null
}

export interface RemoveResult {
  inv: Inventory
  removed: number
}

export function createInventory(): Inventory {
  return { slots: [], keyItems: [], relics: [], hotbar: [null, null, null, null] }
}

/** Total quantity of `id` held, across satchel slots and key/relic sets. */
export function countItem(inv: Inventory, id: ItemId): number {
  if (isKeyItem(id)) return inv.keyItems.includes(id) ? 1 : 0
  if (isRelic(id)) return inv.relics.includes(id) ? 1 : 0
  return inv.slots.reduce((sum, s) => (s.item === id ? sum + s.qty : sum), 0)
}

export function hasItems(inv: Inventory, reqs: readonly ItemStack[]): boolean {
  // Sum duplicate requirements first so [{bone,2},{bone,2}] needs 4, not 2.
  const needed = new Map<ItemId, number>()
  for (const r of reqs) needed.set(r.item, (needed.get(r.item) ?? 0) + r.qty)
  for (const [id, qty] of needed) if (countItem(inv, id) < qty) return false
  return true
}

/** slotLimit defaults to the base satchel; Deep Pockets raises it. */
export function addItem(
  inv: Inventory,
  id: ItemId,
  qty: number,
  slotLimit: number = SATCHEL_SLOTS,
): AddResult {
  const def = ITEM_MAP[id]
  const amount = Math.max(0, Math.floor(qty))
  if (amount === 0) return result(inv, 0, 0, null, def.name)

  // Keys, relics and lore are unique and live outside the 12 slots.
  if (!usesSatchelSlot(def.kind)) {
    if (countItem(inv, id) > 0) return result(inv, 0, amount, 'duplicate', def.name)
    const next = isRelic(id)
      ? { ...inv, relics: [...inv.relics, id] }
      : { ...inv, keyItems: [...inv.keyItems, id as KeyItemId] }
    return result(next, 1, amount - 1, amount > 1 ? 'duplicate' : null, def.name)
  }

  const slots = inv.slots.map((s) => ({ ...s }))
  let remaining = amount
  let hadStack = false

  for (const slot of slots) {
    if (slot.item !== id) continue
    hadStack = true
    const take = Math.min(def.stackLimit - slot.qty, remaining)
    slot.qty += take
    remaining -= take
  }

  // Materials keep a single stack per item, so a full stack is refused rather
  // than spilling into a second slot. One-per-slot gear still opens new slots.
  const mayOpenSlots = def.stackLimit === 1 || !hadStack
  while (remaining > 0 && mayOpenSlots && slots.length < slotLimit) {
    const take = Math.min(def.stackLimit, remaining)
    slots.push({ item: id, qty: take })
    remaining -= take
  }

  const reason: AddRefusal | null =
    remaining === 0 ? null : mayOpenSlots ? 'satchel-full' : 'stack-full'
  return result({ ...inv, slots }, amount - remaining, remaining, reason, def.name)
}

/** Removes up to `qty`, taking from the last stacks first. */
export function removeItem(inv: Inventory, id: ItemId, qty: number): RemoveResult {
  const amount = Math.max(0, Math.floor(qty))
  if (isKeyItem(id) || isRelic(id)) {
    if (amount === 0 || countItem(inv, id) === 0) return { inv, removed: 0 }
    return {
      inv: {
        ...inv,
        keyItems: inv.keyItems.filter((k) => k !== id),
        relics: inv.relics.filter((r) => r !== id),
      },
      removed: 1,
    }
  }

  let remaining = amount
  const slots = inv.slots.map((s) => ({ ...s }))
  for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
    if (slots[i].item !== id) continue
    const take = Math.min(slots[i].qty, remaining)
    slots[i].qty -= take
    remaining -= take
  }
  const kept = slots.filter((s) => s.qty > 0)

  // A hotbar binding to an item we no longer hold would point at nothing.
  const gone = !kept.some((s) => s.item === id)
  const hotbar = (
    gone ? inv.hotbar.map((h) => (h === id ? null : h)) : [...inv.hotbar]
  ) as Inventory['hotbar']
  return { inv: { ...inv, slots: kept, hotbar }, removed: amount - remaining }
}

/**
 * Bind `item` to hotbar `index` (0–3). Only satchel items can be bound, and an
 * item occupies at most one hotbar slot, so a previous binding is moved.
 * Invalid requests return the inventory unchanged.
 */
export function assignHotbar(inv: Inventory, index: number, item: ItemId | null): Inventory {
  if (!Number.isInteger(index) || index < 0 || index > 3) return inv
  if (item !== null && !inv.slots.some((s) => s.item === item)) return inv
  const hotbar = inv.hotbar.map((h) =>
    item !== null && h === item ? null : h,
  ) as Inventory['hotbar']
  hotbar[index] = item
  return { ...inv, hotbar }
}

// ---------------------------------------------------------------------------

function isRelic(id: ItemId): id is RelicId {
  return ITEM_MAP[id].kind === 'relic'
}

function isKeyItem(id: ItemId): id is KeyItemId {
  const kind = ITEM_MAP[id].kind
  return kind === 'key' || kind === 'lore'
}

function result(
  inv: Inventory,
  added: number,
  rejected: number,
  reason: AddRefusal | null,
  name: string,
): AddResult {
  const message =
    reason === 'stack-full'
      ? `Satchel full: ${name}`
      : reason === 'satchel-full'
        ? 'Satchel full'
        : null
  return { inv, added, rejected, reason, message }
}
