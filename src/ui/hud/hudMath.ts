// Pure helpers for HUD gauges, kept out of the components so they can be tested in Node.

/** HP below this value tints the flame red (design bible: heartbeat also starts here). */
export const LOW_HEALTH_THRESHOLD = 30

/** Clamp a 0-100 value to a 0-1 fraction. NaN becomes 0. */
export function toFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value / 100))
}

export function isLowHealth(health: number): boolean {
  return health < LOW_HEALTH_THRESHOLD
}

/** Rounded integer for numeric overlays. */
export function formatValue(value: number): string {
  return String(Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))))
}
