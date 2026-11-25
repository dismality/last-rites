import { beforeEach, describe, expect, it } from 'vitest'
import { useAccusationStore } from './accusationStore'
import { useCaseStore } from './caseStore'
import { useEndingStore } from './endingStore'
import { resetRun } from './resetRun'
import { useStageStore } from './stageStore'
import { startEnding } from './startEnding'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

const RIGHT = 'Silas Vane'
const give = (text: string) => useAccusationStore.getState().give(text)

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
    expect(give(RIGHT).kind).toBe('closed')
  })

  it('wants a name, and asks again for a bare "Vane" without counting it', () => {
    toStage3Night()
    expect(give('   ').kind).toBe('incomplete')
    expect(give('Vane')).toEqual({ kind: 'ask', reply: 'Which Vane?' })
    expect(give('vane & sons').kind).toBe('ask')
    expect(useAccusationStore.getState().record).toEqual({ given: false, correct: false })
  })

  it('takes Silas in any short form', () => {
    for (const name of ['silas vane', 'Silas', 'S. Vane', 'sv', 'the son', 'Vanes son']) {
      resetRun()
      toStage3Night()
      expect(give(name).kind, name).toBe('solved')
    }
  })

  // Property 7: a wrong accusation costs nothing (Req 18.4, 18.5).
  it('a wrong accusation spawns no wave, locks nothing and counts no wrong answer', () => {
    toStage3Night()
    const wrongBefore = useCaseStore.getState().cases['sealed-catacombs'].wrongAnswers
    const wavesBefore = useWaveStore.getState().waves
    expect(give('Josiah Vane').kind).toBe('wrong-accusation')
    expect(useWaveStore.getState().waves).toEqual(wavesBefore)
    expect(useStageStore.getState().altar.lockedUntil).toBe(0)
    expect(useStageStore.getState().altar.wrong).toBe(0)
    expect(useCaseStore.getState().cases['sealed-catacombs'].wrongAnswers).toBe(wrongBefore)
    expect(useStageStore.getState().caseSolved).toBe(false)
    expect(useAccusationStore.getState().record).toEqual({ given: true, correct: false })
  })

  it('a right accusation is recorded but never solves the case (Req 18.5)', () => {
    toStage3Night()
    expect(give(RIGHT).kind).toBe('solved')
    expect(useAccusationStore.getState().record).toEqual({ given: true, correct: true })
    expect(useStageStore.getState().caseSolved).toBe(false)
    expect(give(RIGHT).kind).toBe('already')
  })

  it('the epilogue stage precedes the walk-out only after a right accusation (Req 18.3)', () => {
    toStage3Night()
    startEnding('rest')
    expect(useEndingStore.getState().stage).toBe('sequence')

    resetRun()
    toStage3Night()
    give(RIGHT)
    startEnding('rest')
    expect(useEndingStore.getState().stage).toBe('epilogue')
    useEndingStore.getState().endEpilogue()
    expect(useEndingStore.getState().stage).toBe('sequence')
  })

  it('a new run forgets the accusation', () => {
    toStage3Night()
    give(RIGHT)
    resetRun()
    expect(useAccusationStore.getState().record).toEqual({ given: false, correct: false })
  })
})
