// Enemy AI: one small state machine per zombie type.
//   Shambler: rise → chase → attack → (stagger) → chase … → dying
//   Lurker:   dormant → (trigger) → lunge → attack → chase → dying
//   Wailer:   rise → keepDistance ↔ scream → dying
// Pure TS (no React / three.js / Howler). Steering is seek + separation + wall
// avoidance, routed over the waypoint graph when the direct line is blocked.
// The scene supplies wall probes (Rapier raycasts) through `ctx.blocked`.
// Requirements 4.1, 4.2, 4.3, 4.4, 4.6.

import type { AudioCueId, EnemyId } from '../../data/enemies'
import {
  BLOATER,
  ENEMY_ATTACK_DURATION_S,
  ENEMY_ATTACK_LEEWAY_M,
  ENEMY_ATTACK_WINDUP_S,
  ENEMY_DYING_S,
  ENEMY_MAP,
  ENEMY_RISE_S,
  LURKER_CHASE_SPEED,
  LURKER_FACING_HALF_ANGLE_DEG,
  LURKER_LOW_FUEL_RADIUS,
  LURKER_LOW_FUEL_THRESHOLD,
  LURKER_LUNGE_MAX_S,
  LURKER_TELEGRAPH_S,
  LURKER_TRIGGER_RADIUS,
  WAILER_BOOST_MULT,
  WAILER_BOOST_S,
  WAILER_KEEP_DISTANCE_MAX,
  WAILER_KEEP_DISTANCE_MIN,
  WAILER_PULL_RADIUS,
  WAILER_SCREAM_DURATION_S,
  WAILER_SCREAM_INTERVAL,
} from '../../data/enemies'
import { ELITE } from '../../data/elites'
import type { DoorId } from '../types'
import type { Vec2 } from './combat'
import type { StaggerEnemy } from './melee'
import { DEFAULT_GRAPH, nextTarget, type NavGraph, type SegmentBlocked } from './navigation'

export type AIState =
  | 'rise'
  | 'dormant'
  | 'chase'
  | 'lunge'
  | 'attack'
  | 'stagger'
  | 'keepDistance'
  | 'scream'
  | 'down'
  | 'swell'
  | 'dying'
  | 'dead'

/** Noise destinations count as reached inside this distance (m). */
export const INVESTIGATE_CLEAR_M = 1.2

export interface AIEnemy extends StaggerEnemy {
  /** Full health, for health bars and elite scaling. */
  maxHp: number
  elite: boolean
  speedMult: number
  damageMult: number
  /** Seconds lying down; 0 = standing. Narrows the optional field on CombatEnemy. */
  knockdown: number
  /** Gunfire destination; steers a chasing zombie until reached. */
  investigate: Vec2 | null
  /** Who this zombie is hunting; set each frame by the door director. */
  target: 'player' | DoorId
  doorAttacker: boolean
  state: AIState
  /** Seconds spent in the current state. */
  stateTime: number
  /** Seconds until the next attack may start. */
  cooldown: number
  /** Wailer only: seconds until the next scream. */
  screamTimer: number
  /** Seconds of wailer speed boost remaining. */
  boost: number
  /** True once this attack's blow has been resolved. */
  hitDealt: boolean
  /** Heading in radians, atan2(dx, dz); the scene turns the model with it. */
  yaw: number
}

export interface AIContext {
  playerPos: Vec2
  /** Unit vector of the player's look direction on the ground plane. */
  playerFacing: Vec2
  /** Lantern fuel as a percentage 0–100. */
  lanternFuel: number
  /** Positions of the other zombies, for separation. */
  neighbours?: readonly Vec2[]
  /** Segment obstruction test (Rapier raycast in the scene). */
  blocked?: SegmentBlocked
  graph?: NavGraph
  /** 1 = full, <1 = slower lunge for the reduced scare setting. */
  lungeSpeedScale?: number
  /** World points zombies stand at to hit each chapel door. */
  doors?: Record<DoorId, Vec2>
  /** Absolute speed for a zombie (the boss director sets Father Crane's); skips `speedMult`. */
  speedOverride?: (e: AIEnemy) => number | undefined
}

