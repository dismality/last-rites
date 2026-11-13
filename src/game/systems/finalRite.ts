// Final rite rules (design bible §1 and §8): when it can start, how it advances, which
// ending it produces. Pure TypeScript; the scene feeds it positions and input.

import { STAGE_COUNT } from '../../data/stages'
import type { EndingId, Phase, RelicId } from '../types'
import { chooseEnding, isRiteComplete, RITE_DURATION, tickRite, type MysteryState } from './mystery'

/** Fewest relics that let the rite be attempted at all (Req 5.2). */
export const RITE_MIN_RELICS = 3

/** How close to the altar the player must stand to perform the rite (metres). */
export const RITE_ALTAR_RANGE = 2.5

/**
 * - unavailable: nothing to do yet
 * - ready: the player may hold Interact at the altar
 * - taken: night 5 is over and too few relics were found (Req 5.5)
 */
export type RiteAvailability = 'unavailable' | 'ready' | 'taken'

export interface RiteContext {
  nightNumber: number
  phase: Phase
  /** All night-5 waves cleared. */
  wavesCleared: boolean
  relicCount: number
  /** The night the rite is held on. Story: the last stage; Endless passes Infinity (no rite). */
  finalNight?: number
}

export function riteAvailability(ctx: RiteContext): RiteAvailability {
  if (ctx.nightNumber !== (ctx.finalNight ?? STAGE_COUNT) || ctx.phase !== 'night') return 'unavailable'
  // Three relics are enough to start even mid-wave (Req 5.2).
  if (ctx.relicCount >= RITE_MIN_RELICS) return 'ready'
  return ctx.wavesCleared ? 'taken' : 'unavailable'
}

/** Distinct relics held, counting the satchel and the mystery record once each. */
export function countRelics(
  inventoryRelics: readonly RelicId[],
  mysteryRelics: ReadonlySet<RelicId>,
): number {
  return new Set<RelicId>([...inventoryRelics, ...mysteryRelics]).size
}

export interface HoldContext {
  availability: RiteAvailability
  nearAltar: boolean
  interactHeld: boolean
  /** A menu, journal or pause is open. */
  blocked: boolean
}

/** Releasing, walking away or opening a menu pauses the rite without resetting it (Req 5.3). */
export function isHoldingRite(c: HoldContext): boolean {
  return c.availability === 'ready' && c.nearAltar && c.interactHeld && !c.blocked
}

export interface RiteStep {
  mystery: MysteryState
  /** True on the step that completes the rite. */
  completed: boolean
}

/** Advances the rite and picks the ending the moment it completes (Req 5.4). */
export function stepRite(
  mystery: MysteryState,
  dt: number,
  holding: boolean,
  relicCount: number,
  capS: number = RITE_DURATION,
): RiteStep {
  if (mystery.ending) return { mystery, completed: false }
  const ticked = tickRite(mystery, dt, holding)
  // A lower cap (Father Crane alive) holds progress back, but never takes earned progress away.
  const next =
    ticked.riteProgress > capS
      ? { ...ticked, riteProgress: Math.max(mystery.riteProgress, capS) }
      : ticked
  if (!isRiteComplete(next)) return { mystery: next, completed: false }
  const ending: EndingId = chooseEnding(relicCount)
  return { mystery: { ...next, ending }, completed: true }
}
