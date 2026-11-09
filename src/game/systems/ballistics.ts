// Ballistics: pure shot resolution for the firearms (design bible §4 "Firearms (07)").
// Zombies have no colliders, so shots are tested against one vertical capsule per
// zombie; walls arrive through an injected `WallDistance` (Rapier in the scene).
// Pure TS: no React, three.js or Howler. Requirements 3.1–3.7, 3.11–3.15, 10.4.
import {
  ENEMY_CAPSULE,
  ENEMY_LOOKS,
  ENEMY_MODEL_HEIGHT,
  type EnemyId,
} from '../../data/enemies'
import { ELITE } from '../../data/elites'
import { HEAD_ZONE_M, type FirearmDef } from '../../data/firearms'
import { createRng, type Rng } from '../rng'
import type { FirearmId } from '../types'
import type { Vec2 } from './combat'
import type { Vec3 } from './projectiles'

export interface Capsule {
  uid: string
  x: number
  z: number
  radius: number
  /** Total height, feet at y = 0. */
  height: number
}

/** The fields of a zombie the capsule needs; `AIEnemy` satisfies this structurally. */
export interface CapsuleSource {
  uid: string
  type: EnemyId
  pos: Vec2
  /** Seconds left lying down; above 0 the capsule is the short "down" one. */
  knockdown?: number
  elite?: boolean
}

/** Stats that shape a shot; upgrades produce a modified copy of the base definition. */
export type FirearmStats = Pick<
  FirearmDef,
  | 'damage'
  | 'pellets'
  | 'headshotMult'
  | 'rangeM'
  | 'falloffEndM'
  | 'spreadHipDeg'
  | 'spreadAimedDeg'
>

export type WallDistance = (origin: Vec3, dir: Vec3, maxM: number) => number

export interface ShotInput {
  weapon: FirearmId
  origin: Vec3
  aim: Vec3
  aiming: boolean
  stats: FirearmStats
  blessed: boolean
  seed: number
}

export interface ShotHit {
  uid: string
  damage: number
  pellets: number
  headshot: boolean
  point: Vec3
  /** Distance of the nearest damaging ray, for the Brute knockdown rule. */
  nearestM: number
}

const finite = (n: number): boolean => Number.isFinite(n)

export function capsuleFor(e: CapsuleSource): Capsule {
  const look = ENEMY_LOOKS[e.type]
  const [sx, sy, sz] = typeof look.scale === 'number' ? [look.scale, look.scale, look.scale] : look.scale
  const eliteMult = e.elite ? ELITE.scale : 1
  const down = (e.knockdown ?? 0) > 0
  const height = down
    ? ENEMY_CAPSULE.downHeightM
    : ENEMY_MODEL_HEIGHT[look.model] * sy * eliteMult
  return {
    uid: e.uid,
    x: e.pos.x,
    z: e.pos.z,
    radius: ENEMY_CAPSULE.radiusM * Math.max(sx, sz),
    height,
  }
}

/**
 * Nearest entry of a ray (unit `dir`) into the capsule within `maxT`, with the hit
 * height. A ray that starts inside reports t = 0.
 */
export function rayVsCapsule(
  origin: Vec3,
  dir: Vec3,
  maxT: number,
  c: Capsule,
): { t: number; y: number } | null {
  if (![origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxT].every(finite)) return null
  if (maxT < 0 || c.height <= 0 || c.radius <= 0) return null
  // Segment of the capsule axis; a short (lying) capsule collapses to a sphere-ish shape.
  const mid = c.height / 2
  const y0 = Math.min(c.radius, mid)
  const y1 = Math.max(c.height - c.radius, mid)
  const r2 = c.radius * c.radius
  const ox = origin.x - c.x
  const oz = origin.z - c.z

  const clampedY = Math.min(Math.max(origin.y, y0), y1)
  if (ox * ox + oz * oz + (origin.y - clampedY) ** 2 <= r2) return { t: 0, y: origin.y }

  let best = Infinity
  let bestY = 0
  const consider = (t: number, y: number): void => {
    if (t >= 0 && t <= maxT && t < best) {
      best = t
      bestY = y
    }
  }

  // Side wall: infinite cylinder, kept only between the cap centres.
  const a = dir.x * dir.x + dir.z * dir.z
  if (a > 1e-12) {
    const b = 2 * (ox * dir.x + oz * dir.z)
    const cc = ox * ox + oz * oz - r2
    const disc = b * b - 4 * a * cc
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const y = origin.y + dir.y * t
        if (y >= y0 && y <= y1) consider(t, y)
      }
    }
  }
  // Hemispherical caps.
  for (const cy of [y0, y1]) {
    const oy = origin.y - cy
    const b = 2 * (ox * dir.x + oy * dir.y + oz * dir.z)
    const cc = ox * ox + oy * oy + oz * oz - r2
    const aa = a + dir.y * dir.y
    if (aa <= 1e-12) continue
    const disc = b * b - 4 * aa * cc
    if (disc < 0) continue
    const sq = Math.sqrt(disc)
    for (const t of [(-b - sq) / (2 * aa), (-b + sq) / (2 * aa)]) {
      const y = origin.y + dir.y * t
      // Each sphere only owns its outer half.
      if ((cy === y0 && y <= y0) || (cy === y1 && y >= y1)) consider(t, y)
    }
  }
  return best === Infinity ? null : { t: best, y: bestY }
}

