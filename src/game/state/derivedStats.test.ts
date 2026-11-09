import { beforeEach, describe, expect, it } from 'vitest'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { currentModifiers, syncDerivedStats } from './derivedStats'
import { usePlayerStore } from './playerStore'
import { useProgressionStore } from './progressionStore'
import { useUiWorldStore } from './uiWorldStore'

beforeEach(() => {
  useProgressionStore.getState().reset()
  usePlayerStore.setState({ health: PLAYER_MAX_HEALTH, maxHealth: PLAYER_MAX_HEALTH })
  useUiWorldStore.setState({ playerHealth: PLAYER_MAX_HEALTH })
})

describe('derivedStats', () => {
  it('Iron Constitution raises max HP by 15 per rank', () => {
    for (const rank of [0, 1, 2]) {
      useProgressionStore.getState().patch({ ranks: rank ? { 'iron-constitution': rank } : {} })
      syncDerivedStats()
      expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH + 15 * rank)
    }
  })

  it('healPlayer caps at the new max', () => {
    useProgressionStore.getState().patch({ ranks: { 'iron-constitution': 2 } })
    syncDerivedStats()
    usePlayerStore.getState().setHealth(100)
    useUiWorldStore.getState().healPlayer(500)
    expect(usePlayerStore.getState().health).toBe(130)
  })

  it('a sync after load restores max HP', () => {
    useProgressionStore.getState().patch({ ranks: { 'iron-constitution': 1 } })
    expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH)
    syncDerivedStats()
    expect(usePlayerStore.getState().maxHealth).toBe(115)
  })

  it('modifiers are stable until the ranks object changes', () => {
    const a = currentModifiers()
    expect(currentModifiers()).toBe(a)
    useProgressionStore.getState().patch({ ranks: { 'long-wick': 1 } })
    const b = currentModifiers()
    expect(b).not.toBe(a)
    expect(currentModifiers()).toBe(b)
  })
})
