// Swing of the belfry bell after it is rung (spec 09 task 11n-a). A damped swing about the bell's
// pivot: a few degrees, dying out over a few seconds. Pure; the scene turns the mesh by this angle.

/** First swing, in degrees ("a few degrees"). */
export const BELL_SWING_DEG = 7
/** Swings per second. */
export const BELL_SWING_HZ = 0.9
/** The swing has died away after this long. */
export const BELL_SWING_S = 7

/** Angle in radians `sinceRingS` seconds after the bell rang; 0 before and after the swing. */
export function bellAngle(sinceRingS: number): number {
  if (sinceRingS < 0 || sinceRingS >= BELL_SWING_S) return 0
  const decay = 1 - sinceRingS / BELL_SWING_S
  return ((BELL_SWING_DEG * Math.PI) / 180) * decay * decay * Math.sin(2 * Math.PI * BELL_SWING_HZ * sinceRingS)
}