export type AIEvent =
  | {
      type: 'enemyAttack'
      uid: string
      enemyType: EnemyId
      damage: number
      pos: Vec2
      target: 'player' | DoorId
    }
  | { type: 'wailerScream'; uid: string; pos: Vec2 }
  | { type: 'lurkerTriggered'; uid: string; pos: Vec2 }
  | { type: 'bloaterSwell'; uid: string; pos: Vec2 }
  | { type: 'bloaterBurst'; uid: string; pos: Vec2 }
  | { type: 'enemyCollapsed'; uid: string; enemyType: EnemyId; pos: Vec2; elite: boolean }

export interface AITick {
  enemy: AIEnemy
  events: AIEvent[]
}

// Steering tuning
export const SEPARATION_RADIUS_M = 1.0
export const SEPARATION_WEIGHT = 1.5
export const WALL_PROBE_M = 1.5
const WALL_TURNS = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]

export interface CreateEnemyOptions {
  elite?: boolean
  hpMult?: number
  speedMult?: number
  damageMult?: number
}

export function createEnemy(
  uid: string,
  type: EnemyId,
  pos: Vec2,
  opts: CreateEnemyOptions = {},
): AIEnemy {
  const def = ENEMY_MAP[type]
  const elite = opts.elite ?? false
  // Elite modifiers stack on top of explicit multipliers (mode and night scaling).
  const hp = def.hp * (opts.hpMult ?? 1) * (elite ? ELITE.hpMult : 1)
  return {
    uid,
    type,
    hp,
    maxHp: hp,
    elite,
    speedMult: (opts.speedMult ?? 1) * (elite ? ELITE.speedMult : 1),
    damageMult: (opts.damageMult ?? 1) * (elite ? ELITE.damageMult : 1),
    knockdown: 0,
    investigate: null,
    target: 'player',
    doorAttacker: false,
    pos,
    stagger: 0,
    state: type === 'lurker' ? 'dormant' : 'rise',
    stateTime: 0,
    cooldown: 0,
    screamTimer: WAILER_SCREAM_INTERVAL,
    boost: 0,
    hitDealt: false,
    yaw: 0,
  }
}

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.z)
  return l === 0 ? { x: 0, z: 0 } : { x: v.x / l, z: v.z / l }
}

/** True when the player's view cone contains the enemy. */
export function playerFacingEnemy(playerPos: Vec2, facing: Vec2, enemyPos: Vec2): boolean {
  const to = norm({ x: enemyPos.x - playerPos.x, z: enemyPos.z - playerPos.z })
  const f = norm(facing)
  const cosHalf = Math.cos((LURKER_FACING_HALF_ANGLE_DEG * Math.PI) / 180)
  return to.x * f.x + to.z * f.z >= cosHalf
}

/** Lurker ambush rule (Req 4.2). */
export function lurkerShouldTrigger(e: AIEnemy, ctx: AIContext): boolean {
  const d = dist(e.pos, ctx.playerPos)
  const unseenAndClose =
    d <= LURKER_TRIGGER_RADIUS && !playerFacingEnemy(ctx.playerPos, ctx.playerFacing, e.pos)
  const lanternLow =
    ctx.lanternFuel < LURKER_LOW_FUEL_THRESHOLD * 100 && d <= LURKER_LOW_FUEL_RADIUS
  return unseenAndClose || lanternLow
}

/** Stable pseudo-random angle (radians) derived from a zombie id. */
export function uidAngle(uid: string): number {
  let h = 2166136261
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967296) * Math.PI * 2
}

