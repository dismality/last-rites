// Developer mode's quick path: pressing "skip step" walks stage 1's day through the real stores.
import { beforeEach, describe, expect, it } from 'vitest'
import { caseOfStage } from '../data/cases'
import { selectCorrectLinks, useCaseStore } from '../game/state/caseStore'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { refreshGuidance } from '../game/state/guidanceTick'
import { useGameStore } from '../game/state/gameStore'
import { useProgressionStore } from '../game/state/progressionStore'
import { useWorldStore } from '../game/state/worldStore'
import { skipToStage } from './devActions'
import { skipStep } from './skipStep'

const press = (): string => {
  refreshGuidance()
  const line = skipStep()
  refreshGuidance()
  return line
}

describe('skipStep', () => {
  beforeEach(() => {
    useGameStore.setState({ screen: 'game' })
    useProgressionStore.setState({ mode: 'normal' })
    useWorldStore.setState({ phase: 'day', phaseTime: 0, nightNumber: 1, wavesCleared: false })
    skipToStage(1)
  })

  it('clears stage 1 one step at a time, ending at dusk', () => {
    const seen: string[] = []
    for (let i = 0; i < 10 && useWorldStore.getState().phase === 'day'; i++) {
      seen.push(useGuidanceStore.getState().objective?.main ?? '')
      press()
      // setTime('dusk') leaves the day a moment from its end; the real tick does the change.
      if (useWorldStore.getState().phaseTime >= 359) break
    }
    const def = caseOfStage(1)
    const progress = useCaseStore.getState().cases[def.id]
    expect(def.minigames.every((m) => progress.minigames.includes(m))).toBe(true)
    expect(selectCorrectLinks(useCaseStore.getState(), 1)).toBe(def.notes.length)
    expect(useWorldStore.getState().phaseTime).toBeGreaterThan(359)
    expect(seen.length).toBeLessThanOrEqual(8)
  })

  it('at dusk moves to the night, and at night solves the case', () => {
    useWorldStore.setState({ phase: 'dusk', phaseTime: 1 })
    expect(press()).toContain('night')
    useWorldStore.setState({ phase: 'night', phaseTime: 1 })
    refreshGuidance()
    expect(press()).toContain('Night cleared')
  })
})
