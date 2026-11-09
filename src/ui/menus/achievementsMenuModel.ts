// Pure view-model for the Achievements menu (no DOM, testable in Node).
import { ACHIEVEMENTS } from '../../data/achievements'
import type { AchievementId } from '../../game/types'

export interface AchievementEntry {
  id: AchievementId
  name: string
  goal: string
  unlocked: boolean
  /** "Locked" text so locked state is never shown by dimming alone. */
  tag: string | null
}

export interface AchievementsMenuModel {
  /** False while a major scare is active: the menu stays closed until it ends. */
  open: boolean
  /** Shown instead of the menu while it is held closed. */
  notNow: string | null
  entries: AchievementEntry[]
}

export const LOCKED_TAG = 'Locked'
export const NOT_NOW_TEXT = 'Not now'

export function achievementsMenuModel(
  unlocked: readonly AchievementId[],
  majorScareActive: boolean,
): AchievementsMenuModel {
  const have = new Set(unlocked)
  const entries = ACHIEVEMENTS.map((a) => {
    const isUnlocked = have.has(a.id)
    return { id: a.id, name: a.name, goal: a.goal, unlocked: isUnlocked, tag: isUnlocked ? null : LOCKED_TAG }
  })
  return majorScareActive
    ? { open: false, notNow: NOT_NOW_TEXT, entries }
    : { open: true, notNow: null, entries }
}
