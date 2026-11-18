// Footstep timing and surface. Pure: the controller feeds in how far the player actually moved
// this frame (after walls), and plays a step each time a stride's worth of ground is covered.
// Steps are files only (sfx/step-grass-1.ogg and so on), so with no files this stays silent.

import { isInsideHut } from '../../data/cemeteryLayout'
import { insideChapel } from './chapelDoors'
import { zoneAt } from './zoneAt'

export type StepSurface = 'grass' | 'stone' | 'wood'

/** Ground covered per footstep (m) when walking; sprint strides are longer. */
export const STEP_LENGTH_M = 2.1
export const SPRINT_STEP_LENGTH_M = 2.85
/** Movement smaller than this in a frame is a nudge (a push or a wall slide), not walking. */
const MIN_FRAME_MOVE_M = 0.0005

export interface StrideResult {
  /** Ground covered since the last step (m). */
  carry: number
  /** A footstep lands this frame. */
  step: boolean
}

/**
 * Add this frame's ground movement to the stride. Airborne or standing still keeps the carry
 * where it is, so a step never fires from a fall or a nudge; the first step lands half a stride
 * in, so starting to walk sounds at once.
 */
export function tickStride(carry: number, movedM: number, grounded: boolean, sprinting: boolean): StrideResult {
  if (!grounded || !Number.isFinite(movedM) || movedM < MIN_FRAME_MOVE_M) return { carry, step: false }
  const length = sprinting ? SPRINT_STEP_LENGTH_M : STEP_LENGTH_M
  const next = (Number.isFinite(carry) ? carry : 0) + movedM
  if (next >= length) return { carry: next % length, step: true }
  return { carry: next, step: false }
}

/** Carry to start from when the player starts moving: half a stride, so the first step is quick. */
export const STRIDE_START = STEP_LENGTH_M / 2

/** What the player stands on: hut boards, chapel and catacomb stone, grass everywhere else. */
export function stepSurface(x: number, z: number): StepSurface {
  if (isInsideHut(x, z)) return 'wood'
  if (insideChapel({ x, z })) return 'stone'
  return zoneAt(x, z) === 'catacombs' ? 'stone' : 'grass'
}
