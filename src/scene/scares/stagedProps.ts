// Animation state for the props the stager moves. The stager (ScareStager) writes it, the
// prop meshes (ScareProps) read it every frame. Plain mutable maps: no React state per frame.
import { SCARE_DOORS, SCARE_STAGING } from '../../data/scares'
import {
  DOOR_IDLE,
  STATUE_IDLE,
  type CandleState,
  type DoorState,
  type StatueState,
} from '../../game/systems/scareStaging'

export const stagedProps = {
  /** By zone id. */
  statues: new Map<string, StatueState>(),
  /** By index into SCARE_DOORS. */
  doors: new Map<number, DoorState>(),
  /** Telegraph length the open creak is spread across. */
  doorCreakLead: 1,
  /** By zone id. */
  candles: new Map<string, CandleState>(),
  hand: { age: Infinity, x: 0, z: 0 },
}

export function resetStagedProps(): void {
  stagedProps.statues.clear()
  stagedProps.doors.clear()
  stagedProps.candles.clear()
  stagedProps.hand.age = Infinity
  SCARE_DOORS.forEach((_d, i) => stagedProps.doors.set(i, DOOR_IDLE))
}

export function statueOf(zoneId: string): StatueState {
  return stagedProps.statues.get(zoneId) ?? STATUE_IDLE
}

/** True while the hand is visible (rising, holding, sinking back). */
export function handVisible(): boolean {
  return stagedProps.hand.age < SCARE_STAGING.handSlowS + 0.4
}
