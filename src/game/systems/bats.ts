// Bats that watch the player (spec 11 H4). Pure TypeScript: no React, three.js or Howler imports.
// Bats never deal damage and never request a screen scare (Req 4.11); a test checks the imports.
import { BAT } from '../../data/bats'
import { choosePerches, type PerchBox } from './batPerches'
import type { Rng } from '../rng'

export type BatPhase = 'perched' | 'fleeing' | 'gone'

export interface Bat {
  phase: BatPhase
  /** Box the bat sits on, or the one it left while fleeing or gone. */
  boxIndex: number
  /** The box it sat on before the latest return, so it comes back somewhere else. */
  previousBox: number | null
  /** Seconds in the current phase. */
  t: number
  /** Rest heading (deg) and current head heading (deg). */
  restYaw: number
  yaw: number
}

export interface BatInput {
  /** Distance from the player to the bat (m). */
  playerDist: number
  /** Distance from the bat to a shot fired this step, or null if none. */
  shotDist: number | null
  /** Bearing from the bat to the player (deg). */
  bearing: number
}

export function createBat(boxIndex: number, restYaw: number): Bat {
  return { phase: 'perched', boxIndex, previousBox: null, t: 0, restYaw, yaw: restYaw }
}

const wrap = (d: number): number => {
  const m = (((d + 180) % 360) + 360) % 360
  return m - 180
}

/**
 * Head heading after `dt` seconds. Inside the watch range the target is the bearing to the player,
 * clamped to maxYawDeg either side of rest; outside it the target is rest. Exponential ease.
 */
export function headYaw(
  rest: number,
  bearing: number,
  current: number,
  dist: number,
  dt: number,
): number {
  const offset = wrap(current - rest)
  const target =
    dist <= BAT.watchRangeM
      ? Math.max(-BAT.maxYawDeg, Math.min(BAT.maxYawDeg, wrap(bearing - rest)))
      : 0
  const k = 1 - Math.exp(-Math.max(0, dt) / BAT.easeS)
  return rest + offset + (target - offset) * k
}

/** Fade opacity while fleeing: 1 during flight, then 0 over fadeS. */
export function batOpacity(b: Bat): number {
  if (b.phase === 'gone') return 0
  if (b.phase === 'perched' || b.t <= BAT.flightS) return 1
  return Math.max(0, 1 - (b.t - BAT.flightS) / BAT.fadeS)
}

/**
 * One step. A perched bat watches and takes off when the player is under takeoffM or a shot
 * landed within gunRangeM. A fleeing bat is gone after flightS + fadeS. A gone bat stays gone;
 * `readyToReturn` says when returnS has passed, and `returnBat` then picks the new box.
 */
export function stepBat(b: Bat, input: BatInput, dt: number): Bat {
  if (b.phase === 'perched') {
    const spooked =
      input.playerDist < BAT.takeoffM ||
      (input.shotDist !== null && input.shotDist <= BAT.gunRangeM)
    if (spooked) return { ...b, phase: 'fleeing', t: 0 }
    return {
      ...b,
      t: b.t + dt,
      yaw: headYaw(b.restYaw, input.bearing, b.yaw, input.playerDist, dt),
    }
  }
  if (b.phase === 'fleeing') {
    const t = b.t + dt
    if (t >= BAT.flightS + BAT.fadeS) return { ...b, phase: 'gone', t: 0 }
    return { ...b, t }
  }
  return { ...b, t: b.t + dt }
}

export function readyToReturn(b: Bat): boolean {
  return b.phase === 'gone' && b.t >= BAT.returnS
}

/**
 * Puts a gone bat back on a qualifying box that is free and not the one it left. Stays gone
 * (and tries again next step) when it is not time yet or no such box exists.
 */
export function returnBat(
  b: Bat,
  boxes: readonly PerchBox[],
  occupied: readonly number[],
  rng: Rng,
  restYaw: number,
): Bat {
  if (!readyToReturn(b)) return b
  const spots = choosePerches(boxes, Math.floor(rng() * 0x100000000), occupied, [b.boxIndex])
  if (spots.length === 0) return b
  return {
    phase: 'perched',
    boxIndex: spots[0].boxIndex,
    previousBox: b.boxIndex,
    t: 0,
    restYaw,
    yaw: restYaw,
  }
}

/** At most one chitter per chitterGapS, and only while at least one bat is perched. */
export function chitterAllowed(
  lastChitter: number | null,
  now: number,
  perchedCount: number,
): boolean {
  if (perchedCount < 1) return false
  return lastChitter === null || now - lastChitter >= BAT.chitterGapS
}

export type Vec3 = readonly [number, number, number]

/**
 * Where a fleeing bat is `t` seconds after take-off: it leaves its perch along `fleeYawDeg`
 * (away from the player), swaying sideways on a sine so the path curves, and climbs while it
 * goes. `heading` is the way it faces (the path's tangent), in degrees about Y.
 */
export function fleePosition(
  start: Vec3,
  fleeYawDeg: number,
  t: number,
): { position: Vec3; headingDeg: number } {
  const F = BAT.flee
  const yaw = (fleeYawDeg * Math.PI) / 180
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const along = F.speedMps * t
  const sway = F.swayAmpM * Math.sin(F.swayRadPerS * t)
  const swayRate = F.swayAmpM * F.swayRadPerS * Math.cos(F.swayRadPerS * t)
  const climb = F.climbM * Math.min(1, t / F.climbS)
  const position: Vec3 = [
    start[0] + fx * along + fz * sway,
    start[1] + climb,
    start[2] + fz * along - fx * sway,
  ]
  const vx = fx * F.speedMps + fz * swayRate
  const vz = fz * F.speedMps - fx * swayRate
  return { position, headingDeg: (Math.atan2(vx, vz) * 180) / Math.PI }
}

/** Wing angle (rad) at sim time `t`: flapsPerS full swings per second. */
export function wingAngle(t: number): number {
  return BAT.flapAmpRad * Math.sin(2 * Math.PI * BAT.flapsPerS * t)
}

/** Heading (deg about Y, 0 = +z) from one ground point to another. */
export function bearingDeg(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return (Math.atan2(toX - fromX, toZ - fromZ) * 180) / Math.PI
}
