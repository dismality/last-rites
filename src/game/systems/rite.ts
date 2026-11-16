// The Rite as relic placement (spec 10 task 4.2, requirements 17.2-17.6). Pure rules: the altar
// has five slots, each takes one relic in the order of Crane's confession (`RITE_ORDER`). A relic
// in the wrong slot goes back to the satchel. Placed relics stay while Father Crane lives, and the
// rite completes only with all five in place and Crane fallen.

import type { RelicId } from '../types'

/** Relics placed so far, keyed by slot index (0 is the first relic of the rite). */
export interface RiteState {
  placed: Readonly<Partial<Record<number, RelicId>>>
}

export const EMPTY_RITE: RiteState = { placed: {} }

export type RiteOutcome =
  /** The relic sits in its slot. */
  | 'placed'
  /** Wrong relic for that slot: it returns to the satchel ("[a sour note from the altar]"). */
  | 'wrong'
  /** The slot is taken, or the slot or relic does not exist: nothing changes. */
  | 'refused'

export interface RiteResult {
  state: RiteState
  outcome: RiteOutcome
  /** True when this placement is the first relic to stay on the altar: the 10 s rising clock starts. */
  startsRisingClock: boolean
  /** The relic goes back to the satchel (only for a wrong placement). */
  returned?: RelicId
  /** All five are in order and Crane is not alive. */
  complete: boolean
}

/** Number of relics standing on the altar. */
export function placedCount(r: RiteState): number {
  return Object.keys(r.placed).length
}

/** True when every slot holds the relic the order names for it. */
export function allPlacedInOrder(r: RiteState, order: readonly RelicId[]): boolean {
  return order.length > 0 && order.every((relic, slot) => r.placed[slot] === relic)
}

/** The rite is complete only with all relics in order and Father Crane not alive (Req 17.4, 17.5). */
export function isRiteDone(r: RiteState, order: readonly RelicId[], craneAlive: boolean): boolean {
  return !craneAlive && allPlacedInOrder(r, order)
}

/**
 * Put `relic` in `slot`. A right relic stays and a wrong one is returned; neither ends the run.
 * The rising clock starts with the first relic that stays, so a wrong first try does not start it.
 */
export function placeRelic(
  r: RiteState,
  slot: number,
  relic: RelicId,
  order: readonly RelicId[],
  craneAlive: boolean,
): RiteResult {
  const unchanged = (outcome: RiteOutcome, returned?: RelicId): RiteResult => ({
    state: r,
    outcome,
    startsRisingClock: false,
    returned,
    complete: isRiteDone(r, order, craneAlive),
  })
  if (!Number.isInteger(slot) || slot < 0 || slot >= order.length) return unchanged('refused')
  if (r.placed[slot] !== undefined) return unchanged('refused')
  if (Object.values(r.placed).includes(relic)) return unchanged('refused')
  if (order[slot] !== relic) return unchanged('wrong', relic)
  const state: RiteState = { placed: { ...r.placed, [slot]: relic } }
  return {
    state,
    outcome: 'placed',
    startsRisingClock: placedCount(r) === 0,
    complete: isRiteDone(state, order, craneAlive),
  }
}