function normalize(v: Vec3): Vec3 | null {
  if (![v.x, v.y, v.z].every(finite)) return null
  const len = Math.hypot(v.x, v.y, v.z)
  if (!(len > 1e-9) || !finite(len)) return null
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/** Uniform direction on the cone cap around `aim`: cosθ = 1 − u(1 − cos max). */
export function spreadDirection(aim: Vec3, coneDeg: number, rng: Rng): Vec3 {
  const n = normalize(aim)
  if (!n) return { x: 0, y: 0, z: 0 }
  const u = rng()
  const phi = rng() * Math.PI * 2
  if (!finite(coneDeg) || coneDeg <= 0) return n
  const maxRad = (Math.min(coneDeg, 180) * Math.PI) / 180
  const cosT = 1 - u * (1 - Math.cos(maxRad))
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
  // Orthonormal basis around n; pick the world axis least aligned with it.
  const helper: Vec3 = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  let ux = helper.y * n.z - helper.z * n.y
  let uy = helper.z * n.x - helper.x * n.z
  let uz = helper.x * n.y - helper.y * n.x
  const ul = Math.hypot(ux, uy, uz)
  ux /= ul
  uy /= ul
  uz /= ul
  const vx = n.y * uz - n.z * uy
  const vy = n.z * ux - n.x * uz
  const vz = n.x * uy - n.y * ux
  const cp = Math.cos(phi) * sinT
  const sp = Math.sin(phi) * sinT
  return {
    x: n.x * cosT + ux * cp + vx * sp,
    y: n.y * cosT + uy * cp + vy * sp,
    z: n.z * cosT + uz * cp + vz * sp,
  }
}

/** Furthest distance at which a ray can still deal damage. */
export const lastDamagingRange = (s: Pick<FirearmStats, 'rangeM' | 'falloffEndM'>): number =>
  s.falloffEndM ?? s.rangeM

/** Damage of one ray: base × headshot × range falloff, then ×2 for Blessed Rounds. */
export function rayDamage(
  stats: FirearmStats,
  distM: number,
  head: boolean,
  blessed: boolean,
): number {
  if (!finite(distM) || !finite(stats.damage) || stats.damage <= 0) return 0
  const d = Math.max(0, distM)
  let falloff: number
  if (stats.falloffEndM === null) {
    falloff = d <= stats.rangeM ? 1 : 0
  } else if (d <= stats.rangeM) {
    falloff = 1
  } else if (d >= stats.falloffEndM) {
    falloff = 0
  } else {
    falloff = (stats.falloffEndM - d) / (stats.falloffEndM - stats.rangeM)
  }
  const dmg = stats.damage * (head ? stats.headshotMult : 1) * falloff * (blessed ? 2 : 1)
  return dmg > 0 && finite(dmg) ? dmg : 0
}

/** The shotgun's aimed spread is never wider than its hip spread. */
export const coneDegFor = (s: FirearmStats, aiming: boolean): number =>
  aiming ? Math.min(s.spreadAimedDeg, s.spreadHipDeg) : s.spreadHipDeg

/**
 * Casts every ray of one shot. A zero or non-finite `aim` fires nothing (0 rays).
 * Targets must already exclude zombies with hp <= 0 (the caller builds the list).
 */
export function resolveShot(
  shot: ShotInput,
  targets: readonly Capsule[],
  wall: WallDistance,
): { hits: ShotHit[]; rays: number } {
  const aim = normalize(shot.aim)
  if (!aim || ![shot.origin.x, shot.origin.y, shot.origin.z].every(finite)) {
    return { hits: [], rays: 0 }
  }
  const rng = createRng(shot.seed)
  const rays = Math.max(1, Math.floor(shot.stats.pellets))
  const cone = coneDegFor(shot.stats, shot.aiming)
  const maxM = lastDamagingRange(shot.stats)
  const merged = new Map<string, ShotHit>()

  for (let i = 0; i < rays; i++) {
    const dir = spreadDirection(aim, cone, rng)
    const wallM = wall(shot.origin, dir, maxM)
    let bestT = Infinity
    let bestY = 0
    let bestCap: Capsule | null = null
    for (const cap of targets) {
      const h = rayVsCapsule(shot.origin, dir, maxM, cap)
      if (h && h.t < bestT) {
        bestT = h.t
        bestY = h.y
        bestCap = cap
      }
    }
    if (!bestCap || !(bestT < wallM)) continue
    const head = bestY >= bestCap.height - HEAD_ZONE_M
    const damage = rayDamage(shot.stats, bestT, head, shot.blessed)
    if (damage <= 0) continue
    const point: Vec3 = {
      x: shot.origin.x + dir.x * bestT,
      y: bestY,
      z: shot.origin.z + dir.z * bestT,
    }
    const prev = merged.get(bestCap.uid)
    if (prev) {
      prev.damage += damage
      prev.pellets += 1
      prev.headshot = prev.headshot || head
      if (bestT < prev.nearestM) {
        prev.nearestM = bestT
        prev.point = point
      }
    } else {
      merged.set(bestCap.uid, {
        uid: bestCap.uid,
        damage,
        pellets: 1,
        headshot: head,
        point,
        nearestM: bestT,
      })
    }
  }
  return { hits: [...merged.values()], rays }
}
