import { beforeEach, describe, expect, it } from 'vitest'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { useGameStore } from './gameStore'
import { usePlayerStore } from './playerStore'
import { useUiWorldStore } from './uiWorldStore'

describe('healPlayer', () => {
  beforeEach(() => {
    usePlayerStore.setState({ health: 40, maxHealth: PLAYER_MAX_HEALTH })
    useUiWorldStore.setState({ playerHealth: 40 })
  })

  it('updates both health copies', () => {
    useUiWorldStore.getState().healPlayer(25)
    expect(usePlayerStore.getState().health).toBe(65)
    expect(useUiWorldStore.getState().playerHealth).toBe(65)
  })

  it('caps at maxHealth, including a raised max', () => {
    useUiWorldStore.getState().healPlayer(500)
    expect(usePlayerStore.getState().health).toBe(PLAYER_MAX_HEALTH)
    usePlayerStore.setState({ maxHealth: 115 })
    useUiWorldStore.getState().healPlayer(500)
    expect(usePlayerStore.getState().health).toBe(115)
    expect(useUiWorldStore.getState().playerHealth).toBe(115)
  })

  it('starts retryEpoch at 0', () => {
    expect(useGameStore.getState().retryEpoch).toBe(0)
  })
})
