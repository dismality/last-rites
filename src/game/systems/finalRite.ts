// When the rite can be attempted (design bible §1, spec 10 Req 17). The 45 s Interact hold is
// gone: the rite is relic placement, whose rules live in rite.ts. Pure TypeScript.

import { STAGE_COUNT } from '../../data/stages'
import type { Phase, RelicId } from '../types'

/** How close to the altar the player must stand to place a relic (metres). */
export const RITE_ALTAR_RANGE = 2.5

/**
 * - unavailable: not the last stage's night
 * - ready: relics can be placed on the altar (the dead keep coming while the player does it)
 */
export type RiteAvailability = 'unavailable' | 'ready'

export interface RiteContext {
  nightNumber: number
  phase: Phase
  /** The night the rite is held on. Story: the last stage; Endless passes Infinity (no rite). */
  finalNight?: number
}

export function riteAvailability(ctx: RiteContext): RiteAvailability {
  return ctx.nightNumber === (ctx.finalNight ?? STAGE_COUNT) && ctx.phase === 'night' ? 'ready' : 'unavailable'
}

/** Distinct relics held, counting the satchel and the mystery record once each. */
export function countRelics(
  inventoryRelics: readonly RelicId[],
  mysteryRelics: ReadonlySet<RelicId>,
): number {
  return new Set<RelicId>([...inventoryRelics, ...mysteryRelics]).size
}
