// Retrying a night must not leave the failed night's zombies or wave progress behind.
import { describe, expect, it } from 'vitest'
import { retryNight } from '../src/game/state/retryNight'
import { useEnemyStore } from '../src/game/state/enemyStore'
import { useWaveStore } from '../src/game/state/waveStore'
import { startNight } from '../src/game/systems/waves'
import type { AIEnemy } from '../src/game/systems/enemyAI'

describe('retryNight', () => {
  it('clears live enemies and wave state', () => {
    useEnemyStore.setState({ enemies: [{ uid: 'z1' } as unknown as AIEnemy] })
    useWaveStore.getState().setWaves(startNight(1))
    useWaveStore.getState().setTotalWaves(2)
    retryNight()
    expect(useEnemyStore.getState().enemies).toHaveLength(0)
    expect(useWaveStore.getState().waves.phase).toBe('idle')
    expect(useWaveStore.getState().totalWaves).toBe(0)
  })
})