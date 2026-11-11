// Mouse-look spike filter. Pure: no DOM, so it is tested in Node.
//
// Why: Chrome on Windows sometimes delivers one enormous movementX/Y event (thousands of px) in the
// middle of slow motion, which snaps the view to an extreme angle. A real fast flick looks different:
// it is a run of large events that ramp up and stay large. So an event far above anything the mouse
// was just doing is held back; the next event decides. If it is also substantial the flick is real
// and both are applied, otherwise the lone spike is dropped.

/** A single event above this (px) after near-stillness is suspect. Real 1000 Hz events stay far lower. */
export const SPIKE_THRESHOLD_PX = 400
/** The follow-up (or the previous event) must reach this share of the threshold to count as a flick. */
export const SPIKE_CONFIRM_RATIO = 0.25
/** A held spike with no follow-up for this many frames is dropped. */
export const SPIKE_MAX_HOLD_FRAMES = 1

export interface LookDelta {
  dx: number
  dy: number
}

export interface SpikeFilter {
  /** Feeds one raw event; returns the delta to apply now (zero while a suspect event is held). */
  push: (dx: number, dy: number) => LookDelta
  /** Call once per frame after reading: drops a held spike that never got confirmed. */
  endFrame: () => void
  /** Forget everything (view ownership change, pointer lock regained). */
  reset: () => void
}

export function createSpikeFilter(
  threshold: number = SPIKE_THRESHOLD_PX,
  confirmRatio: number = SPIKE_CONFIRM_RATIO,
  maxHoldFrames: number = SPIKE_MAX_HOLD_FRAMES,
): SpikeFilter {
  const confirmAt = threshold * confirmRatio
  let pending: LookDelta | null = null
  let pendingAge = 0
  // Size of the last event that was let through; starts calm.
  let lastMag = 0

  return {
    push(dx, dy) {
      const mag = Math.hypot(dx, dy)
      if (pending) {
        const held = pending
        pending = null
        if (mag >= confirmAt) {
          // A run of big events: a real flick. Release the held one with this one.
          lastMag = mag
          return { dx: held.dx + dx, dy: held.dy + dy }
        }
        // A lone spike: drop it and treat this event as the start of calm motion.
      }
      if (mag > threshold && lastMag < confirmAt) {
        pending = { dx, dy }
        pendingAge = 0
        return { dx: 0, dy: 0 }
      }
      lastMag = mag
      return { dx, dy }
    },
    endFrame() {
      if (!pending) return
      pendingAge++
      if (pendingAge > maxHoldFrames) {
        pending = null
        lastMag = 0
      }
    },
    reset() {
      pending = null
      pendingAge = 0
      lastMag = 0
    },
  }
}
