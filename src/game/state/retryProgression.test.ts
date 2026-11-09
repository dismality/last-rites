// Feature: progression-and-atmosphere, Property 34: Retry Night restores the snapshot and clears the night
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { COMBO } from '../../data/scoring'
import { emptySilence } from '../systems/scareSilence'
import { useCoinStore } from './coinStore'
import { currentModifiers } from './derivedStats'
import { musicRuntime } from './musicRuntime'
import { usePlayerStore } from './playerStore'
import { initialProgression, useProgressionStore } from './progressionStore'
import { retryNight, saveDuskSnapshot } from './retryNight'
import { useScoreStore } from './scoreStore'
import { CALM_STORM, stormRuntime } from './stormRuntime'
import type { ModeId } from '../types'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', fakeStorage())
  useProgressionStore.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

const storyMode = fc.constantFrom<ModeId>('easy', 'normal', 'hard')

describe('Retry Night and progression', () => {
  /** **Validates: Requirements 11.6, 11.7** */
  it('Property 34: restores the dusk progression and clears the night', () => {
    fc.assert(
      fc.property(
        storyMode,
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 100000 }),
        (mode, coins, rank, junkCoins, score) => {
          useProgressionStore.getState().patch({
            ...initialProgression(),
            mode,
            coins,
            score,
            ranks: { 'iron-constitution': rank },
          })
          expect(saveDuskSnapshot()).toBe(true)

          // The failed night.
          useProgressionStore.getState().patch({ coins: junkCoins + 1000, score: 0, ranks: {} })
          useScoreStore.getState().patch({ combo: 3, nightKills: 4 })
          useCoinStore.getState().setPiles([{ id: 1 } as never], 5)
          stormRuntime.storm = { ...CALM_STORM, active: true }
          stormRuntime.flashLevel = 1
          musicRuntime.silence = { ...emptySilence, pending: [{ id: 'x' }] } as never

          retryNight()

          const p = useProgressionStore.getState()
          expect(p.coins).toBe(coins)
          expect(p.score).toBe(score)
          expect(p.ranks).toEqual({ 'iron-constitution': rank })
          expect(usePlayerStore.getState().maxHealth).toBe(
            PLAYER_MAX_HEALTH + currentModifiers().maxHealthBonus,
          )
          expect(useCoinStore.getState().piles).toEqual([])
          expect(stormRuntime.storm).toBe(CALM_STORM)
          expect(stormRuntime.flashLevel).toBe(0)
          expect(musicRuntime.silence).toBe(emptySilence)
          expect(useScoreStore.getState().combo).toBe(COMBO.base)
          expect(useScoreStore.getState().nightKills).toBe(0)
        },
      ),
      { numRuns: 30 },
    )
  })

  it('does nothing in Endless (no Retry Night)', () => {
    useProgressionStore.getState().patch({ mode: 'endless', coins: 7 })
    saveDuskSnapshot()
    useProgressionStore.getState().patch({ coins: 99 })
    useCoinStore.getState().setPiles([{ id: 1 } as never], 5)
    retryNight()
    expect(useProgressionStore.getState().coins).toBe(99)
    expect(useCoinStore.getState().piles).toHaveLength(1)
  })
})
