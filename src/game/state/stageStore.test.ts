import { beforeEach, describe, expect, it } from 'vitest'
import { startStageNight } from '../systems/waves'
import { stageOfNight, tickStageClock, useStageStore } from './stageStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

beforeEach(() => {
  useWorldStore.setState(useWorldStore.getInitialState(), true)
  useStageStore.setState(useStageStore.getInitialState(), true)
  useWaveStore.getState().reset()
})

describe('stageStore', () => {
  it('maps night numbers to stages 1..3', () => {
    expect([0, 1, 2, 3, 4, 99, NaN].map(stageOfNight)).toEqual([1, 1, 2, 3, 3, 3, 1])
  })

  it('starts a fresh stage when the world moves to the next night', () => {
    useStageStore.getState().solveCase(5)
    useWorldStore.getState().setNightNumber(2)
    const s = useStageStore.getState()
    expect(s.stage).toBe(2)
    expect(s.caseSolved).toBe(false)
    // Stage 3 is last: more nights do not leave it.
    useWorldStore.getState().setNightNumber(3)
    useWorldStore.getState().setNightNumber(4)
    expect(useStageStore.getState().stage).toBe(3)
  })

  it('counts night time only at night and stops when solved', () => {
    tickStageClock(1)
    expect(useStageStore.getState().nightElapsed).toBe(0)
    useWorldStore.getState().setPhase('night')
    tickStageClock(2)
    expect(useStageStore.getState().nightElapsed).toBe(2)
    useStageStore.getState().solveCase(2)
    tickStageClock(5)
    expect(useStageStore.getState().nightElapsed).toBe(2)
    expect(useStageStore.getState().solvedAtPhaseTime).toBe(2)
  })

  it('a correct altar answer solves the case; a wrong one queues a wave and locks the altar', () => {
    useWorldStore.getState().setPhase('night')
    useWaveStore.getState().setWaves(startStageNight(1))
    const before = useWaveStore.getState().waves
    const wrong = useStageStore.getState().giveAltarAnswer(false, 0, 'case')
    expect(wrong.kind).toBe('wrong')
    expect(useWaveStore.getState().waves.waveIndex).toBe(before.waveIndex + 1)
    expect(useStageStore.getState().altar.wrong).toBe(1)
    expect(useStageStore.getState().giveAltarAnswer(true, 0, 'case').kind).toBe('locked')
    expect(useStageStore.getState().caseSolved).toBe(false)
    tickStageClock(31)
    expect(useStageStore.getState().giveAltarAnswer(true, 0, 'case').kind).toBe('solved')
    expect(useStageStore.getState().caseSolved).toBe(true)
  })

  it('refuses answers by day', () => {
    expect(useStageStore.getState().giveAltarAnswer(true, 0, 'case').kind).toBe('day')
    expect(useStageStore.getState().caseSolved).toBe(false)
  })

  it('beginNight and resetNight clear the clock and lock but keep wrong answers', () => {
    useWorldStore.getState().setPhase('night')
    useStageStore.getState().giveAltarAnswer(false, 3, 'case')
    useStageStore.getState().resetNight()
    const s = useStageStore.getState()
    expect(s.altar.lockedUntil).toBe(0)
    expect(s.altar.wrong).toBe(1)
    expect(s.nightElapsed).toBe(0)
  })
})
