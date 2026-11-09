// Retrying a night must not leave the failed night's zombies or wave progress behind.
import { describe, expect, it } from 'vitest'
import { retryNight } from '../src/game/state/retryNight'
import { useGameStore } from '../src/game/state/gameStore'
import { useGuidanceStore } from '../src/game/state/guidanceStore'
import { useIntroStore } from '../src/game/state/introStore'
import { currentTutorialStep, tutorialPrompt } from '../src/game/systems/tutorial'
import type { TutorialStepId } from '../src/data/tutorialSteps'
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

  it('bumps retryEpoch and clears the zone card', () => {
    const before = useGameStore.getState().retryEpoch
    useGuidanceStore.setState({ card: { zone: 'grounds', elapsed: 1 } })
    retryNight()
    expect(useGameStore.getState().retryEpoch).toBe(before + 1)
    expect(useGuidanceStore.getState().card).toBeNull()
  })

  it('keeps completed tutorial steps and introSeen, and never re-prompts a done step', () => {
    const done = new Set<TutorialStepId>([1, 2] as TutorialStepId[])
    useGuidanceStore.getState().setTutorialDone(done)
    useIntroStore.getState().setSeen(true)
    retryNight()
    expect(useGuidanceStore.getState().tutorialDone).toBe(done)
    expect(useIntroStore.getState().seen).toBe(true)
    const prompt = tutorialPrompt({
      done: useGuidanceStore.getState().tutorialDone,
      enabled: true,
      phase: 'day',
      nightNumber: 1,
      bindings: {},
    })
    expect(currentTutorialStep(done)).toBe(3)
    expect(prompt).not.toBeNull()
    expect(prompt).toBe(
      tutorialPrompt({ done, enabled: true, phase: 'day', nightNumber: 1, bindings: {} }),
    )
  })
})