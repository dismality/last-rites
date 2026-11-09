// Pure helper: which `meleeHit` events a resolved swing produces (Req 6.4).
// Kept apart from MeleeAttack.tsx so it can be tested in Node.
import type { GameEvent } from '../../game/types'

export type MeleeHitEvent = Extract<GameEvent, { type: 'meleeHit' }>

/** Kicks are counted elsewhere as their own move, so they never count as a melee hit. */
export type StrikeKind = 'melee' | 'heavy' | 'kick'

/** One event per distinct zombie struck by the swing, in first-seen order. */
export function meleeHitEvents(hitUids: readonly string[], kind: StrikeKind): MeleeHitEvent[] {
  if (kind === 'kick') return []
  return [...new Set(hitUids)].map((uid) => ({ type: 'meleeHit', uid }))
}
