// Pure fixed-timestep accumulator ("fix your timestep").

/** Simulation step: 60 Hz. */
export const STEP = 1 / 60
/** Largest frame delta we accept; stops a tab-switch from triggering a spiral of catch-up ticks. */
export const MAX_DELTA = 0.25

export interface StepResult {
  /** Whole fixed ticks to run this frame. */
  ticks: number
  /** Leftover time carried to the next frame, always in [0, STEP). */
  accumulator: number
  /** accumulator / STEP, for render interpolation. */
  alpha: number
}

export function advanceAccumulator(accumulator: number, frameDelta: number): StepResult {
  const delta = Math.min(Math.max(0, frameDelta), MAX_DELTA)
  let acc = accumulator + delta
  // Integer count rather than a while-loop of subtractions avoids drift in the remainder.
  const ticks = Math.floor(acc / STEP + 1e-9)
  acc = Math.max(0, acc - ticks * STEP)
  return { ticks, accumulator: acc, alpha: acc / STEP }
}
