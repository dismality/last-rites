import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENDLESS_BEST_KEY } from '../../data/modes'
import { useAchievementStore } from './achievementStore'
import { useCoinStore } from './coinStore'
import { readBest, resetEndlessSession } from './endlessBest'
import { useEndingStore } from './endingStore'
import { useProgressionStore } from './progressionStore'
import { resetRun } from './resetRun'
import { useScoreStore } from './scoreStore'
import { startEnding } from './startEnding'
import { settleEndlessDeath } from './startEnding'
import { stormRuntime } from './stormRuntime'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

let store: ReturnType<typeof memoryStorage>

beforeEach(() => {
  store = memoryStorage()
  vi.stubGlobal('localStorage', store)
  resetEndlessSession()
  useAchievementStore.getState().resetSession()
  resetRun()
})
afterEach(() => vi.unstubAllGlobals())

describe('resetRun (New Game)', () => {
  it('clears progression, score, coins and storm', () => {
    useProgressionStore.getState().patch({ score: 900, coins: 12, storm: { active: true } })
    useScoreStore.getState().patch({ combo: 2 })
    useCoinStore.getState().setPiles([{ id: 1, x: 0, z: 0, amount: 3, age: 0 }] as never)
    resetRun()
    expect(useProgressionStore.getState()).toMatchObject({ score: 0, coins: 0, storm: { active: false } })
    expect(useScoreStore.getState().combo).toBe(1)
    expect(useCoinStore.getState().piles).toEqual([])
    expect(stormRuntime.storm.active).toBe(false)
  })

  it('keeps unlocked achievements and the stored Endless best', () => {
    useAchievementStore.getState().unlock(['a-first-light'])
    useProgressionStore.getState().patch({ mode: 'endless', score: 400 })
    settleEndlessDeath()
    resetRun()
    expect(useAchievementStore.getState().unlocked).toContain('a-first-light')
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('400')
    expect(readBest()).toBe(400)
  })
})

describe('Endless death', () => {
  it('stores a higher score only', () => {
    useProgressionStore.getState().patch({ mode: 'endless', score: 500 })
    settleEndlessDeath()
    resetRun()
    useProgressionStore.getState().patch({ mode: 'endless', score: 200 })
    settleEndlessDeath()
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('500')
    resetRun()
    useProgressionStore.getState().patch({ mode: 'endless', score: 800 })
    settleEndlessDeath()
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('800')
  })

  it('settles once per run', () => {
    useProgressionStore.getState().patch({ mode: 'endless', score: 300 })
    settleEndlessDeath()
    useProgressionStore.getState().patch({ score: 999 })
    settleEndlessDeath()
    expect(store.data.get(ENDLESS_BEST_KEY)).toBe('300')
  })

  it('ignores story modes', () => {
    useProgressionStore.getState().patch({ mode: 'normal', score: 700 })
    startEnding('taken')
    expect(store.data.has(ENDLESS_BEST_KEY)).toBe(false)
    expect(useEndingStore.getState().ending).toBe('taken')
  })
})
