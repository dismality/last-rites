// Pure movement maths for the first-person controller (no three.js / React).
// Conventions: yaw 0 looks down -Z; positive yaw turns left (counter-clockwise from above).

export const WALK_SPEED = 3.0
export const SPRINT_SPEED = 5.5
export const MAX_PITCH = (85 * Math.PI) / 180
/** Radians of rotation per pixel of mouse travel at sensitivity 1.0. */
export const RADIANS_PER_PIXEL = 0.0022
export const HEAD_BOB_AMPLITUDE = 0.04
export const HEAD_BOB_FREQUENCY = 2
/** How fast the bob amplitude eases in/out (1/s), so stopping doesn't snap the camera. */
const HEAD_BOB_BLEND_RATE = 10

export function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pitch))
}

export interface LookResult {
  yaw: number
  pitch: number
}

/** Mouse right (dx > 0) turns right, mouse down (dy > 0) looks down unless inverted. */
export function applyLook(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  sensitivity: number,
  invertY: boolean
): LookResult {
  const k = RADIANS_PER_PIXEL * sensitivity
  const ySign = invertY ? 1 : -1
  return { yaw: yaw - dx * k, pitch: clampPitch(pitch + ySign * dy * k) }
}

/** Horizontal velocity [x, z] in m/s. Diagonals are normalised so strafing isn't faster. */
export function moveVelocity(
  yaw: number,
  forward: number,
  strafe: number,
  speed: number
): [number, number] {
  const len = Math.hypot(forward, strafe)
  if (len === 0) return [0, 0]
  const f = forward / len
  const s = strafe / len
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  // forward = (-sin, -cos); right = (cos, -sin)
  return [(-sin * f + cos * s) * speed, (-cos * f - sin * s) * speed]
}

export function moveSpeed(sprintHeld: boolean, stamina: number): number {
  return sprintHeld && stamina > 0 ? SPRINT_SPEED : WALK_SPEED
}

export interface BobState {
  phase: number
  amplitude: number
}

export function tickHeadBob(
  s: BobState,
  dt: number,
  moving: boolean,
  enabled: boolean
): BobState {
  const target = moving && enabled ? HEAD_BOB_AMPLITUDE : 0
  const blend = Math.min(1, HEAD_BOB_BLEND_RATE * dt)
  const amplitude = s.amplitude + (target - s.amplitude) * blend
  const phase = moving && enabled ? (s.phase + dt * HEAD_BOB_FREQUENCY * Math.PI * 2) % (Math.PI * 2) : s.phase
  return { phase, amplitude }
}

export function headBobOffset(s: BobState): number {
  return Math.sin(s.phase) * s.amplitude
}
