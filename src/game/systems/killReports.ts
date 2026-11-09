// Pure helper: which `enemyKilled` events a change of the zombie list produces.
// Every damage path (melee, thrown, trap, burst) goes through this, so a zombie that goes from
// alive to 0 HP is reported exactly once, and one that was already dead is never reported again.
import type { EnemyId } from '../../data/enemies'
import type { DamageSource, GameEvent } from '../types'

export type EnemyKilledEvent = Extract<GameEvent, { type: 'enemyKilled' }>

interface Killable {
  uid: string
  type: EnemyId
  hp: number
  elite: boolean
}

/**
 * Reports each zombie that was alive in `before` and has 0 HP in `after`.
 * `headshots` lists the uids that died to a headshot (firearms only; empty for everything else).
 */
export function killReports(
  before: readonly Killable[],
  after: readonly Killable[],
  source: DamageSource,
  headshots: ReadonlySet<string> = new Set(),
): EnemyKilledEvent[] {
  const alive = new Map(before.filter((e) => e.hp > 0).map((e) => [e.uid, e]))
  const out: EnemyKilledEvent[] = []
  const seen = new Set<string>()
  for (const e of after) {
    const was = alive.get(e.uid)
    if (!was || e.hp > 0 || seen.has(e.uid)) continue
    seen.add(e.uid)
    out.push({
      type: 'enemyKilled',
      uid: e.uid,
      enemy: was.type,
      source,
      headshot: headshots.has(e.uid),
      elite: was.elite,
    })
  }
  return out
}
