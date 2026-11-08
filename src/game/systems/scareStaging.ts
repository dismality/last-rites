// Pure rules for staging scares: who faces whom, which door is behind you, how candles go out.
// The scene (src/scene/scares/) animates the results. No React, three.js or Howler imports.

import { SCARE_STAGING, SCARE_ZONES, type ScareEventId, type ScareZone } from '../../data/scares'
import type { Vec2 } from './combat'
import { forwardFromYaw } from './melee'

const S = SCARE_STAGING

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

/** True when `target` lies inside the player's horizontal view cone. */
export function isInView(
  player: Vec2,
  yaw: number,
  target: Vec2,
  halfAngleDeg: number = S.viewHalfAngleDeg,
): boolean {
  const dx = target.x - player.x
  const dz = target.z - player.z
  const len = Math.hypot(dx, dz)
  if (len === 0) return true
  const f = forwardFromYaw(yaw)
  return (dx / len) * f.x + (dz / len) * f.z >= Math.cos((halfAngleDeg * Math.PI) / 180)
}

/** Point `distance` metres behind the player (negative distance = in front). */
export function behindPoint(player: Vec2, yaw: number, distance: number): Vec2 {
  const f = forwardFromYaw(yaw)
  return { x: player.x - f.x * distance, z: player.z - f.z * distance }
}

/** Point `distance` metres to the player's side; side -1 = left, +1 = right. */
export function sidePoint(player: Vec2, yaw: number, side: -1 | 1, distance: number): Vec2 {
  const f = forwardFromYaw(yaw)
  // Right-hand vector on the ground plane for forward (fx, fz) with +Z south.
  return { x: player.x - f.z * side * distance, z: player.z + f.x * side * distance }
}

/** Yaw that makes a model whose front is +Z look at `to` from `from`. */
export function yawToward(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

/** Prefers a point that is behind the player; falls back to the farthest one. */
export function pickBehind<T extends { position: readonly [number, number, number] }>(
  player: Vec2,
  yaw: number,
  items: readonly T[],
): T | undefined {
  const f = forwardFromYaw(yaw)
  const withDot = items.map((it) => {
    const dx = it.position[0] - player.x
    const dz = it.position[2] - player.z
    const len = Math.hypot(dx, dz) || 1
    return { it, dot: (dx / len) * f.x + (dz / len) * f.z }
  })
  const behind = withDot.filter((w) => w.dot < 0).sort((a, b) => a.dot - b.dot)
  if (behind.length > 0) return behind[0].it
  return withDot.sort((a, b) => a.dot - b.dot)[0]?.it
}

// --- Statue ----------------------------------------------------------------

export type StatueStatus = 'away' | 'waiting' | 'turned'

export interface StatueState {
  status: StatueStatus
  /** Seconds spent waiting for the player to look away. */
  waited: number
}

export const STATUE_IDLE: StatueState = { status: 'away', waited: 0 }

export function triggerStatue(s: StatueState): StatueState {
  return s.status === 'waiting' ? s : { status: 'waiting', waited: 0 }
}

/**
 * The statue only ever moves while the player is not looking at it, so the player
 * sees it already turned when they look back (design bible §9).
 */
export function tickStatue(s: StatueState, dt: number, player: Vec2, yaw: number, statue: Vec2): StatueState {
  const watching = isInView(player, yaw, statue)
  switch (s.status) {
    case 'waiting': {
      if (!watching) return { status: 'turned', waited: 0 }
      const waited = s.waited + dt
      return waited >= S.statueMaxWaitS ? STATUE_IDLE : { status: 'waiting', waited }
    }
    case 'turned':
      return !watching && dist(player, statue) > S.statueResetDistanceM ? STATUE_IDLE : s
    default:
      return s
  }
}

// --- Door ------------------------------------------------------------------

export type DoorPhase = 'shut' | 'creak' | 'slam' | 'held'

export interface DoorState {
  phase: DoorPhase
  t: number
}

export const DOOR_IDLE: DoorState = { phase: 'shut', t: 0 }

/** Opening angle in radians for the leaf (0 = shut). */
export function doorAngle(d: DoorState, creakLead: number): number {
  switch (d.phase) {
    case 'creak':
      return S.doorCreakAngle * Math.min(1, d.t / Math.max(creakLead, 0.001))
    case 'slam':
      return S.doorCreakAngle * Math.max(0, 1 - d.t / S.doorSlamS)
    default:
      return 0
  }
}

export function tickDoor(d: DoorState, dt: number): DoorState {
  const t = d.t + dt
  switch (d.phase) {
    case 'slam':
      return t >= S.doorSlamS ? { phase: 'held', t: 0 } : { phase: 'slam', t }
    case 'held':
      return t >= S.doorHoldShutS ? DOOR_IDLE : { phase: 'held', t }
    case 'creak':
      return { phase: 'creak', t }
    default:
      return d
  }
}

// --- Candles ---------------------------------------------------------------

export interface CandleState {
  /** Seconds since the gust began; null when idle. */
  t: number | null
  /** Seconds after `t = 0` at which each candle goes out. */
  outAt: readonly number[]
}

/** Candles farthest from the player go out first, so the dark walks toward them. */
export function snuffSchedule(candles: readonly Vec2[], player: Vec2): number[] {
  const order = candles
    .map((c, i) => ({ i, d: dist(c, player) }))
    .sort((a, b) => b.d - a.d)
  const out = new Array<number>(candles.length).fill(0)
  order.forEach((o, rank) => {
    out[o.i] = rank * S.candleSnuffIntervalS
  })
  return out
}

export function startSnuff(candles: readonly Vec2[], player: Vec2): CandleState {
  return { t: 0, outAt: snuffSchedule(candles, player) }
}

export function tickCandles(c: CandleState, dt: number): CandleState {
  if (c.t === null) return c
  const t = c.t + dt
  const total = (c.outAt.length ? Math.max(...c.outAt) : 0) + S.candleRelightAfterS
  return t >= total ? { t: null, outAt: c.outAt } : { t, outAt: c.outAt }
}

export function candleLit(c: CandleState, index: number): boolean {
  if (c.t === null) return true
  return c.t < (c.outAt[index] ?? 0)
}

// --- Hand from the grave ----------------------------------------------------

/** Movement multiplier while a hand holds the ankle; 1 once it lets go. */
export function slowFactor(remaining: number): number {
  return remaining > 0 ? S.handSlowFactor : 1
}

// --- Zone lookup -------------------------------------------------------------

/**
 * The cue does not carry its zone, so find it: the zone offering eventId that contains
 * the player, else the nearest one by distance to its bounds.
 */
export function zoneForEvent(
  eventId: ScareEventId,
  player: Vec2,
  zones: readonly ScareZone[] = SCARE_ZONES,
): ScareZone | undefined {
  let best: ScareZone | undefined
  let bestD = Infinity
  for (const z of zones) {
    if (!z.events.includes(eventId)) continue
    const dx = Math.max(z.bounds.min[0] - player.x, 0, player.x - z.bounds.max[0])
    const dz = Math.max(z.bounds.min[2] - player.z, 0, player.z - z.bounds.max[2])
    const d = Math.hypot(dx, dz)
    if (d < bestD) {
      best = z
      bestD = d
    }
  }
  return best
}