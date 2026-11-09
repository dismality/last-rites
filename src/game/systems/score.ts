// Pure score and combo rules (design bible §12 "Score and combo"). No React, three.js or Howler.
import type { EnemyId } from '../../data/enemies'
import {
  BOSS_POINTS,
  COMBO,
  ELITE_POINTS_MULT,
  HEADSHOT_BONUS,
  KILL_POINTS,
  NIGHT_SCORE,
} from '../../data/scoring'

export interface ScoreState {
  score: number
  bossScored: boolean
  combo: number
  /** Sim-clock time of the last counted kill; null when no combo is running. */
  lastKillAt: number | null
  seen: readonly string[]
  nightKillPoints: number
}

export interface KillInput {
  uid: string
  enemy: EnemyId
  elite: boolean
  headshot: boolean
}

export interface KillResult {
  state: ScoreState
  points: number
  comboRaised: boolean
  counted: boolean
}

export interface NightScore {
  kill: number
  clear: number
  noDamage: number
  total: number
}

export const INITIAL_SCORE_STATE: ScoreState = {
  score: 0,
  bossScored: false,
  combo: COMBO.base,
  lastKillAt: null,
  seen: [],
  nightKillPoints: 0,
}

const ignored = (state: ScoreState): KillResult => ({
  state,
  points: 0,
  comboRaised: false,
  counted: false,
})

/** Combo after a counted kill at `now`: raised inside the window, otherwise back to base. */
function nextCombo(s: ScoreState, now: number): number {
  const inWindow = s.lastKillAt !== null && now - s.lastKillAt <= COMBO.windowS
  return inWindow ? Math.min(COMBO.cap, s.combo + COMBO.step) : COMBO.base
}

export function applyKill(s: ScoreState, k: KillInput, now: number, scoreMult: number): KillResult {
  // Events come from a bus, so a malformed one must be a no-op rather than a crash or NaN score.
  if (
    typeof k !== 'object' ||
    k === null ||
    typeof k.uid !== 'string' ||
    typeof k.enemy !== 'string' ||
    typeof k.elite !== 'boolean' ||
    typeof k.headshot !== 'boolean' ||
    !Number.isFinite(now) ||
    !Number.isFinite(scoreMult)
  ) {
    return ignored(s)
  }
  if (!Object.prototype.hasOwnProperty.call(KILL_POINTS, k.enemy) || s.seen.includes(k.uid))
    return ignored(s)

  const base = KILL_POINTS[k.enemy as keyof typeof KILL_POINTS]
  const combo = nextCombo(s, now)
  const points = Math.round(
    (base * (k.elite ? ELITE_POINTS_MULT : 1) + (k.headshot ? HEADSHOT_BONUS : 0)) *
      combo *
      scoreMult,
  )
  return {
    state: {
      ...s,
      score: s.score + points,
      combo,
      lastKillAt: now,
      seen: [...s.seen, k.uid],
      nightKillPoints: s.nightKillPoints + points,
    },
    points,
    comboRaised: combo > s.combo,
    counted: true,
  }
}

/** Father Crane's 1000 points, paid once per run through the same combo path as a kill. */
export function applyBoss(s: ScoreState, now: number, scoreMult: number): KillResult {
  if (s.bossScored || !Number.isFinite(now) || !Number.isFinite(scoreMult)) return ignored(s)
  const combo = nextCombo(s, now)
  const points = Math.round(BOSS_POINTS * combo * scoreMult)
  return {
    state: {
      ...s,
      score: s.score + points,
      bossScored: true,
      combo,
      lastKillAt: now,
      nightKillPoints: s.nightKillPoints + points,
    },
    points,
    comboRaised: combo > s.combo,
    counted: true,
  }
}

/** Resets the combo once more than the window has passed without a counted kill. */
export function tickCombo(s: ScoreState, now: number): ScoreState {
  if (s.lastKillAt === null || now - s.lastKillAt <= COMBO.windowS) return s
  return { ...s, combo: COMBO.base, lastKillAt: null }
}

export function nightScore(
  s: ScoreState,
  night: number,
  damageTaken: number,
  scoreMult: number,
): NightScore {
  const kill = s.nightKillPoints
  const clear = Math.round(NIGHT_SCORE.clearPerNight * night * scoreMult)
  const noDamage = damageTaken === 0 ? Math.round(NIGHT_SCORE.noDamageBonus * scoreMult) : 0
  return { kill, clear, noDamage, total: kill + clear + noDamage }
}

export const comboView = (
  s: ScoreState,
  now: number,
): { visible: boolean; text: string; barFraction: number } => {
  const visible = s.combo > COMBO.base
  const elapsed = s.lastKillAt === null ? COMBO.windowS : now - s.lastKillAt
  const barFraction = Math.min(1, Math.max(0, 1 - elapsed / COMBO.windowS))
  return { visible, text: visible ? `×${s.combo.toFixed(2)}` : '', barFraction }
}
