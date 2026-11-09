// Stamina runtime: owns the regen delay timer (sim-internal, not worth a store) and is the
// single place that spends stamina, so a spend can never be undone by the next tick.
// Requirements 9.1, 9.4, 9.10, 12.2.

import { spendStamina as spendPure } from '../systems/stamina'
import type { StaminaState } from '../types'
import { usePlayerStore } from './playerStore'

let regenDelayTimer = 0
let sprintDrainMult = 1

/** Snapshot for the tick: stamina from the store, delay from the runtime. */
export function readStamina(): StaminaState {
  return { stamina: usePlayerStore.getState().stamina, regenDelayTimer }
}

/** Called by the tick driver after each tick with the delay the tick produced. */
export function writeRegenDelay(timer: number): void {
  regenDelayTimer = timer
}

export function getRegenDelay(): number {
  return regenDelayTimer
}

/** Adrenaline sets 0.5 here; 1 is normal. */
export function setSprintDrainMult(mult: number): void {
  sprintDrainMult = Number.isFinite(mult) && mult >= 0 ? mult : 1
}

export function getSprintDrainMult(): number {
  return sprintDrainMult
}

/** Pays a cost: writes the store and re-arms the regen delay. False when too tired. */
export function spendStamina(cost: number): boolean {
  const r = spendPure(readStamina(), cost)
  if (!r.ok) return false
  usePlayerStore.getState().setStamina(r.state.stamina)
  regenDelayTimer = r.state.regenDelayTimer
  return true
}

export function resetStaminaRuntime(): void {
  regenDelayTimer = 0
  sprintDrainMult = 1
}
