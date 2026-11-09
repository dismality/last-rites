// Score numbers mirrored from docs/game-design.md §12 "Score and combo".
import type { WaveEnemyId } from './enemies'

export const KILL_POINTS: Readonly<Record<WaveEnemyId, number>> = {
  shambler: 10,
  wailer: 25,
  lurker: 30,
  bloater: 30,
  brute: 75,
}

export const BOSS_POINTS = 1000
export const ELITE_POINTS_MULT = 2
export const HEADSHOT_BONUS = 5

export const COMBO = { step: 0.25, cap: 3.0, windowS: 4, base: 1.0 } as const

export const NIGHT_SCORE = { clearPerNight: 100, noDamageBonus: 200 } as const
