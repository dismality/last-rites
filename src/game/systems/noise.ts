// Gunfire noise (Req 6). A shot pulls zombies in range toward it and wakes close Lurkers.
// Pure TS. One trigger pull raises one NoiseEvent, however many pellets it fires.

import { NOISE } from '../../data/firearms'
import type { Vec2 } from './combat'
import type { AIEnemy, AIEvent, AIState } from './enemyAI'

export interface NoiseEvent {
  pos: Vec2
  radiusM: number
}

/**
 * States a shot cannot redirect. Attackers keep their target (Req 6.6); the dead and the
 * swelling have nothing to steer; dormant Lurkers wake instead of walking (Req 6.4).
 */
const NOISE_IGNORES: ReadonlySet<AIState> = new Set<AIState>(['dying', 'dead', 'swell', 'dormant', 'attack'])

const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z)

/** True when the shot sets this zombie's destination. */
export const noiseAffects = (e: AIEnemy, ev: NoiseEvent): boolean =>
  e.hp > 0 && !NOISE_IGNORES.has(e.state) && dist(e.pos, ev.pos) <= ev.radiusM

/** True when the shot wakes this dormant Lurker. */
const wakes = (e: AIEnemy, ev: NoiseEvent): boolean =>
  e.hp > 0 && e.type === 'lurker' && e.state === 'dormant' && dist(e.pos, ev.pos) <= NOISE.lurkerWakeM

export function applyNoise<T extends AIEnemy>(
  enemies: readonly T[],
  ev: NoiseEvent,
): { enemies: T[]; events: AIEvent[] } {
  const events: AIEvent[] = []
  const next = enemies.map((z): T => {
    if (wakes(z, ev)) {
      // Straight to lunge so the 0.8 s telegraph still plays.
      events.push({ type: 'lurkerTriggered', uid: z.uid, pos: z.pos })
      return { ...z, state: 'lunge', stateTime: 0, hitDealt: false }
    }
    if (noiseAffects(z, ev)) return { ...z, investigate: { x: ev.pos.x, z: ev.pos.z } }
    return z
  })
  return { enemies: next, events }
}
