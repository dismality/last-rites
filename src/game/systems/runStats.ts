// Run statistics shown after an ending (Req 6.2). Pure and immutable.

import { STAGE_COUNT } from '../../data/stages'
import { ENEMIES, type EnemyId } from '../../data/enemies'
import type { EndingId } from '../types'

export interface RunStats {
  nightsSurvived: number
  /** Always the sum of `kills`; kept as its own field for the older callers. */
  zombiesBanished: number
  kills: Record<EnemyId, number>
  meleeHits: number
  shotsFired: number
  shotsHit: number
  bestCombo: number
  timeS: number
  coinsEarned: number
  coinsSpent: number
  digs: number
  boardsNailed: number
}

export interface SummaryRow {
  label: string
  value: string
}

const ENEMY_IDS: readonly EnemyId[] = ENEMIES.map((e) => e.id)

const isEnemyId = (v: unknown): v is EnemyId =>
  typeof v === 'string' && (ENEMY_IDS as readonly string[]).includes(v)

/** A count the tracker may add: a finite number above zero. Anything else is ignored (Req 3.9). */
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export function createRunStats(): RunStats {
  const kills = {} as Record<EnemyId, number>
  for (const id of ENEMY_IDS) kills[id] = 0
  return {
    nightsSurvived: 0,
    zombiesBanished: 0,
    kills,
    meleeHits: 0,
    shotsFired: 0,
    shotsHit: 0,
    bestCombo: 0,
    timeS: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    digs: 0,
    boardsNailed: 0,
  }
}

export function recordBanished(s: RunStats): RunStats {
  return { ...s, zombiesBanished: s.zombiesBanished + 1 }
}

/** Unknown or missing enemy ids leave the stats untouched. */
export function recordKill(s: RunStats, enemy: EnemyId): RunStats {
  if (!isEnemyId(enemy)) return s
  return {
    ...s,
    kills: { ...s.kills, [enemy]: s.kills[enemy] + 1 },
    zombiesBanished: s.zombiesBanished + 1,
  }
}

export const recordMeleeHit = (s: RunStats): RunStats => ({ ...s, meleeHits: s.meleeHits + 1 })

/** Hits can never exceed shots, so a hit is only counted together with its shot. */
export function recordShot(s: RunStats, hit: boolean): RunStats {
  return {
    ...s,
    shotsFired: s.shotsFired + 1,
    shotsHit: s.shotsHit + (hit === true ? 1 : 0),
  }
}

/** Best combo only ever rises. */
export function recordCombo(s: RunStats, combo: number): RunStats {
  return isAmount(combo) && combo > s.bestCombo ? { ...s, bestCombo: combo } : s
}

/** The caller passes only unfrozen steps, so pause never adds time. */
export const recordTime = (s: RunStats, dt: number): RunStats =>
  isAmount(dt) ? { ...s, timeS: s.timeS + dt } : s

export function recordCoins(s: RunStats, earned: number, spent: number): RunStats {
  const e = isAmount(earned) ? earned : 0
  const sp = isAmount(spent) ? spent : 0
  return e === 0 && sp === 0
    ? s
    : { ...s, coinsEarned: s.coinsEarned + e, coinsSpent: s.coinsSpent + sp }
}

export const recordDig = (s: RunStats): RunStats => ({ ...s, digs: s.digs + 1 })
export const recordBoard = (s: RunStats): RunStats => ({ ...s, boardsNailed: s.boardsNailed + 1 })

/** Dawn of night N means N nights survived. Never goes backwards (a retried night is not counted twice). */
export function recordNightSurvived(
  s: RunStats,
  night: number,
  cap: number = STAGE_COUNT,
): RunStats {
  const n = Math.min(Math.max(Math.floor(night), 0), cap)
  return n > s.nightsSurvived ? { ...s, nightsSurvived: n } : s
}

export function accuracyPercent(s: RunStats): number {
  if (s.shotsFired <= 0) return 0
  return Math.min(100, Math.floor((100 * Math.min(s.shotsHit, s.shotsFired)) / s.shotsFired))
}

const SECONDS_PER_MINUTE = 60
const SECOND_DIGITS = 2

