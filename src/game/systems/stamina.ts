// Pure stamina logic: sprint drains, regen resumes after a short delay.

import {
  STAMINA_DRAIN_PER_S,
  STAMINA_MAX,
  STAMINA_REGEN_DELAY_S,
  STAMINA_REGEN_PER_S,
} from '../../data/balance'
import type { StaminaState } from '../types'

const clamp = (v: number) => Math.min(STAMINA_MAX, Math.max(0, v))

const safe = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0)

/**
 * Pays a stamina cost. Refuses (state unchanged) when the player has less than the cost.
 * A spend re-arms the regen delay so regeneration does not undo it at once.
 */
export function spendStamina(
  s: StaminaState,
  cost: number,
): { state: StaminaState; ok: boolean } {
  const c = safe(cost)
  if (!(s.stamina >= c)) return { state: s, ok: false }
  return {
    state: { stamina: clamp(s.stamina - c), regenDelayTimer: STAMINA_REGEN_DELAY_S },
    ok: true,
  }
}

/** `drainMult` scales sprint drain only (Adrenaline halves it). */
export function tickStamina(
  s: StaminaState,
  dt: number,
  sprinting: boolean,
  drainMult = 1,
  /** Scales regeneration only (Second Wind upgrade). */
  regenMult = 1,
): StaminaState {
  const step = Math.max(0, dt)
  if (sprinting) {
    return {
      stamina: clamp(s.stamina - STAMINA_DRAIN_PER_S * safe(drainMult) * step),
      regenDelayTimer: STAMINA_REGEN_DELAY_S,
    }
  }
  // Spend the delay first; only the leftover time regenerates (keeps results step-independent).
  const waited = Math.min(step, s.regenDelayTimer)
  const regenTime = step - waited
  return {
    stamina: clamp(s.stamina + STAMINA_REGEN_PER_S * safe(regenMult) * regenTime),
    regenDelayTimer: s.regenDelayTimer - waited,
  }
}
