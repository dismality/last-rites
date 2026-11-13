// Pure day/night cycle: Day -> Dusk -> Night (until waves cleared) -> Dawn -> Day.

import {
  DAWN_DURATION_S,
  DAY_DURATION_S,
  DUSK_DURATION_S,
  LAST_NIGHT,
  NIGHT_FOG_DENSITY,
} from '../../data/balance'
import { STAGE_COUNT, type StageNumber } from '../../data/stages'
import { stageFog } from './stageWaves'
import type { GameEvent, Phase, WorldState } from '../types'

export interface DayNightInput {
  /** Supplied by the wave system; night only ends when this is true. */
  wavesCleared: boolean
  /** Story stages: when set it replaces `wavesCleared` and the last night defaults to the last stage. */
  caseSolved?: boolean
  /** True while the dawn upgrade pick is pending; dawn then freezes. */
  holdDawn?: boolean
  /** Day length in seconds (Endless uses a shorter day). */
  dayLengthS?: number
  /** Highest night number; Endless passes Infinity. */
  lastNight?: number
  /** Story stages: wave index of the running night, so fog follows the ladder row (0.02 -> 0.03). */
  waveIndex?: number
}

export interface DayNightResult {
  state: WorldState
  events: GameEvent[]
}

/** Fog for a given night number, clamped so out-of-range input can't index past the table. */
export function fogForNight(nightNumber: number): number {
  const i = Math.min(Math.max(Math.floor(nightNumber), 1), LAST_NIGHT) - 1
  return NIGHT_FOG_DENSITY[i]
}

/** Fixed-length phases; night has no fixed length. */
function phaseDuration(phase: Phase, dayLengthS: number): number {
  switch (phase) {
    case 'day':
      return dayLengthS
    case 'dusk':
      return DUSK_DURATION_S
    case 'dawn':
      return DAWN_DURATION_S
    case 'night':
      return Infinity
  }
}

export function tickDayNight(s: WorldState, dt: number, input: DayNightInput): DayNightResult {
  const events: GameEvent[] = []
  let { phase, phaseTime, nightNumber } = s
  let remaining = Math.max(0, dt)
  const dayLengthS = input.dayLengthS ?? DAY_DURATION_S
  // Story stages (spec 10): the case-solved flag is the "waves cleared" flag, and stage 3 is last.
  const stageMode = input.caseSolved !== undefined
  const wavesCleared = stageMode ? input.caseSolved === true : input.wavesCleared
  const lastNight = input.lastNight ?? (stageMode ? STAGE_COUNT : LAST_NIGHT)

  // wavesCleared is left over from the previous night until nightStarted resets it. It must
  // never end a night on the tick that night begins, nor survive into the next day.
  let enteredNight = false

  const enter = (next: Phase) => {
    phase = next
    phaseTime = 0
    if (next === 'night') enteredNight = true
    events.push({ type: 'phaseChanged', phase })
    if (next === 'night') events.push({ type: 'nightStarted', nightNumber })
    if (next === 'dawn') events.push({ type: 'dawnStarted', nightNumber })
  }

  // Loop so a large dt can cross several boundaries without losing time.
  for (;;) {
    if (phase === 'night') {
      phaseTime += remaining
      if (wavesCleared && !enteredNight) enter('dawn')
      break
    }
    // A pending pick freezes dawn: no time passes and no event fires.
    if (phase === 'dawn' && input.holdDawn) break
    const left = phaseDuration(phase, dayLengthS) - phaseTime
    if (remaining < left) {
      phaseTime += remaining
      break
    }
    remaining -= left
    if (phase === 'day') enter('dusk')
    else if (phase === 'dusk') enter('night')
    else {
      // Increment only after dawn so the dawn summary still refers to the night just survived.
      nightNumber = Math.min(nightNumber + 1, lastNight)
      enter('day')
    }
  }

  return {
    state: {
      phase,
      phaseTime,
      nightNumber,
      fogDensity: stageMode
        ? stageFog(Math.min(Math.max(Math.floor(nightNumber), 1), STAGE_COUNT) as StageNumber, phase === 'night' ? (input.waveIndex ?? 0) : 0)
        : fogForNight(nightNumber),
      // Only a night in progress (or its dawn) can be "cleared"; day and dusk start fresh.
      wavesCleared: (phase === 'night' && !enteredNight) || phase === 'dawn' ? wavesCleared : false,
    },
    events,
  }
}