/** Seek + separation + wall avoidance; returns the moved enemy. */
function moveToward(e: AIEnemy, goal: Vec2, speed: number, dt: number, ctx: AIContext): AIEnemy {
  const target = nextTarget(ctx.graph ?? DEFAULT_GRAPH, e.pos, goal, ctx.blocked)
  const seek = norm({ x: target.x - e.pos.x, z: target.z - e.pos.z })
  if (seek.x === 0 && seek.z === 0) return e

  let sx = 0
  let sz = 0
  for (const n of ctx.neighbours ?? []) {
    const d = dist(e.pos, n)
    if (d === 0) {
      // Exactly stacked: there is no direction to push along, so each zombie picks its own
      // from its id. Two stacked zombies then split apart instead of marching as one.
      const a = uidAngle(e.uid)
      sx += Math.sin(a)
      sz += Math.cos(a)
    } else if (d < SEPARATION_RADIUS_M) {
      const w = 1 - d / SEPARATION_RADIUS_M
      sx += ((e.pos.x - n.x) / d) * w
      sz += ((e.pos.z - n.z) / d) * w
    }
  }
  let dir = norm({ x: seek.x + sx * SEPARATION_WEIGHT, z: seek.z + sz * SEPARATION_WEIGHT })
  if (dir.x === 0 && dir.z === 0) dir = seek

  const clear = (d: Vec2): boolean =>
    !ctx.blocked ||
    !ctx.blocked(e.pos, { x: e.pos.x + d.x * WALL_PROBE_M, z: e.pos.z + d.z * WALL_PROBE_M })
  if (!clear(dir)) {
    let free: Vec2 | null = null
    for (const a of WALL_TURNS) {
      const c = Math.cos(a)
      const s = Math.sin(a)
      const cand = { x: dir.x * c - dir.z * s, z: dir.x * s + dir.z * c }
      if (clear(cand)) {
        free = cand
        break
      }
    }
    if (!free) return { ...e, yaw: Math.atan2(dir.x, dir.z) } // boxed in: hold position
    dir = free
  }
  return {
    ...e,
    pos: { x: e.pos.x + dir.x * speed * dt, z: e.pos.z + dir.z * speed * dt },
    yaw: Math.atan2(dir.x, dir.z),
  }
}

function face(e: AIEnemy, at: Vec2): AIEnemy {
  const dx = at.x - e.pos.x
  const dz = at.z - e.pos.z
  return dx === 0 && dz === 0 ? e : { ...e, yaw: Math.atan2(dx, dz) }
}

function enter(e: AIEnemy, state: AIState): AIEnemy {
  return { ...e, state, stateTime: 0, hitDealt: false }
}

/** State to return to after a stagger or an attack. */
function resumeState(type: EnemyId): AIState {
  return type === 'wailer' ? 'keepDistance' : 'chase'
}

function boostMult(e: AIEnemy): number {
  return e.boost > 0 ? WAILER_BOOST_MULT : 1
}

/** The door a zombie is hunting, or the player when it has no door or the door has no stand point. */
function effectiveTarget(e: AIEnemy, ctx: AIContext): 'player' | DoorId {
  return e.target !== 'player' && ctx.doors?.[e.target] ? e.target : 'player'
}

/** Where a blow must land: its door's stand point, otherwise the player. */
function attackGoalOf(e: AIEnemy, ctx: AIContext): Vec2 {
  const t = effectiveTarget(e, ctx)
  return t === 'player' ? ctx.playerPos : (ctx.doors as Record<DoorId, Vec2>)[t]
}

/** An override is an absolute speed; otherwise the type's speed scales by `speedMult`. */
function speedFor(e: AIEnemy, base: number, ctx: AIContext): number {
  return ctx.speedOverride?.(e) ?? base * e.speedMult
}

