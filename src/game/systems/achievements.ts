import {
  ACHIEVEMENTS,
  ACHIEVEMENT_THRESHOLDS as T,
  TOAST,
} from '../../data/achievements'
import type { AchievementId, EndingId } from '../types'

/** Plain numbers and flags gathered by the glue layer; no store access here. */
export interface AchievementFacts {
  nightsSurvived: number
  digs: number
  nightHeadshotKills: number
  /** Player HP when a night was cleared, or null if no clear is being reported. */
  clearHp: number | null
  bestCombo: number
  boardsNailed: number
  pagesRead: number
  relics: number
  craneRested: boolean
  ending: EndingId | null
  endlessNight: number
  coinsSpent: number
}

export interface ToastItem {
  id: AchievementId
  name: string
}

const KNOWN_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id))

function isMet(id: AchievementId, f: AchievementFacts): boolean {
  switch (id) {
    case 'a-first-light':
      return f.nightsSurvived >= T.firstLightNights
    case 'a-grave-robber':
      return f.digs >= T.digs
    case 'a-marksman':
      return f.nightHeadshotKills >= T.headshotsPerNight
    case 'a-close-shave':
      return f.clearHp !== null && f.clearHp <= T.closeShaveHp
    case 'a-combo':
      return f.bestCombo >= T.comboCap
    case 'a-barricade':
      return f.boardsNailed >= T.boards
    case 'a-pages':
      return f.pagesRead >= T.pages
    case 'a-relics':
      return f.relics >= T.relics
    case 'a-crane':
      return f.craneRested
    case 'a-rest':
      return f.ending === 'rest'
    case 'a-endless-10':
      return f.endlessNight >= T.endlessNight
    case 'a-patron':
      return f.coinsSpent >= T.coinsSpent
  }
}

/** Newly met achievements, in table order; already unlocked ones are never returned. */
export function evaluateAchievements(
  unlocked: readonly AchievementId[],
  f: AchievementFacts,
): AchievementId[] {
  const have = new Set<AchievementId>(unlocked)
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && isMet(a.id, f)).map((a) => a.id)
}

/** Storage may hold anything, so keep only known ids and never throw. */
export function parseUnlocked(raw: string | null): AchievementId[] {
  if (raw === null) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: AchievementId[] = []
  for (const v of data) {
    if (typeof v === 'string' && KNOWN_IDS.has(v) && !out.includes(v as AchievementId)) {
      out.push(v as AchievementId)
    }
  }
  return out
}

export const serializeUnlocked = (ids: readonly AchievementId[]): string =>
  JSON.stringify(ids)

/** Shows up to `max` toasts; the rest wait in unlock order. */
export function queueToasts(
  visible: ToastItem[],
  queued: ToastItem[],
  add: ToastItem[],
  max: number = TOAST.maxVisible,
): { visible: ToastItem[]; queued: ToastItem[] } {
  const waiting = [...queued, ...add]
  const room = Math.max(0, max - visible.length)
  return {
    visible: [...visible, ...waiting.slice(0, room)],
    queued: waiting.slice(room),
  }
}
