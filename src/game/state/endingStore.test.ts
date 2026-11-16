import { beforeEach, describe, expect, it } from 'vitest'
import { endingPausable, useEndingStore } from './endingStore'

beforeEach(() => useEndingStore.getState().reset())

describe('ending stages (spec 10 task 6.3)', () => {
  it('a Rest sunrise played to its end leads into the win walk-out, then the summary', () => {
    const s = useEndingStore.getState
    s().beginEnding('rest')
    expect(s().stage).toBe('sequence')
    s().endSequence()
    expect(s().stage).toBe('walkout')
    expect(endingPausable()).toBe(true)
    s().showSummary()
    expect(s().stage).toBe('summary')
    expect(endingPausable()).toBe(false)
  })

  it('with the epilogue earned: epilogue, sunrise, walk-out', () => {
    const s = useEndingStore.getState
    s().beginEnding('rest', true)
    expect(s().stage).toBe('epilogue')
    s().endEpilogue()
    expect(s().stage).toBe('sequence')
    s().endSequence()
    expect(s().stage).toBe('walkout')
  })

  it('the Taken ending has no walk-out', () => {
    const s = useEndingStore.getState
    s().beginEnding('taken')
    s().endSequence()
    expect(s().stage).toBe('summary')
    s().playWalkout()
    expect(s().stage).toBe('summary')
  })

  it('endSequence only moves on from the sequence', () => {
    const s = useEndingStore.getState
    s().beginEnding('rest', true)
    s().endSequence()
    expect(s().stage).toBe('epilogue')
  })

  it('the dev trigger jumps a Rest ending straight to the walk-out', () => {
    const s = useEndingStore.getState
    s().beginEnding('rest')
    s().playWalkout()
    expect(s().stage).toBe('walkout')
  })
})
