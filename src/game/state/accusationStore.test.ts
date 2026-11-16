import { beforeEach, describe, expect, it } from 'vitest'
import { caseOfStage } from '../../data/cases'
import { useAccusationStore } from './accusationStore'
import { useCaseStore } from './caseStore'
import { useEndingStore } from './endingStore'
import { resetRun } from './resetRun'
import { useStageStore } from './stageStore'
import { startEnding } from './startEnding'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

const Q = caseOfStage(3).accusation!

function fillAll(answer: readonly string[]): void {
  answer.forEach((o, i) => useAccusationStore.getState().fillSlot(i, o))
}

function toStage3Night(): void {
  useWorldStore.setState({ nightNumber: 3, phase: 'night' })
  useStageStore.getState().startStage(3)
}

beforeEach(() => {
  resetRun()
  useCaseStore.getState()
})

describe('accusationStore', () => {
  it('is closed by day', () => {
    useWorldStore.setState({ nightNumber: 3, phase: 'day' })
    useStageStore.getState().startStage(3)
    fillAll(Q.answer)
    expect(useAccusationStore.getState().give().kind).toBe('closed')
  })

  it('wants every blank filled and ignores options a blank does not offer', () => {
    toStage3Night()
    useAccusationStore.getState().fillSlot(0, 'the moon')
    expect(useAccusationStore.getState().slots[0]).toBeNull()
    useAccusationStore.getState().fillSlot(0, Q.answer[0])
    expect(useAccusationStore.getState().give().kind).toBe('incomplete')
  })

  // Property 7: a wrong accusation costs nothing (Req 18.4, 18.5).
  it('a wrong accusation spawns no wave, locks nothing and counts no wrong answer', () => {
    toStage3Night()
    const wrongBefore = useCaseStore.getState().cases['sealed-catacombs'].wrongAnswers
    const wavesBefore = useWaveStore.getState().waves
    fillAll([Q.slots[0].options.find((o) => o !== Q.answer[0])!, ...Q.answer.slice(1)])
    expect(useAccusationStore.getState().give().kind).toBe('wrong-accusation')
    expect(useWaveStore.getState().waves).toEqual(wavesBefore)
    expect(useStageStore.getState().altar.lockedUntil).toBe(0)
    expect(useStageStore.getState().altar.wrong).toBe(0)
    expect(useCaseStore.getState().cases['sealed-catacombs'].wrongAnswers).toBe(wrongBefore)
    expect(useStageStore.getState().caseSolved).toBe(false)
    expect(useAccusationStore.getState().record).toEqual({ given: true, correct: false })
  })

  it('a right accusation is recorded but never solves the case (Req 18.5)', () => {
    toStage3Night()
    fillAll(Q.answer)
    expect(useAccusationStore.getState().give().kind).toBe('solved')
    expect(useAccusationStore.getState().record).toEqual({ given: true, correct: true })
    expect(useStageStore.getState().caseSolved).toBe(false)
    expect(useAccusationStore.getState().give().kind).toBe('already')
  })

  it('the epilogue stage precedes the walk-out only after a right accusation (Req 18.3)', () => {
    toStage3Night()
    startEnding('rest')
    expect(useEndingStore.getState().stage).toBe('sequence')

    resetRun()
    toStage3Night()
    fillAll(Q.answer)
    useAccusationStore.getState().give()
    startEnding('rest')
    expect(useEndingStore.getState().stage).toBe('epilogue')
    useEndingStore.getState().endEpilogue()
    expect(useEndingStore.getState().stage).toBe('sequence')
  })

  it('a new run forgets the accusation', () => {
    toStage3Night()
    fillAll(Q.answer)
    useAccusationStore.getState().give()
    resetRun()
    expect(useAccusationStore.getState().record).toEqual({ given: false, correct: false })
    expect(useAccusationStore.getState().slots.every((s) => s === null)).toBe(true)
  })
})
