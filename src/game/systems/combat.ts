// Pure combat math: swing cones, area blasts and damage modifiers.
// No React / three.js: positions are ground-plane (x, z) vectors.

import type { EnemyId } from '../../data/enemies'
import type { DamageSource, HeavyMeleeId } from '../types'
import { HEAVY_MAP } from '../../data/heavyMelee'
import { KNOCKDOWN_DAMAGE_MULT } from '../../data/combatMoves'
import {
  FLASK_WAILER_DAMAGE_MULT,
  MELEE_ARC_DEG,
  MELEE_RANGE_M,
} from '../../data/balance'

export interface Vec2 {
  x: number
  z: number
}

/** The slice of a live zombie that combat math needs. */
export interface CombatEnemy {
  /** Unique instance id (several zombies share a type). */
  uid: string
  type: EnemyId
  hp: number
  pos: Vec2
  /** Seconds of knockdown left; absent or 0 = on its feet. */
  knockdown?: number
}

export interface DamageContext {
  /** Lantern fuel as a percentage 0–100. */
  lanternFuel: number
  /** Weapon that dealt the damage; drives type-specific bonuses. */
  source?: DamageSource
  /** Heavy weapon that swung, so its per-type bonus (Sabre vs Wailer) applies. */
  weapon?: HeavyMeleeId
}

export const DEFAULT_MELEE_ARC_DEG = MELEE_ARC_DEG
export const DEFAULT_MELEE_RANGE_M = MELEE_RANGE_M

/**
 * Instance ids of living enemies inside the swing cone.
 * `arcDeg` is the full cone width, centred on `dir` (which need not be normalised).
 */
export function meleeHits(
  origin: Vec2,
  dir: Vec2,
  arcDeg: number,
  range: number,
  enemies: readonly CombatEnemy[],
): string[] {
  const dirLen = Math.hypot(dir.x, dir.z)
  if (dirLen === 0) return []
  const cosHalf = Math.cos((arcDeg / 2) * (Math.PI / 180))
  const hits: string[] = []
  for (const e of enemies) {
    if (e.hp <= 0) continue
    const dx = e.pos.x - origin.x
    const dz = e.pos.z - origin.z
    const dist = Math.hypot(dx, dz)
    if (dist > range) continue
    // Standing on the player: always in reach, angle is undefined.
    if (dist === 0) {
      hits.push(e.uid)
      continue
    }
    const cos = (dx * dir.x + dz * dir.z) / (dist * dirLen)
    if (cos >= cosHalf) hits.push(e.uid)
  }
  return hits
}

/** Instance ids of living enemies within `radius` of `center` (inclusive). */
export function aoe(center: Vec2, radius: number, enemies: readonly CombatEnemy[]): string[] {
  return enemies
    .filter((e) => e.hp > 0 && Math.hypot(e.pos.x - center.x, e.pos.z - center.z) <= radius)
    .map((e) => e.uid)
}

/** Multiplier applied to raw damage for this target and context. */
export function damageMultiplier(type: EnemyId, ctx: DamageContext, enemy?: { knockdown?: number }): number {
  // No darkness cut (spec 09, F4): running out of oil must not also make the player weaker.
  // ctx.lanternFuel stays in the context for callers and for any future light rule.
  let mult = 1
  if (type === 'wailer' && ctx.source === 'holy-water-flask') mult *= FLASK_WAILER_DAMAGE_MULT
  if (type === 'wailer' && ctx.weapon) mult *= 1 + HEAVY_MAP[ctx.weapon].wailerBonus
  if ((enemy?.knockdown ?? 0) > 0) mult *= KNOCKDOWN_DAMAGE_MULT
  return mult
}

/** Returns the enemy after taking `dmg`. HP never rises and never drops below 0. */
export function applyDamage<T extends CombatEnemy>(enemy: T, dmg: number, ctx: DamageContext): T {
  const raw = Number.isFinite(dmg) ? Math.max(0, dmg) : 0
  const dealt = raw * damageMultiplier(enemy.type, ctx, enemy)
  return { ...enemy, hp: Math.max(0, enemy.hp - dealt) }
}
