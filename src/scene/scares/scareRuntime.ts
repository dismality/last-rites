// Per-frame values shared between the zone sensors, the stager, the camera and the lantern.
// Mutable refs rather than store state: they change every frame and only the scene reads them.

export const scareRuntime = {
  /** Zones the player is currently inside (kept for debugging and future UI). */
  inside: new Set<string>(),
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
}

export function resetScareRuntime(): void {
  scareRuntime.inside.clear()
  scareRuntime.justEntered = []
  scareRuntime.shakeAge = Infinity
  scareRuntime.flickerLeft = 0
  scareRuntime.flickerStrobe = true
  scareRuntime.slowLeft = 0
}
