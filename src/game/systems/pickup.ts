// Material pickup rule — pure TypeScript.
//
// Scene code calls `pickupMaterial` and applies the returned inventory/world;
// it never decides acceptance itself. A refused pickup leaves the stack in the
// world untouched (Req 2.4).

import { ITEM_MAP } from '../../data/items'
import type { Inventory } from '../types'
import type { SpawnWorld } from './spawns'
import { addItem } from './inventory'

export interface PickupResult {
  inv: Inventory
  world: SpawnWorld
  /** Quantity moved into the satchel. */
  added: number
  /** Parchment toast text: "+2 Bone", "Satchel full: Bone" or "Satchel full". */
  toast: string
}

export function pickupMaterial(
  inv: Inventory,
  world: SpawnWorld,
  spawnId: string,
  index: number,
): PickupResult | null {
  const stack = world.materials[spawnId]?.[index]
  if (!stack) return null

  const res = addItem(inv, stack.item, stack.qty)
  if (res.added === 0) {
    // Refused: world and inventory stay exactly as they were.
    return { inv, world, added: 0, toast: res.message ?? 'Satchel full' }
  }

  // Partial pickups leave the remainder lying there; a full one removes the stack.
  const stacks = world.materials[spawnId]
  const next =
    res.rejected > 0
      ? stacks.map((s, i) => (i === index ? { ...s, qty: res.rejected } : s))
      : stacks.filter((_, i) => i !== index)
  return {
    inv: res.inv,
    world: { ...world, materials: { ...world.materials, [spawnId]: next } },
    added: res.added,
    toast: `+${res.added} ${ITEM_MAP[stack.item].name}`,
  }
}
