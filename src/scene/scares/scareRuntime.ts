// Per-frame values shared between the zone sensors, the stager, the camera and the lantern.
// Mutable refs rather than store state: they change every frame and only the scene reads them.

import type { ScareEventId } from '../../data/scares'

export const scareRuntime = {
  /** Zones the player is currently inside (kept for debugging and future UI). */
  inside: new Set<string>(),
  /** Every zone entered since the run started (debug and tests; never drained). */
  entered: new Set<string>(),
  /** Zone entries since the stager last ticked; drained by the stager. */
  justEntered: [] as string[],
  /** Seconds since the last scare shake began; Infinity = idle. */
  shakeAge: Infinity,
  /** Seconds of lantern flicker left (breath-behind telegraph). */
  flickerLeft: 0,
  /** Whether the flicker may strobe; false swaps it for a steady dip (flashing lights off). */
  flickerStrobe: true,
  /** Seconds of hand-from-grave slow left. */
  slowLeft: 0,
  /** Scares the dev panel asked for by id; the stager drains it and stages them at once. */
  forced: [] as ScareEventId[],
}

export function resetScareRuntime(): void {
  scareRuntime.inside.clear()
  scareRuntime.entered.clear()
  scareRuntime.justEntered = []
  scareRuntime.shakeAge = Infinity
  scareRuntime.flickerLeft = 0
  scareRuntime.flickerStrobe = true
  scareRuntime.slowLeft = 0
  scareRuntime.forced = []
}