/** "m:ss", minutes unbounded. */
export function formatTime(timeS: number): string {
  const total = Number.isFinite(timeS) ? Math.max(0, Math.floor(timeS)) : 0
  const m = Math.floor(total / SECONDS_PER_MINUTE)
  const sec = total % SECONDS_PER_MINUTE
  return `${m}:${String(sec).padStart(SECOND_DIGITS, '0')}`
}

export const formatAccuracy = (p: number): string => `${Number.isFinite(p) ? Math.floor(p) : 0}%`

const KILL_LABELS: Readonly<Record<EnemyId, string>> = {
  shambler: 'Shamblers',
  lurker: 'Lurkers',
  wailer: 'Wailers',
  bloater: 'Bloaters',
  brute: 'Brutes',
  'father-crane': 'Father Crane',
}

/** Every row of Req 3.5; an empty run shows 0 (and 0:00, 0%). */
export function statRows(
  s: RunStats,
  extra: { score: number; relics: number; endlessBest?: number; story?: boolean },
): SummaryRow[] {
  // Endless has no Father Crane and no relics, so those rows would only mislead.
  const story = extra.story !== false
  const combo = Number.isFinite(s.bestCombo) ? Math.max(1, s.bestCombo) : 1
  const rows: SummaryRow[] = [
    { label: 'Score', value: String(extra.score) },
    ...ENEMY_IDS.filter((id) => story || id !== 'father-crane').map((id) => ({
      label: `${KILL_LABELS[id]} banished`,
      value: String(s.kills[id]),
    })),
    { label: 'Accuracy', value: formatAccuracy(accuracyPercent(s)) },
    { label: 'Melee hits', value: String(s.meleeHits) },
    // The multiplier floors at x1.00; an empty run has no combo, not a x0 one.
    { label: 'Best combo', value: `×${combo.toFixed(2)}` },
    { label: 'Nights survived', value: String(s.nightsSurvived) },
    { label: 'Time survived', value: formatTime(s.timeS) },
    ...(story ? [{ label: 'Relics', value: String(extra.relics) }] : []),
    { label: 'Grave Coins earned', value: String(s.coinsEarned) },
  ]
  if (extra.endlessBest !== undefined) {
    rows.push({ label: 'Endless best', value: String(extra.endlessBest) })
  }
  return rows
}

export const serializeStats = (s: RunStats): unknown => ({ ...s, kills: { ...s.kills } })

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
const seconds = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0

/** Field by field: junk becomes the default for that field and never throws. */
export function parseStats(raw: unknown): RunStats {
  const base = createRunStats()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>
  const rawKills =
    typeof r.kills === 'object' && r.kills !== null ? (r.kills as Record<string, unknown>) : {}
  const kills = { ...base.kills }
  for (const id of ENEMY_IDS) kills[id] = count(rawKills[id])
  const shotsFired = count(r.shotsFired)
  return {
    nightsSurvived: count(r.nightsSurvived),
    zombiesBanished: count(r.zombiesBanished),
    kills,
    meleeHits: count(r.meleeHits),
    shotsFired,
    shotsHit: Math.min(count(r.shotsHit), shotsFired),
    bestCombo: seconds(r.bestCombo),
    timeS: seconds(r.timeS),
    coinsEarned: count(r.coinsEarned),
    coinsSpent: count(r.coinsSpent),
    digs: count(r.digs),
    boardsNailed: count(r.boardsNailed),
  }
}
/** Completing the rite means the last stage was survived; the Taken ending does not. */
export function finalizeStats(s: RunStats, ending: EndingId): RunStats {
  return ending === 'taken' ? s : recordNightSurvived(s, STAGE_COUNT)
}

export function summaryRows(
  s: RunStats,
  relicCount: number,
  cluesFound: number,
  totalClues: number,
): SummaryRow[] {
  return [
    { label: 'Nights survived', value: `${s.nightsSurvived} of ${STAGE_COUNT}` },
    { label: 'Zombies banished', value: String(s.zombiesBanished) },
    { label: 'Relics', value: `${relicCount} of 5` },
    { label: 'Clues found', value: `${cluesFound} of ${totalClues}` },
  ]
}
