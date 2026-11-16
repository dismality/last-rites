// Stamina cap and drain by stage and difficulty (spec 10 task 9, Req 26.1-26.4). Pure.
// The cap follows the stage, and the stage only ever moves forward in a run, so with the caps
// falling stage by stage the cap never rises (Property 22). The tick clamps stamina to it.

import { STAMINA_DRAIN_BY_MODE, STAMINA_ENDLESS_CAP, STAMINA_STAGE_CAPS } from '../../data/staminaCaps'
import type { ModeId } from '../types'

/** Max stamina for a Story stage, or 100 outside the story (Endless). */
export function staminaCap(stage: 1 | 2 | 3, story: boolean): number {
  return story ? STAMINA_STAGE_CAPS[stage] : STAMINA_ENDLESS_CAP
}

/** Sprint drain multiplier for the difficulty (Easy 0.8, Normal 1, Hard 1.2, Endless 1). */
export function staminaDrainMult(mode: ModeId): number {
  return STAMINA_DRAIN_BY_MODE[mode]
}

/** Current stamina held within the cap (Req 26.3): a shrinking cap lowers it at once. */
export function clampToCap(stamina: number, cap: number): number {
  if (!Number.isFinite(stamina)) return 0
  return Math.min(cap, Math.max(0, stamina))
}

/** Fill of the stamina bar within its own length, 0..1. */
export function capFraction(stamina: number, cap: number): number {
  return cap > 0 ? clampToCap(stamina, cap) / cap : 0
}
