// Pure player health rules: blocking, damage, death. No React / three.js.

import {
  BLOCK_DAMAGE_REDUCTION,
  BLOCK_MOVE_MULT,
  LOW_HEALTH_THRESHOLD,
  PLAYER_MAX_HEALTH,
} from '../../data/balance'

export interface DamageResult {
  /** HP after the hit, clamped to 0..max. */
  health: number
  /** HP actually removed (after block reduction and clamping). */
  dealt: number
  /** True when this hit brought health to 0. */
  died: boolean
}

/** Damage after the block reduction; negative or NaN input counts as 0. */
export function mitigatedDamage(dmg: number, blocking: boolean): number {
  const raw = Number.isFinite(dmg) ? Math.max(0, dmg) : 0
  return blocking ? raw * (1 - BLOCK_DAMAGE_REDUCTION) : raw
}

export function damagePlayer(health: number, dmg: number, blocking: boolean): DamageResult {
  const before = Math.min(PLAYER_MAX_HEALTH, Math.max(0, health))
  const after = Math.max(0, before - mitigatedDamage(dmg, blocking))
  return { health: after, dealt: before - after, died: before > 0 && after <= 0 }
}

export function isDead(health: number): boolean {
  return health <= 0
}

export function isLowHealth(health: number): boolean {
  return health < LOW_HEALTH_THRESHOLD
}

/** Movement speed multiplier: blocking halves speed. */
export function blockMoveMultiplier(blocking: boolean): number {
  return blocking ? BLOCK_MOVE_MULT : 1
}
