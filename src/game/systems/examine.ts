// Examine-mode clue reveal — pure TypeScript.
//
// A hidden mark reveals its clue once it has faced the camera continuously for
// REVEAL_HOLD_S seconds. Scene code feeds the camera direction each frame and
// applies the returned state; it never decides reveal rules itself (Req 4.3).

export type Vec3Tuple = readonly [number, number, number]

/** Mark counts as "facing" when dot(cameraDir, worldNormal) is below this (design: -0.9). */
export const FACING_DOT_THRESHOLD = -0.9
/** Seconds the mark must stay facing the camera before the clue appears. */
export const REVEAL_HOLD_S = 1

export interface ClueRevealState {
  /** Continuous seconds spent facing the camera (reset when the mark turns away). */
  facingTime: number
  /** Latched: once revealed the clue stays visible for the rest of the examine. */
  revealed: boolean
}

export const INITIAL_CLUE_STATE: ClueRevealState = { facingTime: 0, revealed: false }

function dot(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * True when the mark's outward normal points back at the camera.
 * `cameraDir` is the camera's forward (look) direction; both vectors are unit length.
 */
export function isMarkFacing(cameraDir: Vec3Tuple, worldNormal: Vec3Tuple): boolean {
  return dot(cameraDir, worldNormal) < FACING_DOT_THRESHOLD
}

/** Advance the reveal timer by `dt` seconds. */
export function stepClueReveal(
  state: ClueRevealState,
  facing: boolean,
  dt: number,
): ClueRevealState {
  if (state.revealed) return state
  if (!facing) return state.facingTime === 0 ? state : { facingTime: 0, revealed: false }
  const facingTime = state.facingTime + Math.max(0, dt)
  return { facingTime, revealed: facingTime >= REVEAL_HOLD_S }
}
