// Stage data (spec 10, design bible §8 "Waves in the 3-stage design" and §13). Three stages,
// each one day, dusk, endless night and dawn, each wrapped around a case.
// Pure data: no logic, no side effects. The old five-night ladder rows live in waves.ts.

import type { RecipeId } from '../game/types'

export type StageNumber = 1 | 2 | 3

/** The three cases of §13. `cases.ts` (task 2.1) builds on these ids. */
export type CaseId = 'saved-by-the-bell' | 'resurrection-men' | 'sealed-catacombs'

/** A row of the §8 difficulty ladder: the old night number 1..5 whose composition is reused. */
export type LadderRow = 1 | 2 | 3 | 4 | 5

export interface StageDef {
  stage: StageNumber
  caseId: CaseId
  caseTitle: string
  /** Ladder rows in order. Waves before `LATER_ROW_FROM_WAVE` use the first, later waves the last. */
  ladderRows: readonly LadderRow[]
  /** Fog density per ladder row (same length as `ladderRows`). Fog follows the stage, not the wave. */
  fog: readonly number[]
  /** Most zombies alive at once; queued spawns wait for room. */
  aliveCap: number
  /** Stamina cap for the stage. It never rises between stages. */
  maxStamina: number
  /** Recipes that unlock at the dawn that ends this stage. */
  dawnUnlocks: readonly RecipeId[]
}

/** Waves 1..3 (index 0..2) use the first ladder row; wave 4 (index 3) onward the later row. */
export const LATER_ROW_FROM_WAVE = 4
/** Elites and chapel door attackers are possible from the fourth wave of stage 1 (Req 2.11). */
export const ELITES_FROM_WAVE = 4
export const DOOR_ATTACKERS_FROM_WAVE = 4

export const STAGE_COUNT = 3

export const STAGES: readonly StageDef[] = [
  {
    stage: 1,
    caseId: 'saved-by-the-bell',
    caseTitle: 'Saved by the Bell',
    ladderRows: [1, 2],
    fog: [0.02, 0.03],
    aliveCap: 12,
    maxStamina: 100,
    dawnUnlocks: ['r-sharpened-shovel', 'r-holy-water-flask', 'r-lantern-trap'],
  },
  {
    stage: 2,
    caseId: 'resurrection-men',
    caseTitle: 'The Resurrection Men',
    ladderRows: [3, 4],
    fog: [0.04, 0.05],
    aliveCap: 16,
    maxStamina: 90,
    dawnUnlocks: ['r-nail-bomb', 'r-blessed-rounds'],
  },
  {
    stage: 3,
    caseId: 'sealed-catacombs',
    caseTitle: 'The Sealed Catacombs',
    ladderRows: [5],
    fog: [0.06],
    aliveCap: 20,
    maxStamina: 80,
    dawnUnlocks: [],
  },
]

export const STAGE_MAP: Readonly<Record<StageNumber, StageDef>> = Object.fromEntries(
  STAGES.map((s) => [s.stage, s]),
) as Record<StageNumber, StageDef>

/** Stage that owns a ladder row (old night number 1..5). */
export function stageOfLadderRow(row: LadderRow): StageDef {
  return STAGES.find((s) => s.ladderRows.includes(row)) ?? STAGES[STAGES.length - 1]
}

/** Fog density for a ladder row, read from the stage that owns it. */
export function fogOfLadderRow(row: LadderRow): number {
  const s = stageOfLadderRow(row)
  return s.fog[s.ladderRows.indexOf(row)]
}

/** Number of ladder rows across all stages (the old five nights). */
export const LADDER_ROW_COUNT = STAGES.reduce((n, s) => n + s.ladderRows.length, 0)

/** Fog per ladder row in order, index 0 = row 1. */
export const LADDER_FOG: readonly number[] = STAGES.flatMap((s) => s.fog)

// --- Endless night pacing (design bible §8, Req 2.8) ---
/** The next wave begins this long after the previous wave's last zombie falls... */
export const WAVE_DELAY_AFTER_FALL_S = 20
/** ...or this long after the previous wave began, whichever comes first. */
export const WAVE_DELAY_AFTER_START_S = 60
/** Escalation past the last ladder row: every Nth further wave adds a Wailer or Lurker. */
export const ESCALATION_EVERY_N_WAVES = 3
/** Wrong day answers add Doubt; at most this many extra Shamblers a night (§13). */
export const DOUBT_MAX = 3
/** A zombie out of reach this long is despawned and counted as banished (Req 2.7). */
export const STUCK_DESPAWN_S = 20
/** A chasing zombie that stays within this radius of its anchor counts as out of reach. */
export const STUCK_RADIUS_M = 1
/** Only a chaser farther than this from the player can be "stuck" (one at arm's length is fighting). */
export const STUCK_MIN_PLAYER_DIST_M = 4
/** The repaired bell rings this long before each wave (Req 2.9, bell repair stage 3). */
export const WAVE_BELL_LEAD_S = 20
/** The Curse meter starts here and falls by one for each correct clue link on the case board (§11). */
export const CURSE_MAX = 10
/** Dust puffs per collapsing zombie when the case is solved (20 zombies fill the 64-puff pool). */
export const COLLAPSE_DUST_PUFFS = 3
/** A single puff per zombie when Camera shake or Flashing lights is off (or motion is reduced). */
export const COLLAPSE_DUST_PUFFS_CALM = 1
/** Relative threat of each enemy, used to compare waves. */
export const WAVE_STRENGTH_WEIGHT = { shambler: 1, wailer: 2, lurker: 2, bloater: 3, brute: 6 } as const