export function tickEnemy(enemy: AIEnemy, dt: number, ctx: AIContext): AITick {
  const events: AIEvent[] = []
  if (enemy.state === 'dead') return { enemy, events }

  const def = ENEMY_MAP[enemy.type]
  let e: AIEnemy = {
    ...enemy,
    stateTime: enemy.stateTime + dt,
    cooldown: Math.max(0, enemy.cooldown - dt),
    boost: Math.max(0, enemy.boost - dt),
  }

  // Death overrides every other state. A Bloater swells first; the kill is still
  // reported now (enemyCollapsed) so score and drops don't wait for the burst.
  if (e.hp <= 0 && e.state !== 'dying' && e.state !== 'swell') {
    const bloater = e.type === 'bloater'
    e = { ...enter(e, bloater ? 'swell' : 'dying'), stagger: 0, knockdown: 0 }
    if (bloater) events.push({ type: 'bloaterSwell', uid: e.uid, pos: e.pos })
    events.push({
      type: 'enemyCollapsed',
      uid: e.uid,
      enemyType: e.type,
      pos: e.pos,
      elite: e.elite,
    })
    return { enemy: e, events }
  }
  if (e.state === 'swell') {
    // Motionless and harmless until the gas goes off.
    if (e.stateTime < BLOATER.swellS) return { enemy: e, events }
    events.push({ type: 'bloaterBurst', uid: e.uid, pos: e.pos })
    return { enemy: enter(e, 'dying'), events }
  }
  if (e.state === 'dying') {
    return { enemy: e.stateTime >= ENEMY_DYING_S ? enter(e, 'dead') : e, events }
  }

  // Knockdown overrides stagger: the zombie lies still until the timer ends.
  if (e.knockdown > 0 && e.state !== 'down') {
    if (e.state === 'rise') {
      e = { ...e, knockdown: 0 }
    } else {
      if (e.state === 'dormant') {
        // A knocked-down lurker is awake, like a struck one.
        e = enter(e, 'chase')
        events.push({ type: 'lurkerTriggered', uid: e.uid, pos: e.pos })
      }
      e = { ...enter(e, 'down'), stagger: 0 }
    }
  }
  if (e.state === 'down') {
    const left = Math.max(0, e.knockdown - dt)
    e = { ...e, knockdown: left }
    return { enemy: left <= 0 ? enter(e, resumeState(e.type)) : e, events }
  }

  // Stagger (set by melee hits and flask stuns) interrupts anything except rising.
  if (e.stagger > 0) {
    if (e.state === 'rise') {
      e = { ...e, stagger: 0 }
    } else if (e.state === 'dormant') {
      // A struck lurker is awake whether it likes it or not.
      e = { ...enter(e, 'chase'), stagger: 0 }
      events.push({ type: 'lurkerTriggered', uid: e.uid, pos: e.pos })
    } else if (e.state !== 'stagger') {
      e = enter(e, 'stagger')
    }
  }
  if (e.state === 'stagger') {
    const left = Math.max(0, e.stagger - dt)
    e = { ...e, stagger: left }
    return { enemy: left <= 0 ? enter(e, resumeState(e.type)) : e, events }
  }

  const toPlayer = dist(e.pos, ctx.playerPos)

  switch (e.state) {
    case 'rise':
      if (e.stateTime >= ENEMY_RISE_S) e = enter(e, resumeState(e.type))
      break

    case 'dormant':
      if (lurkerShouldTrigger(e, ctx)) {
        e = enter(e, 'lunge')
        events.push({ type: 'lurkerTriggered', uid: e.uid, pos: e.pos })
      }
      break

    case 'lunge': {
      // Motionless breath first: the telegraph that keeps the scare fair.
      if (e.stateTime < LURKER_TELEGRAPH_S) {
        e = face(e, ctx.playerPos)
        break
      }
      if (toPlayer <= def.attackRange) {
        e = { ...enter(e, 'attack'), cooldown: def.attackCooldown }
        break
      }
      if (e.stateTime - LURKER_TELEGRAPH_S >= LURKER_LUNGE_MAX_S) {
        e = enter(e, 'chase')
        break
      }
      e = moveToward(e, ctx.playerPos, speedFor(e, def.speed * (ctx.lungeSpeedScale ?? 1), ctx), dt, ctx)
      break
    }

    case 'chase': {
      const attackGoal = attackGoalOf(e, ctx)
      const toGoal = dist(e.pos, attackGoal)
      // Noise: head for the shot until close, or until the player is in reach.
      if (e.investigate && (dist(e.pos, e.investigate) <= INVESTIGATE_CLEAR_M || toPlayer <= def.attackRange)) {
        e = { ...e, investigate: null }
      }
      if (e.investigate) {
        const base = e.type === 'lurker' ? LURKER_CHASE_SPEED : def.speed
        e = moveToward(e, e.investigate, speedFor(e, base, ctx) * boostMult(e), dt, ctx)
      } else if (toGoal <= def.attackRange) {
        e = face(e, attackGoal)
        if (e.cooldown <= 0) e = { ...enter(e, 'attack'), cooldown: def.attackCooldown }
      } else {
        const base = e.type === 'lurker' ? LURKER_CHASE_SPEED : def.speed
        e = moveToward(e, attackGoal, speedFor(e, base, ctx) * boostMult(e), dt, ctx)
      }
      break
    }

    case 'attack': {
      const attackGoal = attackGoalOf(e, ctx)
      e = face(e, attackGoal)
      if (!e.hitDealt && e.stateTime >= ENEMY_ATTACK_WINDUP_S) {
        e = { ...e, hitDealt: true }
        // The blow whiffs if the player backed away during the wind-up. Father Crane's
        // blows belong to the boss director, so he never emits one from here.
        if (dist(e.pos, attackGoal) <= def.attackRange + ENEMY_ATTACK_LEEWAY_M && e.type !== 'father-crane') {
          events.push({
            type: 'enemyAttack',
            uid: e.uid,
            enemyType: e.type,
            damage: def.damage * e.damageMult,
            pos: e.pos,
            target: effectiveTarget(e, ctx),
          })
        }
      }
      if (e.stateTime >= ENEMY_ATTACK_DURATION_S) e = enter(e, 'chase')
      break
    }

    case 'keepDistance': {
      const screamTimer = e.screamTimer - dt
      e = { ...e, screamTimer }
      if (screamTimer <= 0) {
        e = enter(e, 'scream')
        events.push({ type: 'wailerScream', uid: e.uid, pos: e.pos })
        break
      }
      const speed = speedFor(e, def.speed, ctx) * boostMult(e)
      if (toPlayer < WAILER_KEEP_DISTANCE_MIN) {
        const away = norm({ x: e.pos.x - ctx.playerPos.x, z: e.pos.z - ctx.playerPos.z })
        const retreat = { x: e.pos.x + away.x * 10, z: e.pos.z + away.z * 10 }
        e = moveToward(e, retreat, speed, dt, ctx)
      } else if (toPlayer > WAILER_KEEP_DISTANCE_MAX) {
        e = moveToward(e, ctx.playerPos, speed, dt, ctx)
      } else {
        e = face(e, ctx.playerPos)
      }
      break
    }

    case 'scream':
      e = face(e, ctx.playerPos)
      if (e.stateTime >= WAILER_SCREAM_DURATION_S) {
        e = { ...enter(e, 'keepDistance'), screamTimer: WAILER_SCREAM_INTERVAL }
      }
      break
  }

  return { enemy: e, events }
}

