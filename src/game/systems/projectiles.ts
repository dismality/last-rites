// Pure logic for thrown and placed items: preview arc, fuse timers, blasts,
// the lantern trap and the salt circle barrier. No React / three.js.
// Requirements 3.1–3.6.
import {
  ARC_STEPS,
  ARC_STEP_S,
  GRAVITY,
  THROW_LOFT_RAD,
  TRAP_BURN_RADIUS_M,
  TRAP_TRIGGER_RADIUS_M,
} from '../../data/projectiles'
import { WEAPON_MAP } from '../../data/weapons'
import { aoe, applyDamage, type DamageContext, type Vec2 } from './combat'
import type { StaggerEnemy } from './melee'

export interface Vec3 {
  x: number
  y: number
  z: number
}

// ---------------------------------------------------------------------------
// Arc preview (Req 3.1)
// ---------------------------------------------------------------------------
export interface Arc {
  points: Vec3[]
  /** Where the arc meets the ground, or null if it never lands within `steps`. */
  landing: Vec3 | null
}

/** Launch velocity from a look direction. `pitch` > 0 looks up; a small loft is added. */
export function throwVelocity(yaw: number, pitch: number, speed: number): Vec3 {
  const p = pitch + THROW_LOFT_RAD
  const cp = Math.cos(p)
  return { x: -Math.sin(yaw) * cp * speed, y: Math.sin(p) * speed, z: -Math.cos(yaw) * cp * speed }
}

/**
 * Samples the ballistic path. The last point is clipped to `groundY`, so the
 * preview's end is the landing point the player will see the item reach.
 */
export function arcPoints(
  origin: Vec3,
  velocity: Vec3,
  g: number = GRAVITY,
  steps: number = ARC_STEPS,
  dt: number = ARC_STEP_S,
  groundY = 0,
): Arc {
  const at = (t: number): Vec3 => ({
    x: origin.x + velocity.x * t,
    y: origin.y + velocity.y * t - 0.5 * g * t * t,
    z: origin.z + velocity.z * t,
  })
  const points: Vec3[] = [origin]
  for (let i = 1; i <= steps; i++) {
    const p = at(i * dt)
    if (p.y <= groundY) {
      // Interpolate between the previous sample and this one for the exact touchdown.
      const prev = points[points.length - 1]
      const k = prev.y === p.y ? 1 : (prev.y - groundY) / (prev.y - p.y)
      const land = {
        x: prev.x + (p.x - prev.x) * k,
        y: groundY,
        z: prev.z + (p.z - prev.z) * k,
      }
      points.push(land)
      return { points, landing: land }
    }
    points.push(p)
  }
  return { points, landing: null }
}

// ---------------------------------------------------------------------------
// Fuse (Req 3.4)
// ---------------------------------------------------------------------------
export interface Fuse {
  remaining: number
  fired: boolean
}

export const createFuse = (seconds: number): Fuse => ({ remaining: Math.max(0, seconds), fired: false })

/** `fire` is true on exactly the tick the fuse runs out. */
export function tickFuse(f: Fuse, dt: number): { fuse: Fuse; fire: boolean } {
  if (f.fired) return { fuse: f, fire: false }
  const remaining = Math.max(0, f.remaining - Math.max(0, dt))
  const fire = remaining <= 0
  return { fuse: { remaining, fired: fire }, fire }
}

// ---------------------------------------------------------------------------
// Blasts (Req 3.3, 3.4)
// ---------------------------------------------------------------------------
export interface BlastResult<T extends StaggerEnemy> {
  enemies: T[]
  hitUids: string[]
  killedUids: string[]
}

/** Damages every living enemy in `radius`; `stun` seconds are applied through the stagger timer. */
export function resolveBlast<T extends StaggerEnemy>(
  center: Vec2,
  radius: number,
  damage: number,
  enemies: readonly T[],
  ctx: DamageContext,
  stun = 0,
): BlastResult<T> {
  const hitUids = aoe(center, radius, enemies)
  const hit = new Set(hitUids)
  const killedUids: string[] = []
  const next = enemies.map((e) => {
    if (!hit.has(e.uid)) return e
    const hurt = applyDamage(e, damage, ctx)
    if (hurt.hp <= 0) killedUids.push(e.uid)
    return { ...hurt, stagger: Math.max(hurt.stagger, stun) }
  })
  return { enemies: next, hitUids, killedUids }
}

