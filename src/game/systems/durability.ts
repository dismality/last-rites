// Durability system — pure TypeScript, no React / three.js / Howler.
//
// Tracks per-weapon-instance durability and processes a single hit.
//
// Design bible §4:
//   bone-club        → 30 hits
//   sharpened-shovel → 50 hits
//   All others       → null (infinite) or single-use (handled outside this system)
//
// Requirements 5.1 – 5.3.

import type { CraftedItemId } from '../types'
import { WEAPON_MAP } from '../../data/weapons'

// ---------------------------------------------------------------------------
// WeaponState
// ---------------------------------------------------------------------------

/**
 * Runtime state for a single equipped weapon instance.
 *
 * `durability` mirrors the design-bible max when the weapon is first equipped
 * and decrements by 1 per melee hit.  `null` means the weapon has infinite
 * durability (rusty-shovel, thrown / placed items).
 */
export interface WeaponState {
  /** The item ID identifying which weapon this is. */
  id: CraftedItemId
  /**
   * Remaining hit capacity.
   * - null  → indestructible (no limit)
   * - 0     → broken (caller should remove and swap to rusty-shovel)
   * - 1..n  → working
   */
  durability: number | null
}

// ---------------------------------------------------------------------------
// applyHit
// ---------------------------------------------------------------------------

export interface HitResult {
  /** Updated weapon state after the hit. */
  weaponState: WeaponState
  /**
   * True exactly when durability just transitioned from 1 → 0 on this hit.
   * The caller should play a break sound, remove the item and equip rusty-shovel
   * when this is true.
   */
  broke: boolean
}

/**
 * Apply one melee hit to the weapon, reducing durability by 1.
 *
 * Rules:
 * - Infinite-durability weapons (durability === null) are returned unchanged.
 * - Durability never goes below 0 (already-broken weapons are returned as-is).
 * - `broke` is true only when this specific call causes durability to reach 0.
 */
export function applyHit(weaponState: WeaponState): HitResult {
  const { durability } = weaponState

  // Indestructible weapon — nothing changes.
  if (durability === null) {
    return { weaponState, broke: false }
  }

  // Already broken — guard against double-break; durability stays at 0.
  if (durability <= 0) {
    return { weaponState: { ...weaponState, durability: 0 }, broke: false }
  }

  const next = durability - 1
  return {
    weaponState: { ...weaponState, durability: next },
    broke: next === 0,
  }
}

// ---------------------------------------------------------------------------
// createWeaponState
// ---------------------------------------------------------------------------

/**
 * Construct a fresh WeaponState for `id` by reading the design-bible max
 * durability from WEAPON_MAP.
 *
 * Single-use items (durability: 1 in weapons.ts) are NOT tracked here — they
 * are removed from inventory on use.  This helper is intended for melee weapons
 * (bone-club, sharpened-shovel) and the rusty-shovel (infinite).
 */
export function createWeaponState(id: CraftedItemId): WeaponState {
  const def = WEAPON_MAP[id]
  return { id, durability: def.durability }
}

// ---------------------------------------------------------------------------
// isCracked
// ---------------------------------------------------------------------------

/**
 * Return true when the weapon's durability is under 20% of its maximum —
 * the threshold at which the viewmodel shows crack decals (Req 5.3).
 *
 * Always false for infinite-durability weapons.
 */
export function isCracked(weaponState: WeaponState): boolean {
  const { durability, id } = weaponState
  if (durability === null) return false

  const def = WEAPON_MAP[id]
  const max = def.durability
  if (max === null || max === 0) return false

  return durability / max < 0.2
}
