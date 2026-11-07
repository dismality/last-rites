// One fixed simulation tick. Pure: takes a snapshot, returns the next one plus events.
// Order is fixed by spec: input -> stamina -> player -> lantern -> dayNight.

import type { GameEvent, LanternState, PlayerState, StaminaState, WorldState } from '../types'
import { tickDayNight } from './dayNight'
import { tickLantern } from './lantern'
import { tickStamina } from './stamina'

/** Input sampled once per tick (task 6 supplies the real source). */
export interface TickInput {
  sprinting: boolean
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
  const stamina = tickStamina(s.stamina, dt, sprinting)

  // Player movement is applied by the Rapier controller (task 6); only mirror stamina here.
  const player: PlayerState = { ...s.player, stamina: stamina.stamina }

  const lantern = tickLantern(s.lantern, dt, s.world.phase)

  const night = tickDayNight(s.world, dt, { wavesCleared: s.world.wavesCleared })
  events.push(...night.events)

  return { player, stamina, lantern, world: night.state, events }
}