export const resolveFlask = <T extends StaggerEnemy>(
  center: Vec2,
  enemies: readonly T[],
  lanternFuel: number,
  stun: number,
): BlastResult<T> => {
  const w = WEAPON_MAP['holy-water-flask']
  return resolveBlast(center, w.radius ?? 0, w.damage, enemies, { lanternFuel, source: 'holy-water-flask' }, stun)
}

export const resolveNailBomb = <T extends StaggerEnemy>(
  center: Vec2,
  enemies: readonly T[],
  lanternFuel: number,
): BlastResult<T> => {
  const w = WEAPON_MAP['nail-bomb']
  return resolveBlast(center, w.radius ?? 0, w.damage, enemies, { lanternFuel, source: 'nail-bomb' })
}

// ---------------------------------------------------------------------------
// Lantern trap (Req 3.5)
// ---------------------------------------------------------------------------
export interface Trap {
  id: string
  pos: Vec2
  state: 'armed' | 'burning' | 'spent'
  /** Seconds of burn left once sprung. */
  burnLeft: number
}

export const createTrap = (id: string, pos: Vec2): Trap => ({
  id,
  pos,
  state: 'armed',
  burnLeft: WEAPON_MAP['lantern-trap'].duration ?? 0,
})

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

export interface TrapTick<T extends StaggerEnemy> {
  trap: Trap
  enemies: T[]
  /** True on the tick the trap springs. */
  sprung: boolean
}

export function tickTrap<T extends StaggerEnemy>(
  trap: Trap,
  dt: number,
  enemies: readonly T[],
  lanternFuel: number,
): TrapTick<T> {
  if (trap.state === 'spent') return { trap, enemies: [...enemies], sprung: false }

  let t = trap
  let sprung = false
  if (t.state === 'armed') {
    if (enemies.every((e) => e.hp <= 0 || dist(e.pos, t.pos) > TRAP_TRIGGER_RADIUS_M)) {
      return { trap, enemies: [...enemies], sprung: false }
    }
    t = { ...t, state: 'burning' }
    sprung = true
  }

  // Never burn longer than the time that remains, so total damage is exactly dps x duration.
  const slice = Math.min(Math.max(0, dt), t.burnLeft)
  const dps = WEAPON_MAP['lantern-trap'].damage
  const result = resolveBlast(t.pos, TRAP_BURN_RADIUS_M, dps * slice, enemies, {
    lanternFuel,
    source: 'lantern-trap',
  })
  const burnLeft = t.burnLeft - slice
  return {
    trap: { ...t, burnLeft, state: burnLeft <= 0 ? 'spent' : 'burning' },
    enemies: result.enemies,
    sprung,
  }
}

// ---------------------------------------------------------------------------
// Salt circle (Req 3.6)
// ---------------------------------------------------------------------------
export interface SaltCircle {
  id: string
  pos: Vec2
  /** Seconds until the salt scatters. */
  remaining: number
}

export const createSaltCircle = (id: string, pos: Vec2): SaltCircle => ({
  id,
  pos,
  remaining: WEAPON_MAP['salt-circle'].duration ?? 0,
})

/** Ticks all circles and drops expired ones. */
export function tickSaltCircles(circles: readonly SaltCircle[], dt: number): SaltCircle[] {
  return circles
    .map((c) => ({ ...c, remaining: c.remaining - Math.max(0, dt) }))
    .filter((c) => c.remaining > 0)
}

/** Pushes a point that is inside any circle out to its rim, radially. */
export function keepOutOfSalt(p: Vec2, circles: readonly SaltCircle[]): Vec2 {
  const r = WEAPON_MAP['salt-circle'].radius ?? 0
  let out = p
  for (const c of circles) {
    const dx = out.x - c.pos.x
    const dz = out.z - c.pos.z
    const d = Math.hypot(dx, dz)
    if (d >= r) continue
    // Dead centre has no direction; any rim point will do.
    out = d < 1e-6 ? { x: c.pos.x + r, z: c.pos.z } : { x: c.pos.x + (dx / d) * r, z: c.pos.z + (dz / d) * r }
  }
  return out
}

/** Applies the barrier to every zombie; returns the same array when nothing moved. */
export function constrainToSalt<T extends { pos: Vec2 }>(
  enemies: readonly T[],
  circles: readonly SaltCircle[],
): readonly T[] {
  if (circles.length === 0) return enemies
  let changed = false
  const next = enemies.map((e) => {
    const pos = keepOutOfSalt(e.pos, circles)
    if (pos === e.pos) return e
    changed = true
    return { ...e, pos }
  })
  return changed ? next : enemies
}
