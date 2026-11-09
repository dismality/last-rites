// Pure Bloater burst rules (Req 13.5, 13.8, 13.9, 13.10).
// The swell timer and the single burst event live in enemyAI; this resolves the damage.
import { BLOATER } from '../../data/enemies'
import { aoe, applyDamage, type CombatEnemy, type DamageContext, type Vec2 } from './combat'

export interface BurstResult<T extends CombatEnemy> {
  enemies: T[]
  /** Other zombies the burst damaged. */
  hitUids: string[]
  /** Zombies the burst took to 0 HP; a Bloater among them swells in turn (the chain). */
  killedUids: string[]
  /** Damage to the player, 0 outside the radius. Never above the player's current health. */
  playerDamage: number
}

/**
 * 25 damage to every other living zombie within 3 m of `center`, and to the player.
 * The source never damages itself, so a chain cannot loop back to a Bloater already swelling.
 * `playerHp` caps the damage so health cannot go below 0; dodge invulnerability is the caller's job.
 */
export function resolveBurst<T extends CombatEnemy>(
  center: Vec2,
  sourceUid: string,
  enemies: readonly T[],
  player: Vec2,
  ctx: DamageContext,
  playerHp: number = Infinity,
): BurstResult<T> {
  const { burstRadiusM, burstDamage } = BLOATER
  const inRange = new Set(aoe(center, burstRadiusM, enemies))
  inRange.delete(sourceUid)

  const killedUids: string[] = []
  const next = enemies.map((e) => {
    if (!inRange.has(e.uid)) return e
    const hurt = applyDamage(e, burstDamage, ctx)
    if (hurt.hp <= 0) killedUids.push(e.uid)
    return hurt
  })

  const playerClose = Math.hypot(player.x - center.x, player.z - center.z) <= burstRadiusM
  const playerDamage = playerClose ? Math.min(burstDamage, Math.max(0, playerHp)) : 0

  return { enemies: next, hitUids: [...inRange], killedUids, playerDamage }
}
