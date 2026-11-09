// Hit feedback, muzzle flash and aim numbers (design bible §4 "Combat feedback (07)",
// §7 "Placements and tuning (07)"). Read by the pure feedback systems and the HUD.

export const HIT_MARKER = {
  /** How long a hit marker shows. A kill marker lasts the same time, drawn larger. */
  hitS: 0.15,
  killScale: 1.5,
  /** Flashing lights Off: the marker holds steady instead of flicking. */
  steadyS: 0.3,
} as const

export const DAMAGE_NUMBER = {
  lifeS: 0.8,
  riseMps: 1.2,
  /** Hard cap on live numbers so the instanced mesh stays bounded. */
  max: 24,
} as const

export const MUZZLE = {
  flashingOn: { durationS: 0.06, peak: 1, light: true },
  /** A long, dim sprite and no light pop, so nothing flashes (Req 21.1, 21.2). */
  flashingOff: { durationS: 0.3, peak: 0.35, light: false },
} as const

export const AIM = {
  fovDeg: 10,
  moveMult: 0.7,
  blendS: 0.12,
} as const
