// Achievements: the unlocked set (own localStorage key, never in the run snapshot), plus the
// parchment toasts on screen and waiting. Pure zustand. Requirements 8.2, 8.8-8.10, 11.2.
import { create } from 'zustand'
import { ACHIEVEMENTS, ACHIEVEMENTS_KEY } from '../../data/achievements'
import { emit } from '../events'
import {
  parseUnlocked,
  queueToasts,
  serializeUnlocked,
  type ToastItem,
} from '../systems/achievements'
import type { AchievementId } from '../types'

/** How long the "[achievement: NAME]" subtitle stays up. */
export const ACHIEVEMENT_SUBTITLE_S = 3

function readStored(): AchievementId[] {
  try {
    return parseUnlocked(localStorage.getItem(ACHIEVEMENTS_KEY))
  } catch {
    return []
  }
}

interface AchievementStoreState {
  unlocked: AchievementId[]
  visible: ToastItem[]
  queued: ToastItem[]
  /** Adds new ids (never removes), tries to persist, then toasts and captions each one. */
  unlock: (ids: readonly AchievementId[]) => void
  /** Drops a toast once its time is up and brings the next waiting one on screen. */
  dismiss: (id: AchievementId) => void
  /** Clears toasts and re-reads storage. Not tied to a run: unlocks outlive New Game. */
  resetSession: () => void
}

export const useAchievementStore = create<AchievementStoreState>((set, get) => ({
  unlocked: readStored(),
  visible: [],
  queued: [],
  unlock: (ids) => {
    const have = new Set<AchievementId>(get().unlocked)
    const fresh: AchievementId[] = []
    for (const id of ids) {
      if (!have.has(id)) {
        have.add(id)
        fresh.push(id)
      }
    }
    if (fresh.length === 0) return
    const unlocked = [...get().unlocked, ...fresh]
    // A failed write must not lose the unlock for this session or stop the toast.
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, serializeUnlocked(unlocked))
    } catch {
      /* storage unavailable or full */
    }
    const items: ToastItem[] = fresh.map((id) => ({
      id,
      name: ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id,
    }))
    const next = queueToasts(get().visible, get().queued, items)
    set({ unlocked, visible: next.visible, queued: next.queued })
    for (const item of items) {
      emit({
        type: 'subtitleShown',
        text: `[achievement: ${item.name}]`,
        duration: ACHIEVEMENT_SUBTITLE_S,
      })
    }
  },
  dismiss: (id) => {
    const rest = get().visible.filter((t) => t.id !== id)
    const next = queueToasts(rest, get().queued, [])
    set({ visible: next.visible, queued: next.queued })
  },
  resetSession: () => set({ unlocked: readStored(), visible: [], queued: [] }),
}))
