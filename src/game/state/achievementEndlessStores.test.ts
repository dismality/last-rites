import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACHIEVEMENTS_KEY } from '../../data/achievements'
import { ENDLESS_BEST_KEY } from '../../data/modes'
import { useAchievementStore } from './achievementStore'
import { readBest, resetEndlessSession, settleEndless } from './endlessBest'

function memoryStorage(throws = false) {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => {
      if (throws) throw new Error('denied')
      return data.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new Error('denied')
      data.set(k, v)
    },
  }
}

beforeEach(() => {
  resetEndlessSession()
})
afterEach(() => {
  vi.unstubAllGlobals()
  useAchievementStore.getState().resetSession()
})

describe('achievementStore', () => {
  it('survives a throwing localStorage and still shows the unlock', () => {
    vi.stubGlobal('localStorage', memoryStorage(true))
    useAchievementStore.getState().resetSession()
    expect(() => useAchievementStore.getState().unlock(['a-first-light'])).not.toThrow()
    const s = useAchievementStore.getState()
    expect(s.unlocked).toContain('a-first-light')
    expect(s.visible.map((t) => t.id)).toEqual(['a-first-light'])
  })

  it('persists, ignores repeats and queues past three toasts', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)
    useAchievementStore.getState().resetSession()
    useAchievementStore.getState().unlock(['a-first-light', 'a-combo', 'a-rest', 'a-crane'])
    useAchievementStore.getState().unlock(['a-first-light'])
    const s = useAchievementStore.getState()
    expect(s.visible).toHaveLength(3)
    expect(s.queued).toHaveLength(1)
    expect(JSON.parse(store.data.get(ACHIEVEMENTS_KEY) ?? '[]')).toHaveLength(4)
    s.dismiss('a-first-light')
    expect(useAchievementStore.getState().queued).toHaveLength(0)
    expect(useAchievementStore.getState().visible).toHaveLength(3)
  })
})

describe('endlessBest', () => {
  it('stores the best only when higher', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)
    settleEndless(500, 1)
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('500')
    settleEndless(300, 2)
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('500')
    settleEndless(900, 3)
    expect(readBest()).toBe(900)
  })

  it('reads a hostile stored value as 0', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)
    for (const bad of ['-5', 'NaN', 'Infinity', '{"a":1}', '1e999', '']) {
      store.data.set(ENDLESS_BEST_KEY, bad)
      expect(readBest()).toBe(0)
    }
  })

  it('keeps the higher best in the session when storage throws', () => {
    vi.stubGlobal('localStorage', memoryStorage(true))
    expect(() => settleEndless(700, 1)).not.toThrow()
    expect(readBest()).toBe(700)
  })

  it('settles once per runId', () => {
    const store = memoryStorage()
    vi.stubGlobal('localStorage', store)
    settleEndless(100, 7)
    settleEndless(999, 7)
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('100')
    settleEndless(999, 8)
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('999')
  })
})