/**
 * A scream drives every awake zombie in range toward the player faster for 3 s.
 * Zombies already hunt the player, so the pull shows up as the speed boost.
 * Dormant lurkers stay put: their ambush belongs to the scare design.
 */
export function applyWailerScream(
  enemies: readonly AIEnemy[],
  source: Vec2,
  sourceUid: string,
): AIEnemy[] {
  return enemies.map((z) => {
    if (z.uid === sourceUid) return z
    if (z.state === 'dormant' || z.state === 'dying' || z.state === 'dead') return z
    if (z.state === 'down' || z.state === 'swell') return z
    if (dist(z.pos, source) > WAILER_PULL_RADIUS) return z
    return { ...z, boost: WAILER_BOOST_S }
  })
}

/**
 * Which looping audio signature (Req 4.4) a zombie is emitting right now, if any.
 * Lurkers are silent until they trigger: silence is their tell.
 */
export function loopCue(e: AIEnemy): AudioCueId | null {
  if (e.state === 'dormant' || e.state === 'dying' || e.state === 'dead') return null
  if (e.state === 'down' || e.state === 'swell') return null
  if (e.state === 'rise') return null
  return ENEMY_MAP[e.type].audio
}

/** Ticks the whole horde, applies scream pulls and drops finished corpses. */
export function tickEnemies(
  enemies: readonly AIEnemy[],
  dt: number,
  ctx: AIContext,
): { enemies: AIEnemy[]; events: AIEvent[] } {
  const events: AIEvent[] = []
  let next = enemies.map((z) => {
    const neighbours = enemies.filter((o) => o.uid !== z.uid && o.state !== 'dead').map((o) => o.pos)
    const r = tickEnemy(z, dt, { ...ctx, neighbours })
    events.push(...r.events)
    return r.enemy
  })
  for (const ev of events) {
    if (ev.type === 'wailerScream') next = applyWailerScream(next, ev.pos, ev.uid)
  }
  return { enemies: next.filter((z) => z.state !== 'dead'), events }
}
