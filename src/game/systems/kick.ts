// Kick: a stamina move that hits the nearest zombie in the melee cone.
// Pure: no React / three.js. Requirements 9.1, 9.2, 9.3, 9.7, 9.8, 9.10.
import { KICK } from '../../data/combatMoves'
import { MELEE_ARC_DEG, MELEE_RANGE_M } from '../../data/balance'
import { applyDamage, meleeHits, type DamageContext, type Vec2 } from './combat'
import type { AIEnemy } from './enemyAI'
import { applyStagger } from './knockdown'
import type { SegmentBlocked } from './navigation'

/** The push moves in steps this long and stops at the last free one (design: Kick). */
export const KICK_PUSH_STEP_M = 0.5

/** Needs the stamina and no cooldown; a failed press changes nothing (Req 9.7). */
export const canKick = (stamina: number, cooldownLeftS: number): boolean =>
  stamina >= KICK.staminaCost && !(cooldownLeftS > 0)

export interface KickResult<T> {
  enemies: T[]
  /** Null when nothing was in the cone: the stamina is still spent (Req 9.8). */
  targetUid: string | null
  killed: boolean
}

export function resolveKick<T extends AIEnemy>(
  origin: Vec2,
  dir: Vec2,
  enemies: readonly T[],
  ctx: DamageContext,
  blocked?: SegmentBlocked,
): KickResult<T> {
  const hits = meleeHits(origin, dir, MELEE_ARC_DEG, MELEE_RANGE_M, enemies)
  let target: T | undefined
  let best = Infinity
  for (const e of enemies) {
    if (!hits.includes(e.uid)) continue
    const d = Math.hypot(e.pos.x - origin.x, e.pos.z - origin.z)
    if (d < best) {
      best = d
      target = e
    }
  }
  if (!target) return { enemies: [...enemies], targetUid: null, killed: false }

  const uid = target.uid
  const hurt = applyDamage(target, KICK.damage, { ...ctx, source: 'melee' })
  const killed = hurt.hp <= 0
  let result: T = hurt
  if (!killed) {
    result = applyStagger(result, KICK.staggerS)
    // Brutes and Father Crane are never pushed (Req 9.2, 9.3).
    if (target.type !== 'brute' && target.type !== 'father-crane') {
      result = { ...result, pos: pushed(result.pos, origin, dir, blocked) }
    }
  }
  return {
    enemies: enemies.map((e) => (e.uid === uid ? result : e)),
    targetUid: uid,
    killed,
  }
}

function pushed(from: Vec2, origin: Vec2, dir: Vec2, blocked?: SegmentBlocked): Vec2 {
  let dx = from.x - origin.x
  let dz = from.z - origin.z
  let len = Math.hypot(dx, dz)
  if (len === 0) {
    dx = dir.x
    dz = dir.z
    len = Math.hypot(dx, dz)
  }
  if (len === 0) return from
  const ux = dx / len
  const uz = dz / len
  let pos = from
  const steps = Math.round(KICK.pushM / KICK_PUSH_STEP_M)
  for (let i = 1; i <= steps; i++) {
    const next = { x: from.x + ux * KICK_PUSH_STEP_M * i, z: from.z + uz * KICK_PUSH_STEP_M * i }
    if (blocked?.(pos, next)) break
    pos = next
  }
  return pos
}
