// Dodge: a short stamina dash with an invulnerable start. Pure, no React / three.js.
// Requirements 9.4, 9.5, 9.6, 9.7, 17.9.
import { DODGE } from '../../data/combatMoves'
import type { Vec2 } from './combat'

export interface DodgeState {
  elapsedS: number
  /** Unit dash direction on the ground plane. */
  dir: Vec2
}

/** Needs the stamina, no cooldown and no dash already running (Req 9.7). */
export const canDodge = (stamina: number, cooldownLeftS: number, active: boolean): boolean =>
  stamina >= DODGE.staminaCost && !(cooldownLeftS > 0) && !active

const unit = (v: Vec2): Vec2 | null => {
  const len = Math.hypot(v.x, v.z)
  return len > 0 && Number.isFinite(len) ? { x: v.x / len, z: v.z / len } : null
}

/** Dashes the way the player is moving; with no input, backwards (Req 9.4). */
export function startDodge(moveDir: Vec2, facing: Vec2): DodgeState {
  const dir = unit(moveDir) ?? unit({ x: 0 - facing.x, z: 0 - facing.z }) ?? { x: 0, z: 1 }
  return { elapsedS: 0, dir }
}

/** Null once the dash has run its 0.25 s. */
export function tickDodge(s: DodgeState, dt: number): DodgeState | null {
  const elapsedS = s.elapsedS + (Number.isFinite(dt) ? Math.max(0, dt) : 0)
  return elapsedS >= DODGE.durationS ? null : { ...s, elapsedS }
}

/** Replaces walking velocity, so the character controller stops the dash at a wall (Req 9.9). */
export function dodgeVelocity(s: DodgeState): Vec2 {
  const speed = DODGE.distanceM / DODGE.durationS
  return { x: s.dir.x * speed, z: s.dir.z * speed }
}

/** Only the first 0.2 s ignores damage (Req 9.5, 9.6). */
export const isInvulnerable = (s: DodgeState | null): boolean =>
  s !== null && s.elapsedS < DODGE.iFramesS
