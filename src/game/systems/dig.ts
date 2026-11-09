// Grave digging — pure TypeScript, fixed-dt.
//
// Hold Interact on a disturbed grave with a shovel for DIG_DURATION_S. Moving,
// being hit, letting go or losing the target cancels with no loot. A dug grave
// stays closed until the day counter changes. The hand-from-grave roll is only
// reported in the event; the scare director (spec 05) decides how to stage it.

import {
  DEFAULT_GRAVE_LOOT_TABLE,
  DIG_DURATION_S,
  DIG_HAND_SCARE_CHANCE_DAY,
  DIG_HAND_SCARE_CHANCE_NIGHT,
  DIG_MOVE_TOLERANCE_M,
  DIG_SCARE_ID,
} from '../../data/digging'
import { LOOT_TABLE_MAP, type LootTableId } from '../../data/lootTables'
import type { GameEvent, ItemId, Phase } from '../types'
import type { Rng } from '../rng'
import { rollLoot } from './loot'

export type DigEvent = Extract<GameEvent, { type: 'digCompleted' | 'digCancelled' }>

export interface DigState {
  /** Grave currently being dug, or null when idle. */
  graveId: string | null
  /** Seconds dug so far. */
  progress: number
  /** Player x/z when the dig began; used to detect movement. */
  origin: readonly [number, number] | null
  /** Grave id → day number on which it was last dug. */
  dugOnDay: Readonly<Record<string, number>>
}

export interface DigTarget {
  id: string
  lootTable?: LootTableId
}

export interface DigInput {
  /** Interact key is held this tick. */
  interactHeld: boolean
  /** Disturbed grave under the crosshair within range, or null. */
  target: DigTarget | null
  /** Item currently equipped. */
  equipped: ItemId | null
  /** Player world position [x, y, z]. */
  position: readonly [number, number, number]
  /** Player took damage this tick. */
  hit: boolean
  /** Current day number (increments each dawn). */
  day: number
  phase: Phase
  rng: Rng
  /** Dig time in seconds (Gravedigger shortens it). Defaults to DIG_DURATION_S. */
  durationS?: number
}

export interface DigResult {
  state: DigState
  events: DigEvent[]
}

export function createDigState(): DigState {
  return { graveId: null, progress: 0, origin: null, dugOnDay: {} }
}

export function hasShovel(equipped: ItemId | null): boolean {
  return equipped === 'rusty-shovel' || equipped === 'sharpened-shovel'
}

export function canDig(state: DigState, graveId: string, day: number): boolean {
  return state.dugOnDay[graveId] !== day
}

/** 0–1 progress for the HUD ring. */
export function digProgress(state: DigState, durationS: number = DIG_DURATION_S): number {
  return Math.min(1, state.progress / durationS)
}

export function handScareChance(phase: Phase): number {
  return phase === 'night' ? DIG_HAND_SCARE_CHANCE_NIGHT : DIG_HAND_SCARE_CHANCE_DAY
}

function cancel(
  state: DigState,
  reason: Extract<DigEvent, { type: 'digCancelled' }>['reason'],
): DigResult {
  const events: DigEvent[] =
    state.graveId === null ? [] : [{ type: 'digCancelled', graveId: state.graveId, reason }]
  return { state: { ...state, graveId: null, progress: 0, origin: null }, events }
}

export function tickDig(state: DigState, dt: number, input: DigInput): DigResult {
  const { target } = input
  const digging = state.graveId !== null

  if (digging) {
    // Priority: a hit is the most specific cause, then movement, then input loss.
    if (input.hit) return cancel(state, 'hit')
    const [ox, oz] = state.origin ?? [input.position[0], input.position[2]]
    if (Math.hypot(input.position[0] - ox, input.position[2] - oz) > DIG_MOVE_TOLERANCE_M) {
      return cancel(state, 'moved')
    }
    if (!input.interactHeld) return cancel(state, 'released')
    if (!target || target.id !== state.graveId || !hasShovel(input.equipped)) {
      return cancel(state, 'interrupted')
    }

    const progress = state.progress + dt
    const duration = input.durationS ?? DIG_DURATION_S
    // Epsilon absorbs float drift from summing 1/60 s steps.
    if (progress < duration - 1e-9) return { state: { ...state, progress }, events: [] }

    const table = LOOT_TABLE_MAP[target.lootTable ?? DEFAULT_GRAVE_LOOT_TABLE]
    const loot = rollLoot(table, input.rng)
    const scareId = input.rng() < handScareChance(input.phase) ? DIG_SCARE_ID : null
    return {
      state: {
        graveId: null,
        progress: 0,
        origin: null,
        dugOnDay: { ...state.dugOnDay, [target.id]: input.day },
      },
      events: [{ type: 'digCompleted', graveId: target.id, loot, scareId }],
    }
  }

  // Idle: start only on a fresh press of a diggable grave with a shovel.
  if (
    input.interactHeld &&
    !input.hit &&
    target &&
    hasShovel(input.equipped) &&
    canDig(state, target.id, input.day)
  ) {
    return {
      state: {
        ...state,
        graveId: target.id,
        progress: dt, // the starting tick counts, so 3 s of holding = 3 s of digging
        origin: [input.position[0], input.position[2]],
      },
      events: [],
    }
  }
  return { state, events: [] }
}
