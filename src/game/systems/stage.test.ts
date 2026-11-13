import { describe, expect, it } from 'vitest'
import type { WorldState } from '../types'
import { tickDayNight } from './dayNight'
import {
  markCaseSolved,
  nextStage,
  startStage,
  stageDayNightInput,
  tickStageNight,
  wavesClearedFor,
} from './stage'

describe('stage state machine', () => {
  it('starts unsolved and advances 1 -> 2 -> 3 -> win', () => {
    const s1 = startStage(1)
    expect(s1).toEqual({ stage: 1, caseSolved: false, solvedAtPhaseTime: null, nightElapsed: 0 })
    const s2 = nextStage(s1)
    expect(s2).toMatchObject({ stage: 2, caseSolved: false })
    const s3 = nextStage(s2 as ReturnType<typeof startStage>)
    expect(s3).toMatchObject({ stage: 3 })
    expect(nextStage(s3 as ReturnType<typeof startStage>)).toBe('win')
  })

  it('solving keeps the first time and stops the night clock', () => {
    let s = tickStageNight(startStage(2), 12)
    expect(s.nightElapsed).toBe(12)
    s = markCaseSolved(s, 12)
    expect(wavesClearedFor(s)).toBe(true)
    expect(markCaseSolved(s, 99).solvedAtPhaseTime).toBe(12)
    expect(tickStageNight(s, 5).nightElapsed).toBe(12)
  })
})

describe('day/night from the case-solved flag', () => {
  const night = (n: number): WorldState => ({
    phase: 'night', phaseTime: 100, nightNumber: n, fogDensity: 0.02, wavesCleared: false,
  })

  it('the night runs while the case is unsolved and ends when it is solved', () => {
    const open = stageDayNightInput(startStage(1))
    expect(tickDayNight(night(1), 5000, open).state.phase).toBe('night')
    const solved = stageDayNightInput(markCaseSolved(startStage(1), 100))
    expect(tickDayNight(night(1), 1, solved).state.phase).toBe('dawn')
  })

  it('stops counting nights at stage 3', () => {
    const dawn: WorldState = { phase: 'dawn', phaseTime: 0, nightNumber: 3, fogDensity: 0.04, wavesCleared: true }
    const input = stageDayNightInput(markCaseSolved(startStage(3), 1))
    expect(tickDayNight(dawn, 100, input).state.nightNumber).toBe(3)
  })

  it('stage 1 dawn leads to stage 2', () => {
    const dawn: WorldState = { phase: 'dawn', phaseTime: 0, nightNumber: 1, fogDensity: 0.03, wavesCleared: true }
    const input = stageDayNightInput(markCaseSolved(startStage(1), 1))
    expect(tickDayNight(dawn, 100, input).state.nightNumber).toBe(2)
  })
})
