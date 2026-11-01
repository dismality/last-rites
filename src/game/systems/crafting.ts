// Crafting system — pure TypeScript, no React / three.js / Howler.
//
// Responsibilities:
//  - canCraft: check whether inventory has all inputs for a recipe
//  - craft: atomically consume inputs and add output (checks capacity first)
//  - unlockRecipes: determine which recipes become available after game events
//
// The 1.5 s animation timer lives in the scene layer (Req 3.1).

import type { Inventory, ItemId, ItemStack, RecipeId } from '../types'
import type { RecipeDef } from '../../data/recipes'
import { RECIPES } from '../../data/recipes'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of satchel slots. */
export const SATCHEL_SLOTS = 12

/** Maximum stack size for material items. */
export const MATERIAL_STACK_LIMIT = 10

/**
 * Item IDs that don't use satchel slots (key items & relics are tracked
 * separately on the Inventory; this list is used by the slot-count logic to
 * ignore them if they somehow appear in slots).
 */
const NO_SLOT_PREFIXES: readonly string[] = [
  'rusted-crypt-key',
  'bone-whistle',
  'iron-ossuary-key',
  'parish-ledger',
  'journal-page-',
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

function usesSlot(item: ItemId): boolean {
  return !NO_SLOT_PREFIXES.some((prefix) => item.startsWith(prefix))
}

// ---------------------------------------------------------------------------
// canCraft
// ---------------------------------------------------------------------------

export interface CanCraftResult {
  ok: boolean
  /** Items the player is missing (only populated when ok is false). */
  missing: { item: ItemId; qty: number }[]
}

/**
 * Check whether `inv` contains all the inputs required by `recipe`.
 * Also checks `consumesTool` when present.
 *
 * Does NOT check satchel capacity — that is done inside `craft`.
 */
export function canCraft(inv: Inventory, recipe: RecipeDef): CanCraftResult {
  const missing: { item: ItemId; qty: number }[] = []

  // Check regular inputs
  for (const req of recipe.inputs) {
    const have = countItem(inv, req.item)
    if (have < req.qty) {
      missing.push({ item: req.item, qty: req.qty - have })
    }
  }

  // Check tool consumption requirement
  if (recipe.consumesTool !== undefined) {
    const have = countItem(inv, recipe.consumesTool)
    if (have < 1) {
      missing.push({ item: recipe.consumesTool, qty: 1 })
    }
  }

  return { ok: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// craft (atomic)
// ---------------------------------------------------------------------------

export type CraftResult =
  | { ok: true; inv: Inventory }
  | { ok: false; error: 'missing-inputs' | 'no-capacity' }

/**
 * Attempt to craft `recipe` from `inv`.
 *
 * The craft is atomic: capacity is verified on a simulated inventory *before*
 * any mutation, so a failed craft never consumes anything.
 *
 * Rules (from design bible & Req 3.2, 3.4):
 * - If the player lacks any input, return `{ok:false, error:'missing-inputs'}`.
 * - Simulate removing inputs + consumesTool, then adding the output.
 * - If the simulated inventory would exceed 12 slots, return `{ok:false, error:'no-capacity'}`.
 * - Only if simulation succeeds, return a new inventory with the mutations applied.
 * - When `consumesTool` is present, the output replaces the tool in the same hotbar slot (Req 3.4).
 */
export function craft(inv: Inventory, recipe: RecipeDef): CraftResult {
  // --- Step 1: check inputs are available ---
  const check = canCraft(inv, recipe)
  if (!check.ok) {
    return { ok: false, error: 'missing-inputs' }
  }

  // --- Step 2: simulate on a deep copy ---
  let sim = deepCloneInventory(inv)

  // Remove all inputs from the simulation
  for (const req of recipe.inputs) {
    sim = removeItems(sim, req.item, req.qty)
  }

  // Remove the consumed tool from the simulation
  if (recipe.consumesTool !== undefined) {
    sim = removeItems(sim, recipe.consumesTool, 1)
  }

  // Add the output to the simulation
  const addResult = addItem(sim, recipe.output.item, recipe.output.qty)
  if (!addResult.ok) {
    // Output doesn't fit
    return { ok: false, error: 'no-capacity' }
  }
  sim = addResult.inv

  // --- Step 3: fix up hotbar slot when a tool is replaced ---
  if (recipe.consumesTool !== undefined) {
    sim = transferHotbarSlot(inv, sim, recipe.consumesTool, recipe.output.item)
  }

  return { ok: true, inv: sim }
}

// ---------------------------------------------------------------------------
// unlockRecipes
// ---------------------------------------------------------------------------

export type UnlockEvent =
  | { type: 'gameStart' }
  | { type: 'dawnStarted'; night: 1 | 2 | 3 | 4 }
  | { type: 'journalRead'; page: number }

/**
 * Return the subset of recipe IDs that become unlocked by `event`.
 * Pure function — does not mutate state; the caller stores the result.
 */
export function unlockRecipes(event: UnlockEvent): RecipeId[] {
  return RECIPES.filter((r) => {
    switch (event.type) {
      case 'gameStart':
        return r.unlock.type === 'start'
      case 'dawnStarted':
        return r.unlock.type === 'night' && r.unlock.night === event.night
      case 'journalRead':
        return r.unlock.type === 'journal' && r.unlock.page === event.page
    }
  }).map((r) => r.id)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Count how many of `item` are in the inventory slots. */
function countItem(inv: Inventory, item: ItemId): number {
  return inv.slots
    .filter((s) => s.item === item)
    .reduce((acc, s) => acc + s.qty, 0)
}

/**
 * Remove `qty` of `item` from inventory slots (LIFO order — empties partial
 * stacks first). Returns a new inventory; does not mutate the original.
 *
 * Assumes the caller already verified enough quantity exists.
 */
function removeItems(inv: Inventory, item: ItemId, qty: number): Inventory {
  let remaining = qty
  const newSlots: ItemStack[] = []

  for (const slot of inv.slots) {
    if (slot.item !== item || remaining === 0) {
      newSlots.push({ ...slot })
    } else {
      // Consume from this slot
      const take = Math.min(slot.qty, remaining)
      remaining -= take
      const leftover = slot.qty - take
      if (leftover > 0) {
        newSlots.push({ item: slot.item, qty: leftover })
      }
      // If leftover === 0, the slot is consumed and not pushed
    }
  }

  return { ...inv, slots: newSlots }
}

interface AddResult {
  ok: boolean
  inv: Inventory
}

/**
 * Add `qty` of `item` to inventory slots.
 *
 * Rules:
 * - If the item already has a stack with room (< MATERIAL_STACK_LIMIT), fill it.
 * - Otherwise open a new slot if fewer than SATCHEL_SLOTS are occupied.
 * - Returns `{ok:false}` if there is no room.
 */
function addItem(inv: Inventory, item: ItemId, qty: number): AddResult {
  if (!usesSlot(item)) {
    // Key items and relics never go into slots (they have dedicated arrays).
    // For crafting purposes we treat this as always succeeding at the slot level.
    return { ok: true, inv }
  }

  let remaining = qty
  const newSlots: ItemStack[] = inv.slots.map((s) => ({ ...s }))

  // Try to fill existing stacks first
  for (const slot of newSlots) {
    if (remaining === 0) break
    if (slot.item !== item) continue
    const room = MATERIAL_STACK_LIMIT - slot.qty
    if (room <= 0) continue
    const add = Math.min(room, remaining)
    slot.qty += add
    remaining -= add
  }

  // Open new slots for the remainder
  while (remaining > 0) {
    if (newSlots.filter((s) => usesSlot(s.item)).length >= SATCHEL_SLOTS) {
      // No room
      return { ok: false, inv }
    }
    const add = Math.min(MATERIAL_STACK_LIMIT, remaining)
    newSlots.push({ item, qty: add })
    remaining -= add
  }

  return { ok: true, inv: { ...inv, slots: newSlots } }
}

/**
 * When `consumesTool` is consumed and replaced by `outputItem`, find the
 * hotbar slot that held `consumesTool` (if any) and rebind it to `outputItem`.
 *
 * Reads the *original* inventory for the slot binding; writes into `next`.
 */
function transferHotbarSlot(
  original: Inventory,
  next: Inventory,
  consumedTool: ItemId,
  outputItem: ItemId,
): Inventory {
  const hotbar = [...next.hotbar] as Inventory['hotbar']
  for (let i = 0; i < 4; i++) {
    if (original.hotbar[i] === consumedTool) {
      hotbar[i] = outputItem
    }
  }
  return { ...next, hotbar }
}

/** Deep clone an inventory (simple objects + arrays — no class instances). */
function deepCloneInventory(inv: Inventory): Inventory {
  return {
    slots: inv.slots.map((s) => ({ ...s })),
    keyItems: [...inv.keyItems],
    relics: [...inv.relics],
    hotbar: [...inv.hotbar] as Inventory['hotbar'],
  }
}
