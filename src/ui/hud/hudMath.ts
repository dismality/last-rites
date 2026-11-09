// Pure helpers for HUD gauges, kept out of the components so they can be tested in Node.

/** Clamp a 0-100 value to a 0-1 fraction. NaN becomes 0. */
export function toFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value / 100))
}

/** Rounded integer for numeric overlays. */
export function formatValue(value: number): string {
  return String(Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))))
}

/** Number of five-stroke groups needed to draw `count` tally marks. */
export function tallyGroups(count: number): number {
  return Math.ceil(Math.max(0, count) / 5)
}
