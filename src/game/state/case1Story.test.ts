import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CASE1_SAY } from '../../data/case1Narration'
import { answerCutBell, noteStoneRead, pullBellCord } from './case1Story'
import { useCaseStore } from './caseStore'
import { lineSeconds, useNarrationStore } from './narrationStore'
import { resetRun } from './resetRun'
import { useStageStore } from './stageStore'

const p = () => useCaseStore.getState().cases['saved-by-the-bell']
const said = () => useNarrationStore.getState().heard

beforeEach(() => {
  resetRun()
  useStageStore.setState({ stage: 1 })
})

describe('Case 1 story', () => {
  it('reads the three named stones once each, and says what each one says', () => {
    noteStoneRead('marsh')
    expect(p().stonesRead).toEqual([])
    noteStoneRead('pell')
    noteStoneRead('pell')
    expect(p().stonesRead).toEqual(['pell'])
    expect(said()).toEqual([CASE1_SAY.stone.pell])
    noteStoneRead('ames')
    noteStoneRead('hale')
    expect(said()).toContain(CASE1_SAY.stonesDone)
  })

  it('pulls each cord: two ring, Pell is silent, and the journal question opens after all three', () => {
    const ring = vi.fn()
    expect(answerCutBell('bell-pell')).toEqual({ kind: 'not-yet' })
    pullBellCord('bell-ames', ring)
    pullBellCord('bell-pell', ring)
    expect(ring).toHaveBeenCalledWith('bell-ames', true)
    expect(ring).toHaveBeenCalledWith('bell-pell', false)
    expect(said()).not.toContain(CASE1_SAY.bellsDone)
    pullBellCord('bell-hale', ring)
    expect(said()).toContain(CASE1_SAY.bellsDone)
    expect(p().bellsExamined).toHaveLength(3)
  })

  it('a wrong bell costs nothing; the right one solves 1b and names J. Vane', () => {
    for (const id of ['bell-ames', 'bell-hale', 'bell-pell'] as const) pullBellCord(id)
    const r = answerCutBell('bell-ames')
    expect(r.kind).toBe('wrong')
    expect(p().wrongAnswers).toBe(0)
    expect(p().minigames).not.toContain('1b')
    expect(answerCutBell('bell-pell')).toEqual({ kind: 'right' })
    expect(p().minigames).toContain('1b')
    expect(p().found).toEqual(expect.arrayContaining(['pell-rope-cut', 'pell-tag-early', 'two-bells-ring']))
    expect(said().some((l) => l.includes('Josiah Vane'))).toBe(true)
  })

  it('says nothing about Case 1 in another stage', () => {
    useStageStore.setState({ stage: 2 })
    noteStoneRead('pell')
    expect(p().stonesRead).toEqual([])
  })
})

describe('narration store', () => {
  it('says lines in order, a new find replacing what was waiting, and gives long lines more time', () => {
    const n = useNarrationStore.getState()
    n.say(['a', 'b', 'a'])
    expect(useNarrationStore.getState().queue).toEqual(['a', 'b'])
    useNarrationStore.getState().next()
    expect(useNarrationStore.getState().queue).toEqual(['b'])
    n.say('c')
    expect(useNarrationStore.getState().queue).toEqual(['c'])
    expect(useNarrationStore.getState().heard).toEqual(['a', 'b', 'c'])
    expect(lineSeconds('short')).toBe(2.6)
    expect(lineSeconds('x'.repeat(200))).toBeGreaterThan(10)
  })
})
