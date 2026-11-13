// Endless wave generator for the three stages (design bible §8 "Waves in the 3-stage design").
// Pure TypeScript: no React, three.js or Howler imports.

import {
  DOUBT_MAX,
  ESCALATION_EVERY_N_WAVES,
  LATER_ROW_FROM_WAVE,
  STAGE_MAP,
  STUCK_DESPAWN_S,
  STUCK_MIN_PLAYER_DIST_M,
  STUCK_RADIUS_M,
  WAVE_BELL_LEAD_S,
  WAVE_DELAY_AFTER_FALL_S,
  WAVE_DELAY_AFTER_START_S,
  WAVE_STRENGTH_WEIGHT,
  fogOfLadderRow,
  type LadderRow,
  type StageNumber,
} from '../../data/stages'
import { NIGHT_MAP, type WaveComposition } from '../../data/waves'

const KINDS = ['shambler', 'wailer', 'lurker', 'bloater', 'brute'] as const

/** Which ladder row a wave draws from, and where that row's use of the ladder begins. */
function rowFor(stage: StageNumber, waveIndex: number): { row: LadderRow; start: number; isLast: boolean } {
  const rows = STAGE_MAP[stage].ladderRows
  const laterStart = LATER_ROW_FROM_WAVE - 1
  const useLater = rows.length > 1 && waveIndex >= laterStart
  const row = useLater ? rows[rows.length - 1] : rows[0]
  return { row, start: useLater ? laterStart : 0, isLast: useLater || rows.length === 1 }
}

/** The composition a wave would have before the "never decreases" guarantee is applied. */
function rawComposition(stage: StageNumber, waveIndex: number): WaveComposition {
  const { row, start, isLast } = rowFor(stage, waveIndex)
  const waves = NIGHT_MAP[row].waves
  const i = waveIndex - start
  if (i < waves.length || !isLast) return { ...waves[Math.min(i, waves.length - 1)] }
  // Past the last ladder row: +1 shambler a wave, +1 wailer/lurker (alternating) every third wave.
  const further = i - waves.length + 1
  const extra = Math.floor(further / ESCALATION_EVERY_N_WAVES)
  const w = { ...waves[waves.length - 1] }
  w.shambler += further
  w.wailer += Math.ceil(extra / 2)
  w.lurker += Math.floor(extra / 2)
  return w
}

/**
 * Wave `waveIndex` (0-based) of a stage's night. Each count is the largest the ladder has asked
 * for so far, so no wave is ever smaller than the one before it (Req 2.5).
 */
export function stageWaveComposition(stage: StageNumber, waveIndex: number): WaveComposition {
  const last = Math.max(0, Math.floor(waveIndex))
  const out = rawComposition(stage, 0)
  for (let n = 1; n <= last; n++) {
    const w = rawComposition(stage, n)
    for (const k of KINDS) out[k] = Math.max(out[k], w[k])
  }
  return out
}

/** Weighted threat of a wave: shambler 1, wailer 2, lurker 2, bloater 3, brute 6. */
export function waveStrength(c: WaveComposition): number {
  return KINDS.reduce((sum, k) => sum + c[k] * WAVE_STRENGTH_WEIGHT[k], 0)
}

/** Most zombies alive at once in a stage; queued spawns wait for room. */
export function aliveCap(stage: StageNumber): number {
  return STAGE_MAP[stage].aliveCap
}

/** Fog follows the ladder row the wave draws from, so it only rises with the stage's later row. */
export function stageFog(stage: StageNumber, waveIndex: number): number {
  return fogOfLadderRow(rowFor(stage, Math.max(0, Math.floor(waveIndex))).row)
}

/**
 * Seconds until the next wave: 20 s after the last zombie fell or 60 s after the wave began,
 * whichever is first. `sinceLastFallS` is null while any zombie of the wave still stands.
 */
export function nextWaveDelay(sincePrevStartS: number, sinceLastFallS: number | null): number {
  const fromStart = WAVE_DELAY_AFTER_START_S - Math.max(0, sincePrevStartS)
  const fromFall = sinceLastFallS === null ? Infinity : WAVE_DELAY_AFTER_FALL_S - Math.max(0, sinceLastFallS)
  return Math.max(0, Math.min(fromStart, fromFall))
}

/** True once a zombie has been unreachable long enough to be despawned as banished. */
export function shouldDespawnStuck(outOfReachS: number): boolean {
  return outOfReachS >= STUCK_DESPAWN_S
}

export interface StuckMark {
  x: number
  z: number
  /** Seconds the zombie has stayed near (x, z) while chasing. */
  s: number
}

/**
 * Advance one zombie's out-of-reach clock. Only a chaser far from the player counts; any
 * real movement (or another state) re-anchors and resets, so fighters and waiters are safe.
 */
export function updateStuck(
  prev: StuckMark | undefined,
  pos: { x: number; z: number },
  chasing: boolean,
  distToPlayer: number,
  dt: number,
): StuckMark {
  const eligible = chasing && distToPlayer > STUCK_MIN_PLAYER_DIST_M
  if (!eligible || !prev || Math.hypot(pos.x - prev.x, pos.z - prev.z) > STUCK_RADIUS_M) {
    return { x: pos.x, z: pos.z, s: 0 }
  }
  return { ...prev, s: prev.s + Math.max(0, dt) }
}

/** True once the bell should ring for the coming wave: within 20 s of it and not yet rung. */
export function bellDue(sincePrevStartS: number, sinceLastFallS: number | null, alreadyRung: boolean): boolean {
  return !alreadyRung && nextWaveDelay(sincePrevStartS, sinceLastFallS) <= WAVE_BELL_LEAD_S
}

/** Doubt adds that many Shamblers to a night's first wave. Doubt is clamped to 0..DOUBT_MAX. */
export function addDoubt(c: WaveComposition, doubt: number): WaveComposition {
  const d = Math.min(DOUBT_MAX, Math.max(0, Math.floor(Number.isFinite(doubt) ? doubt : 0)))
  return { ...c, shambler: c.shambler + d }
}
