// Tuning for the chapel's interior fog (spec 09 task 11n-a). Read by systems/interiorFog.ts.

export const INTERIOR_FOG = {
  /** Fog density multiplier at full effect. */
  densityScale: 2.4,
  /** How far the fog colour moves toward the warm tint at full effect (0..1). */
  tintMix: 0.55,
  /** Warm, dark candle-smoke brown (sRGB 0..1). */
  tint: [0.1, 0.06, 0.035] as readonly [number, number, number],
  /** Easing speed: about 0.4 s to cross a doorway. */
  easePerS: 2.5,
} as const
