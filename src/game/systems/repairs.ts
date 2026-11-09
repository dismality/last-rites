// Repair system — pure TypeScript, no React / three.js / Howler.
//
// Responsibilities:
//  - canRepair: check the next chapel stage and whether the player can afford it
//  - repair: atomically consume materials and advance chapel state
//
// Stages must be completed in order 1→2→3 (Req 6.3).
// The repair is atomic: simulate removal before committing, same pattern as craft().

import type { Inventory, ItemId, ItemStack } from '../types'
import type { RepairEffect, RepairStage } from '../../data/repairs'
import { REPAIR_STAGES } from '../../data/repairs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChapelState {
  /** Effects of completed stages, in order. */
  completedStages: RepairEffect[]
  /** Reset to false each dawn (Req 6.5). */
  altarHealedToday: boolean
  /** Disables the door-block check during the final rite (Req 6.4). */
  finalRiteActive: boolean
}

export interface CanRepairResult {
  ok: boolean
  /** The stage that would be applied next, or null when all three are done. */
  nextStage: RepairStage | null
  /** Items the player is short of. Empty when ok is true or all complete. */
  missing: { item: ItemId; qty: number }[]
}

export type RepairResult =
  | { ok: true; inv: Inventory; chapel: ChapelState }
  | { ok: false; error: 'all-complete' | 'missing-materials' | 'wrong-order' }

// ---------------------------------------------------------------------------
// canRepair
// ---------------------------------------------------------------------------

/**
 * Determine whether the player can perform the next repair on the chapel.
 *
 * - If all three stages are done → `{ ok: false, nextStage: null, missing: [] }`.
 * - Otherwise, identify stage N+1 (where N = completedStages.length) and
 *   compare the player's inventory against its cost.
 */
export function canRepair(inv: Inventory, chapel: ChapelState): CanRepairResult {
  const nextStageIndex = chapel.completedStages.length
  if (nextStageIndex >= REPAIR_STAGES.length) {
    return { ok: false, nextStage: null, missing: [] }
  }

  const stage = REPAIR_STAGES[nextStageIndex]
  const missing = computeMissing(inv, stage.cost)

  return {
    ok: missing.length === 0,
    nextStage: stage,
    missing,
  }
}

// ---------------------------------------------------------------------------
// repair (atomic)
// ---------------------------------------------------------------------------

/**
 * Attempt to apply the next chapel repair stage.
 *
 * The operation is atomic: materials are simulated removed first.
 * On success a new `inv` and `chapel` are returned; nothing is mutated.
 *
 * Error codes:
 * - `all-complete`       — all three stages are already done
 * - `missing-materials`  — player cannot afford the next stage
 * - `wrong-order`        — guard for any future caller that skips stages
 */
export function repair(inv: Inventory, chapel: ChapelState): RepairResult {
  const nextStageIndex = chapel.completedStages.length

  if (nextStageIndex >= REPAIR_STAGES.length) {
    return { ok: false, error: 'all-complete' }
  }

  const stage = REPAIR_STAGES[nextStageIndex]

  // Verify the stage index matches the expected ordinal (defensive, Req 6.3).
  if (stage.stage !== nextStageIndex + 1) {
    return { ok: false, error: 'wrong-order' }
  }

  const missing = computeMissing(inv, stage.cost)
  if (missing.length > 0) {
    return { ok: false, error: 'missing-materials' }
  }

  // --- Simulate removal on a deep clone ---
  let simInv = deepCloneInventory(inv)
  for (const req of stage.cost) {
    simInv = removeItems(simInv, req.item, req.qty)
  }

  const newChapel: ChapelState = {
    ...chapel,
    completedStages: [...chapel.completedStages, stage.effect],
  }

  return { ok: true, inv: simInv, chapel: newChapel }
}

// ---------------------------------------------------------------------------
// Selectors (pure helpers used by the scene layer)
// ---------------------------------------------------------------------------

/**
 * True once stage 1 is done. Frames persist through the final rite; the rite
 * only doubles board damage elsewhere, so there is no rite exception here.
 */
export function isBarricadeBuilt(chapel: ChapelState): boolean {
  return chapel.completedStages.includes('barDoor')
}

/** True when stage 2 is done (Req 6.5). */
export function isAltarActive(chapel: ChapelState): boolean {
  return chapel.completedStages.includes('altarSave')
}

/** True when stage 3 is done (Req 6.6). */
export function isBellActive(chapel: ChapelState): boolean {
  return chapel.completedStages.includes('bellWarning')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeMissing(
  inv: Inventory,
  cost: ItemStack[],
): { item: ItemId; qty: number }[] {
  const missing: { item: ItemId; qty: number }[] = []
  for (const req of cost) {
    const have = countItem(inv, req.item)
    if (have < req.qty) {
      missing.push({ item: req.item, qty: req.qty - have })
    }
  }
  return missing
}

function countItem(inv: Inventory, item: ItemId): number {
  return inv.slots
    .filter((s) => s.item === item)
    .reduce((acc, s) => acc + s.qty, 0)
}

function removeItems(inv: Inventory, item: ItemId, qty: number): Inventory {
  let remaining = qty
  const newSlots: ItemStack[] = []

  for (const slot of inv.slots) {
    if (slot.item !== item || remaining === 0) {
      newSlots.push({ ...slot })
    } else {
      const take = Math.min(slot.qty, remaining)
      remaining -= take
      const leftover = slot.qty - take
      if (leftover > 0) {
        newSlots.push({ item: slot.item, qty: leftover })
      }
    }
  }

  return { ...inv, slots: newSlots }
}

function deepCloneInventory(inv: Inventory): Inventory {
  return {
    slots: inv.slots.map((s) => ({ ...s })),
    keyItems: [...inv.keyItems],
    relics: [...inv.relics],
    hotbar: [...inv.hotbar] as Inventory['hotbar'],
  }
}
