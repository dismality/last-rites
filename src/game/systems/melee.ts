// Pure melee swing logic: timing, hit resolution, stagger, camera shake and dust.
// No React / three.js. The scene layer feeds it input and renders the results.
// Requirements 2.1, 2.2, 2.3.
import type { Vec2, CombatEnemy, DamageContext } from './combat'
import { applyDamage, meleeHits } from './combat'
import { MELEE_ARC_DEG, MELEE_RANGE_M } from '../../data/balance'

/** Hits are checked halfway through the swing, when the weapon is at full extension. */
export const SWING_HIT_POINT = 0.5
/** A struck zombie cannot act for this long (Req 2.2). */
export const STAGGER_S = 0.3
/** Peak shake offset in metres; small on purpose (Req 2.3). */
export const HIT_SHAKE_AMPLITUDE = 0.025
export const HIT_SHAKE_DURATION_S = 0.18
export const DUST_PER_HIT = 8
export const DUST_LIFETIME_S = 0.7

// ---------------------------------------------------------------------------
// Swing timing
// ---------------------------------------------------------------------------
export interface SwingState {
  elapsed: number
  /** Total swing length; equals the weapon cooldown so the next swing is available as it ends. */
  duration: number
  /** True once the midpoint hit check has fired. */
  hitFired: boolean
}

export function startSwing(cooldown: number): SwingState {
  return { elapsed: 0, duration: Math.max(0.05, cooldown), hitFired: false }
}

export interface SwingTick {
  /** Null once the swing has finished. */
  swing: SwingState | null
  /** True on exactly the tick that crosses the midpoint. */
  hit: boolean
}

export function tickSwing(s: SwingState, dt: number): SwingTick {
  const elapsed = s.elapsed + Math.max(0, dt)
  const crossed = !s.hitFired && elapsed / s.duration >= SWING_HIT_POINT
  if (elapsed >= s.duration) return { swing: null, hit: crossed }
  return { swing: { ...s, elapsed, hitFired: s.hitFired || crossed }, hit: crossed }
}

export function swingProgress(s: SwingState): number {
  return Math.min(1, s.elapsed / s.duration)
}

export interface SwingPose {
  /** Pitch of the item (rad). Negative = raised back, positive = chopped forward. */
  rotX: number
  /** Roll of the item (rad), a diagonal slash. */
  rotZ: number
  /** Offset in the viewmodel's local space (m). */
  x: number
  y: number
  z: number
}

export const REST_POSE: SwingPose = { rotX: 0, rotZ: 0, x: 0, y: 0, z: 0 }

const smooth = (p: number): number => p * p * (3 - 2 * p)

/**
 * Wind-up (0 to 0.3), fast strike peaking at the midpoint hit (0.3 to 0.5),
 * then a damped recovery. Closed-form so it needs no integration state.
 */
export function swingPose(progress: number): SwingPose {
  const p = Math.min(1, Math.max(0, progress))
  let t: number // -1 = fully wound back, +1 = fully extended
  if (p < 0.3) t = -smooth(p / 0.3)
  else if (p < SWING_HIT_POINT) t = -1 + 2 * smooth((p - 0.3) / (SWING_HIT_POINT - 0.3))
  else {
    // Damped spring back to rest from the extended pose.
    const r = (p - SWING_HIT_POINT) / (1 - SWING_HIT_POINT)
    t = Math.exp(-5 * r) * Math.cos(6 * r)
  }
  return { rotX: t * 0.9, rotZ: -t * 0.35, x: -t * 0.06, y: t * -0.05, z: t * -0.12 }
}

// ---------------------------------------------------------------------------
// Hit resolution
// ---------------------------------------------------------------------------
/** A live zombie as combat sees it, plus the stagger timer. */
export interface StaggerEnemy extends CombatEnemy {
  /** Seconds of stagger remaining; 0 = free to act. */
  stagger: number
}

export interface MeleeResolution<T extends StaggerEnemy> {
  enemies: T[]
  hitUids: string[]
  killedUids: string[]
}

export function resolveMelee<T extends StaggerEnemy>(
  origin: Vec2,
  dir: Vec2,
  damage: number,
  enemies: readonly T[],
  ctx: DamageContext,
): MeleeResolution<T> {
  const hitUids = meleeHits(origin, dir, MELEE_ARC_DEG, MELEE_RANGE_M, enemies)
  const hitSet = new Set(hitUids)
  const killedUids: string[] = []
  const next = enemies.map((e) => {
    if (!hitSet.has(e.uid)) return e
    const hurt = applyDamage(e, damage, { ...ctx, source: 'melee' })
    if (hurt.hp <= 0) killedUids.push(e.uid)
    return { ...hurt, stagger: STAGGER_S }
  })
  return { enemies: next, hitUids, killedUids }
}

/** Counts stagger timers down; returns the same array when nothing is staggered. */
export function tickStagger<T extends StaggerEnemy>(enemies: readonly T[], dt: number): readonly T[] {
  if (!enemies.some((e) => e.stagger > 0)) return enemies
  return enemies.map((e) => (e.stagger > 0 ? { ...e, stagger: Math.max(0, e.stagger - dt) } : e))
}

// ---------------------------------------------------------------------------
// Camera shake
// ---------------------------------------------------------------------------
/** Shake is skipped when the setting is off or the OS asks for reduced motion. */
export function shakeAllowed(settingEnabled: boolean, reducedMotion: boolean): boolean {
  return settingEnabled && !reducedMotion
}

/** Linear decay from the peak to 0 over the duration; `age` in seconds. */
export function shakeMagnitude(age: number): number {
  if (age < 0 || age >= HIT_SHAKE_DURATION_S) return 0
  return HIT_SHAKE_AMPLITUDE * (1 - age / HIT_SHAKE_DURATION_S)
}

// ---------------------------------------------------------------------------
// Dust
// ---------------------------------------------------------------------------
export interface DustParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
}

/** `rand` returns [0,1); injected so tests and the scene can pick their source. */
export function spawnDust(at: { x: number; y: number; z: number }, rand: () => number): DustParticle[] {
  return Array.from({ length: DUST_PER_HIT }, () => ({
    x: at.x,
    y: at.y,
    z: at.z,
    vx: (rand() - 0.5) * 1.6,
    vy: 0.3 + rand() * 0.9,
    vz: (rand() - 0.5) * 1.6,
    age: 0,
  }))
}

export function tickDust(ps: readonly DustParticle[], dt: number): DustParticle[] {
  const out: DustParticle[] = []
  for (const p of ps) {
    const age = p.age + dt
    if (age >= DUST_LIFETIME_S) continue
    // Drag makes the puff hang in the air rather than fly off.
    const drag = Math.exp(-2.5 * dt)
    out.push({
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      z: p.z + p.vz * dt,
      vx: p.vx * drag,
      vy: p.vy * drag - 0.4 * dt,
      vz: p.vz * drag,
      age,
    })
  }
  return out
}

/** Ground-plane forward direction for a yaw (yaw 0 looks down -Z, positive turns left). */
export function forwardFromYaw(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) }
}
