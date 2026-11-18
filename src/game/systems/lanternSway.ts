// Lantern hand motion rules (spec 11 H7, Req 7.3): the lantern trails the camera by about 80 ms
// and drops on sprint. Pure; the viewmodel applies the result.
import { VIEWMODEL_TIMING } from '../../data/viewmodel'

export type Vec3Tuple = readonly [number, number, number]

/**
 * Moves `current` toward `target` as a first-order lag with time constant `lagS`, so after `lagS`
 * seconds about 63% of a step is covered. Frame-rate independent.
 */
export function lagToward(current: Vec3Tuple, target: Vec3Tuple, dt: number, lagS: number): Vec3Tuple {
  if (!(dt > 0)) return current
  const k = lagS > 0 ? 1 - Math.exp(-dt / lagS) : 1
  return [
    current[0] + (target[0] - current[0]) * k,
    current[1] + (target[1] - current[1]) * k,
    current[2] + (target[2] - current[2]) * k,
  ]
}

/**
 * How far the lantern hand drops while sprinting (metres, positive = down). With Head bob on the
 * drop grows with the bob amplitude (0..1) from the low to the high end of the range; with Head
 * bob off it is the low end, constant, so nothing moves.
 */
export function sprintDrop(sprinting: boolean, headBob: boolean, bobAmplitude: number): number {
  if (!sprinting) return 0
  const [lo, hi] = VIEWMODEL_TIMING.sprintDropM
  if (!headBob) return lo
  const a = Number.isFinite(bobAmplitude) ? Math.min(1, Math.max(0, bobAmplitude)) : 0
  return lo + (hi - lo) * a
}
