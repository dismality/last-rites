// Grab kill-cam tuning (spec 10 task 8, Req 25, docs/game-design.md "Grab kill-cam").
// The rules are pure functions in src/game/systems/killCam.ts.

import type { EnemyId } from './enemies'

/** Which zombies can seize the keeper. The design also names the Sprinter, which is not in the game. */
export const GRAB_ENEMIES: readonly EnemyId[] = ['brute', 'lurker']

export const KILL_CAM = {
  /** Below this share of max health any grab enemy's blow can seize the keeper. */
  lowHealthFrac: 0.25,
  /** At most one kill-cam start per this many seconds of play. */
  cooldownS: 60,
  /** The keeper "faces" a zombie within this many degrees either side of straight ahead. */
  facingHalfDeg: 60,
  /** The full close-up: the camera turns to the zombie and is held this long. */
  fullS: 1.2,
  /** Reduced intensity is shorter. */
  reducedS: 0.7,
  /** The turn to face the zombie takes this long (eased), then holds. */
  turnS: 0.2,
  /** The close-up leans the eye this far toward the zombie... */
  pushM: 0.3,
  /** ...and narrows the view by this many degrees. */
  fovDropDeg: 12,
  /** The camera looks at this height above the zombie's feet (its head). */
  headY: 1.6,
  /** Shake amplitude in metres at Full (Camera shake on). */
  shakeM: 0.035,
  /** The red edge stays on screen this long; under Flashing lights it pulses at edgeHz. */
  edgeS: 1.5,
  edgeHz: 4,
  /** The steady edge's opacity (Flashing lights off). */
  steadyOpacity: 0.6,
  /** Dust thrown up at the zombie's feet, in metres above the ground. */
  dustY: 0.3,
} as const

/** Per Scare intensity (Req 25.3-25.5). */
export const KILL_CAM_INTENSITY = {
  full: { pull: true, holdS: KILL_CAM.fullS, stinger: 'grab-stinger', shake: true },
  reduced: { pull: true, holdS: KILL_CAM.reducedS, stinger: 'grab-stinger-soft', shake: false },
  off: { pull: false, holdS: 0, stinger: null, shake: false },
} as const

/** The subtitle every grab shows; at Off it is shown even with Subtitles off (Req 25.5). */
export const GRAB_CAPTION = '[something seizes you]'
