// Pure helpers for lights that must stay mounted all game. Changing the number of lights in a
// three.js scene recompiles every lit material's shader (a visible multi-hundred-ms freeze), so
// lights are mounted once at intensity 0 and driven by these helpers instead.

/** Exponential approach of `current` toward `target`; frame-rate independent, never overshoots. */
export function rampIntensity(current: number, target: number, dt: number, rate: number): number {
  if (dt <= 0 || rate <= 0) return current
  const next = current + (target - current) * (1 - Math.exp(-rate * dt))
  // Snap when close so an "off" light reaches exactly 0 (and can be skipped by the renderer).
  return Math.abs(target - next) < 0.001 ? target : next
}

/** Longest frame time in a list (ms), 0 for an empty list. Used by the dev perf probe. */
export function longestFrame(frameTimesMs: readonly number[]): number {
  let max = 0
  for (const t of frameTimesMs) if (t > max) max = t
  return max
}
