// Stamina by stage and difficulty (spec 10 task 9, Req 26, E9). Rules in systems/staminaCap.ts.

import type { ModeId } from '../game/types'

/** Max stamina per Story stage: the later stages tire the keeper sooner. Endless keeps 100. */
export const STAMINA_STAGE_CAPS = { 1: 100, 2: 90, 3: 80 } as const

/** Endless (and anything without a stage) uses this cap. */
export const STAMINA_ENDLESS_CAP = 100

/** Sprint drain multiplier per difficulty. Short Vigil plays on Normal's modifiers. */
export const STAMINA_DRAIN_BY_MODE: Readonly<Record<ModeId, number>> = {
  easy: 0.8,
  normal: 1,
  hard: 1.2,
  'short-vigil': 1,
  endless: 1,
}
