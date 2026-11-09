// Satchel rules — pure TypeScript, no React / three.js / Howler.
//
// Dropping puts a whole stack on the ground in front of the player; picking it
// up again goes through addItem, so a full satchel leaves the drop lying there.

import { ITEM_MAP, usesSatchelSlot } from '../../data/items'
import type { Inventory, ItemId } from '../types'
import { addItem, countItem, removeItem } from './inventory'

export type Vec3 = [number, number, number]

/** How far in front of the player a dropped stack lands (metres). Inside the 2.5 m interact range. */
export const DROP_DISTANCE = 1.2

export interface WorldDrop {
  id: string
  item: ItemId
  qty: number
  position: Vec3
}

/** Ground point in front of the player. Yaw 0 looks down -Z (see movement.ts). */
export function dropPosition(feet: Vec3, yaw: number, distance = DROP_DISTANCE): Vec3 {
  return [feet[0] - Math.sin(yaw) * distance, feet[1], feet[2] - Math.cos(yaw) * distance]
}

export interface DropResult {
  inv: Inventory
  drop: WorldDrop | null
}

/** Removes the entire stack of `item` and returns it as a world drop. Unknown or key items are refused. */
export function dropStack(inv: Inventory, item: ItemId, at: Vec3, id: string): DropResult {
  if (!usesSatchelSlot(ITEM_MAP[item].kind)) return { inv, drop: null }
  const qty = countItem(inv, item)
  if (qty === 0) return { inv, drop: null }
  const res = removeItem(inv, item, qty)
  return { inv: res.inv, drop: { id, item, qty: res.removed, position: at } }
}

export interface DropPickupResult {
  inv: Inventory
  /** What is left lying on the ground, or null when everything was taken. */
  remaining: WorldDrop | null
  added: number
}

export function pickupDrop(inv: Inventory, drop: WorldDrop): DropPickupResult {
  const res = addItem(inv, drop.item, drop.qty)
  if (res.added === 0) return { inv, remaining: drop, added: 0 }
  return {
    inv: res.inv,
    remaining: res.rejected > 0 ? { ...drop, qty: res.rejected } : null,
    added: res.added,
  }
}

/** The item a hotbar number key equips, or null if that slot is empty or its item is gone. */
export function hotbarItem(inv: Inventory, slot: number): ItemId | null {
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) return null
  const item = inv.hotbar[slot]
  return item !== null && inv.slots.some((s) => s.item === item) ? item : null
}

/** Hotbar slot (0–3) an item is bound to, or null. */
export function hotbarSlotOf(inv: Inventory, item: ItemId): number | null {
  const i = inv.hotbar.indexOf(item)
  return i === -1 ? null : i
}

/** Next filled hotbar slot from `from` in direction `dir` (+1 or -1), wrapping. Null when none other is filled. */
export function cycleHotbarSlot(inv: Inventory, from: number | null, dir: 1 | -1): 0 | 1 | 2 | 3 | null {
  const start = from ?? (dir === 1 ? -1 : 4)
  for (let step = 1; step <= 4; step++) {
    const slot = (((start + dir * step) % 4) + 4) % 4
    if (slot !== from && hotbarItem(inv, slot)) return slot as 0 | 1 | 2 | 3
  }
  return null
}
