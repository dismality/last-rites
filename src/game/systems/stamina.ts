// Pure stamina logic: sprint drains, regen resumes after a short delay.

import {
  STAMINA_DRAIN_PER_S,
  STAMINA_MAX,
  STAMINA_REGEN_DELAY_S,
  STAMINA_REGEN_PER_S,
} from '../../data/balance'
import type { StaminaState } from '../types'

const clamp = (v: number) => Math.min(STAMINA_MAX, Math.max(0, v))

export function tickStamina(s: StaminaState, dt: number, sprinting: boolean): StaminaState {
  const step = Math.max(0, dt)
  if (sprinting) {
    return {
      stamina: clamp(s.stamina - STAMINA_DRAIN_PER_S * step),
      regenDelayTimer: STAMINA_REGEN_DELAY_S,
    }
  }
  // Spend the delay first; only the leftover time regenerates (keeps results step-independent).
  const waited = Math.min(step, s.regenDelayTimer)
  const regenTime = step - waited
  return {
    stamina: clamp(s.stamina + STAMINA_REGEN_PER_S * regenTime),
    regenDelayTimer: s.regenDelayTimer - waited,
  }
}
