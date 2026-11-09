// Stagger and knockdown rules. Pure: no React / three.js.
// Requirements 8.6, 8.7, 8.8, 9.2, 9.3, 14.3, 14.4, 14.5, 14.6, 17.11.
import type { EnemyId } from '../../data/enemies'
import { KICK, KNOCKDOWN_DAMAGE_MULT } from '../../data/combatMoves'
import { SHOTGUN_BRUTE_KNOCKDOWN } from '../../data/firearms'
import type { StaggerEnemy } from './melee'

/** Father Crane ignores every control effect; only damage reaches him (Req 17.11). */
const isImmune = (type: EnemyId): boolean => type === 'father-crane'

/**
 * Puts a zombie on the ground. The timer is reset to `durationS`, never extended,
 * so a second hit cannot chain a zombie into a permanent lock (Req 8.6).
 */
export function applyKnockdown<T extends StaggerEnemy>(e: T, durationS: number): T {
  if (isImmune(e.type)) return e
  const s = Number.isFinite(durationS) ? Math.max(0, durationS) : 0
  return { ...e, knockdown: s }
}

/** Short stun. A Brute never staggers longer than 0.3 s; Crane not at all (Req 14.3, 9.3). */
export function applyStagger<T extends StaggerEnemy>(e: T, s: number): T {
  if (isImmune(e.type)) return e
  const raw = Number.isFinite(s) ? Math.max(0, s) : 0
  const stagger = e.type === 'brute' ? Math.min(raw, KICK.bruteStaggerS) : raw
  return { ...e, stagger }
}

/** +25% damage taken while on the ground (Req 8.7). */
export const knockdownDamageMult = (e: { knockdown?: number }): number =>
  (e.knockdown ?? 0) > 0 ? KNOCKDOWN_DAMAGE_MULT : 1

/** A shotgun blast knocks a Brute down only from 3 m or closer (Req 14.4). */
export const shotKnocksDown = (type: EnemyId, nearestM: number): boolean =>
  type === 'brute' && nearestM <= SHOTGUN_BRUTE_KNOCKDOWN.withinM
