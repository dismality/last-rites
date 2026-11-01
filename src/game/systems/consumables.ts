// Consumables system â€” pure TypeScript, no React / three.js / Howler.
//
// Tracks the in-progress timed use of a consumable item (bandage, lantern-refill).
// The scene layer (or GameLoop) drives the clock by calling tickUse each fixed step.
// Effects are only applied when tickUse signals applied=true; cancelling before that
// produces no effect.
//
// Design bible Â§4 consumable specs:
//   bandage        â€” heals 30 HP, takes 2 s to apply
//   lantern-refill â€” restores +50% lantern fuel, takes null (instant in design bible
//                    but still runs through this system for the cancel-on-hit rule)
//
// Requirement 5.4.

import type { CraftedItemId } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The consumable items that go through a timed-use flow.
 * Thrown / placed items (single-use) are resolved by the combat layer instead.
 */
export type ConsumableId = 'bandage' | 'lantern-refill'

/**
 * Snapshot of an in-progress consumable use.  Created by `startUse`; updated
 * each tick; discarded on `cancelUse` or after `applied` fires.
 */
export interface ConsumableUseState {
  /** Which item is being used. */
  item: ConsumableId
  /** Total time in seconds required to complete the use. */
  duration: number
  /** Time elapsed so far in seconds (0 â†’ duration). */
  elapsed: number
}

// ---------------------------------------------------------------------------
// Effect descriptor
// ---------------------------------------------------------------------------

/**
 * The concrete effect that should be applied when the consumable completes.
 * The caller (store/scene layer) applies these to the relevant state.
 */
export interface ConsumableEffect {
  /** HP to add (bandage: 30, refill: 0). */
  healHp: number
  /** Lantern fuel to add as an absolute percentage points (refill: 50, bandage: 0). */
  addFuel: number
}

// ---------------------------------------------------------------------------
// Durations and effects
// ---------------------------------------------------------------------------

/**
 * Design-bible timing for each consumable.
 * Bandage: 2 s.  Lantern-refill has no listed use-time in the bible but we
 * keep it at a short 1 s so the cancel-on-hit rule still applies.
 */
const CONSUMABLE_DURATION: Record<ConsumableId, number> = {
  bandage: 2,
  'lantern-refill': 1,
}

const CONSUMABLE_EFFECT: Record<ConsumableId, ConsumableEffect> = {
  bandage: { healHp: 30, addFuel: 0 },
  'lantern-refill': { healHp: 0, addFuel: 50 },
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Begin using a consumable.  Returns the initial use-state with elapsed = 0.
 * Call this when the player activates the item.
 */
export function startUse(item: ConsumableId): ConsumableUseState {
  return {
    item,
    duration: CONSUMABLE_DURATION[item],
    elapsed: 0,
  }
}

// ---------------------------------------------------------------------------

export interface TickResult {
  /** Updated use-state (elapsed advanced by dt, clamped to duration). */
  state: ConsumableUseState
  /**
   * True exactly when the use just completed on this tick.
   * The caller should apply the effect, remove the item and clear the state.
   */
  applied: boolean
  /** The effect to apply when applied === true. Undefined otherwise. */
  effect: ConsumableEffect | undefined
}

/**
 * Advance the timed use by `dt` seconds (fixed timestep, 1/60 s).
 *
 * Returns:
 *   - `applied: false` while the timer is still running.
 *   - `applied: true` the single tick that pushes elapsed >= duration.
 *     Subsequent calls would no longer be called by the caller once it sees
 *     `applied: true`, but we guard elapsed at `duration` for safety.
 */
export function tickUse(dt: number, state: ConsumableUseState): TickResult {
  const newElapsed = Math.min(state.elapsed + dt, state.duration)
  const updated: ConsumableUseState = { ...state, elapsed: newElapsed }

  if (newElapsed >= state.duration) {
    return {
      state: updated,
      applied: true,
      effect: CONSUMABLE_EFFECT[state.item],
    }
  }

  return { state: updated, applied: false, effect: undefined }
}

// ---------------------------------------------------------------------------

/**
 * Cancel an in-progress use (e.g. the player was hit).
 * Returns `null` â€” the caller should discard the use-state entirely.
 * No effect is applied.
 */
export function cancelUse(state: ConsumableUseState): null {
  // Intentionally discard state — cancellation has no effect (Req 5.4).
  void state
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * True if the given item ID is a trackable consumable in this system.
 */
export function isConsumable(id: CraftedItemId): id is ConsumableId {
  return id === 'bandage' || id === 'lantern-refill'
}

/**
 * Progress fraction 0â€“1 for UI progress bars.
 */
export function useProgress(state: ConsumableUseState): number {
  if (state.duration <= 0) return 1
  return Math.min(state.elapsed / state.duration, 1)
}
