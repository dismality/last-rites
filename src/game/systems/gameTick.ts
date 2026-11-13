// One fixed simulation tick. Pure: takes a snapshot, returns the next one plus events.
// Order is fixed by spec: input -> stamina -> player -> lantern -> dayNight.

import type { GameEvent, LanternState, PlayerState, StaminaState, WorldState } from '../types'
import { tickDayNight } from './dayNight'
import { tickLantern } from './lantern'
import { tickStamina } from './stamina'

/** Input sampled once per tick (task 6 supplies the real source). */
export interface TickInput {
  sprinting: boolean
  /** Scales sprint drain only; Adrenaline halves it. Defaults to 1. */
  sprintDrainMult?: number
  /** Second Wind; scales stamina regeneration. Defaults to 1. */
  regenMult?: number
  /** Mode x Long Wick x storm (lanternDrainMultiplier). Defaults to 1. */
  lanternDrainMult?: number
  /** A dawn upgrade pick is pending; dawn freezes. */
  holdDawn?: boolean
  /** Day length in seconds (Endless is shorter). */
  dayLengthS?: number
  /** Highest night number; Endless passes Infinity. */
  lastNight?: number
  /** Story stages: the case-solved flag ends the night. Unset in Endless. */
  caseSolved?: boolean
  /** Story stages: the current wave index, for the fog of the ladder row it draws from. */
  waveIndex?: number
}

export interface TickSnapshot {
  player: PlayerState
  stamina: StaminaState
  lantern: LanternState
  world: WorldState
}

export interface TickResult extends TickSnapshot {
  events: GameEvent[]
}

export function runTick(s: TickSnapshot, input: TickInput, dt: number): TickResult {
  const events: GameEvent[] = []

  // Sprinting needs stamina left, otherwise the player is forced to walk.
  const sprinting = input.sprinting && s.stamina.stamina > 0
  const stamina = tickStamina(s.stamina, dt, sprinting, input.sprintDrainMult ?? 1, input.regenMult ?? 1)

  // Player movement is applied by the Rapier controller (task 6); only mirror stamina here.
  const player: PlayerState = { ...s.player, stamina: stamina.stamina }

  const lantern = tickLantern(s.lantern, dt, s.world.phase, input.lanternDrainMult ?? 1)

  const night = tickDayNight(s.world, dt, {
    wavesCleared: s.world.wavesCleared,
    holdDawn: input.holdDawn,
    dayLengthS: input.dayLengthS,
    lastNight: input.lastNight,
    caseSolved: input.caseSolved,
    waveIndex: input.waveIndex,
  })
  events.push(...night.events)

  return { player, stamina, lantern, world: night.state, events }
}
