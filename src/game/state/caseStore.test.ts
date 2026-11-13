import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CASES, caseOfStage } from '../../data/cases'
import type { StageNumber } from '../../data/stages'
import { startStageNight } from '../systems/waves'
import { planNight } from '../systems/waveDirection'
import { freshCaseSave } from '../systems/caseSave'
import { selectCorrectLinks, selectCurse, selectVisibleClues, useCaseStore } from './caseStore'
import { resetRun } from './resetRun'
import {
  hasMorningSnapshot,
  retryFromMorning,
  retryNight,
  saveDuskSnapshot,
  saveMorningSnapshot,
} from './retryNight'
import { captureSave, loadGame, saveGame } from './gameSave'
import { useProgressionStore } from './progressionStore'
import { useStageStore, tickStageClock } from './stageStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

const c1 = CASES[0]

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('sessionStorage', fakeStorage())
  resetRun()
})
afterEach(() => vi.unstubAllGlobals())

describe('caseStore', () => {
  it('Feature: 10-curse-stages, Property 8: clue sets swap per stage', () => {
    // **Validates: Requirements 4.5, 7.3**
    fc.assert(
      fc.property(fc.constantFrom<StageNumber>(1, 2, 3), fc.array(fc.constantFrom(...CASES.flatMap((c) => c.clues.map((x) => x.id as string)))), (stage, ids) => {
        useCaseStore.setState(freshCaseSave())
        for (const id of ids) useCaseStore.getState().findClue(id)
        const visible = selectVisibleClues(useCaseStore.getState(), stage).map((c) => c.id as string)
        const want = new Set(ids.filter((id) => caseOfStage(stage).clues.some((c) => c.id === id)))
        expect(new Set(visible)).toEqual(want)
      }),
      { numRuns: 100 },
    )
  })

  it('finds each clue once and links only found clues, with note and curse', () => {
    const n = c1.notes[0]
    expect(useCaseStore.getState().findClue('not-a-clue')).toBe(false)
    expect(useCaseStore.getState().link(n.a, n.b).added).toBe(false)
    expect(useCaseStore.getState().findClue(n.a)).toBe(true)
    expect(useCaseStore.getState().findClue(n.a)).toBe(false)
    useCaseStore.getState().findClue(n.b)
    const r = useCaseStore.getState().link(n.a, n.b)
    expect(r.added).toBe(true)
    expect(r.note?.text).toBe(n.text)
    expect(useCaseStore.getState().link(n.b, n.a).added).toBe(false)
    expect(selectCorrectLinks(useCaseStore.getState(), 1)).toBe(1)
    expect(selectCurse(useCaseStore.getState(), 1).value).toBe(c1.curseSteps - 1)
  })

  it('a wrong day answer adds Doubt, costs 50 score and feeds the next night', () => {
    useProgressionStore.getState().patch({ score: 200 })
    useCaseStore.getState().submitMinigame('1a', false)
    expect(useCaseStore.getState().doubt).toEqual({ nightId: 1, doubt: 1 })
    expect(useProgressionStore.getState().score).toBe(150)
    expect(useCaseStore.getState().cases[c1.id].wrongAnswers).toBe(1)
    expect(useCaseStore.getState().doubtForStage(1)).toBe(1)
    expect(useCaseStore.getState().doubtForStage(2)).toBe(0)
    for (let i = 0; i < 5; i++) useCaseStore.getState().submitMinigame('1a', false)
    expect(useCaseStore.getState().doubt.doubt).toBe(3)
    expect(useProgressionStore.getState().score).toBe(50)
  })

  it('Doubt from the store adds Shamblers to the first wave of the night it was earned for', () => {
    const count = (d: number) => planNight('normal', 1, d).state.pending.length
    const base = count(0)
    useCaseStore.getState().submitMinigame('1a', false)
    useCaseStore.getState().submitMinigame('1a', false)
    expect(count(useCaseStore.getState().doubtForStage(1))).toBe(base + 2)
    expect(count(useCaseStore.getState().doubtForStage(2))).toBe(base)
  })

  it('a right minigame verdict is stored and yields its clues', () => {
    useCaseStore.getState().submitMinigame('1a', true)
    const p = useCaseStore.getState().cases[c1.id]
    expect(p.minigames).toEqual(['1a'])
    const yields = c1.clues.filter((c) => c.found.kind === 'minigame' && c.found.id === '1a').map((c) => c.id)
    expect(p.found).toEqual(expect.arrayContaining(yields))
  })

  it('buys hints in order with coins and refuses without them', () => {
    expect(useCaseStore.getState().useHint()).toMatchObject({ ok: false, reason: 'coins', cost: 5 })
    useProgressionStore.getState().setCoins(15)
    expect(useCaseStore.getState().useHint()).toMatchObject({ ok: true, tier: 1, cost: 5 })
    expect(useCaseStore.getState().useHint()).toMatchObject({ ok: true, tier: 2, cost: 10 })
    expect(useProgressionStore.getState().coins).toBe(0)
    expect(useCaseStore.getState().cases[c1.id].hints.revealed).toBe(2)
  })

  it('the altar check uses the case data: wrong locks and spawns, right solves', () => {
    useWorldStore.getState().setPhase('night')
    useWaveStore.getState().setWaves(startStageNight(1))
    const cs = useCaseStore.getState()
    expect(cs.giveAnswer().kind).toBe('incomplete')
    c1.final.slots.forEach((s, i) => cs.fillSlot(i, s.options.find((o) => o !== c1.final.answer[i]) ?? null))
    expect(useCaseStore.getState().giveAnswer().kind).toBe('wrong')
    expect(useCaseStore.getState().cases[c1.id].wrongAnswers).toBe(1)
    c1.final.answer.forEach((o, i) => useCaseStore.getState().fillSlot(i, o))
    expect(useCaseStore.getState().giveAnswer().kind).toBe('locked')
    tickStageClock(31)
    expect(useCaseStore.getState().giveAnswer().kind).toBe('solved')
    expect(useStageStore.getState().caseSolved).toBe(true)
    // A locked answer was never judged, so it did not count as wrong.
    expect(useCaseStore.getState().cases[c1.id].wrongAnswers).toBe(1)
  })

  it('Continue rebuilds the store from the save', () => {
    const n = c1.notes[0]
    useCaseStore.getState().findClue(n.a)
    useCaseStore.getState().findClue(n.b)
    useCaseStore.getState().link(n.a, n.b)
    useCaseStore.getState().submitMinigame('1a', false)
    useCaseStore.getState().closeCase(c1.id)
    const before = { cases: useCaseStore.getState().cases, closed: useCaseStore.getState().closed, doubt: useCaseStore.getState().doubt }
    expect(saveGame()).toBe(true)
    expect(captureSave().case).toEqual(before)
    useCaseStore.setState(freshCaseSave())
    expect(loadGame()).toBe(true)
    const s = useCaseStore.getState()
    expect({ cases: s.cases, closed: s.closed, doubt: s.doubt }).toEqual(before)
  })

  it('Retry Night unions knowledge but restores Doubt and wrong answers; New Game resets', () => {
    useWorldStore.getState().setPhase('dusk')
    useCaseStore.getState().findClue(c1.notes[0].a)
    expect(saveDuskSnapshot()).toBe(true)
    useCaseStore.getState().findClue(c1.notes[0].b)
    useCaseStore.getState().submitMinigame('1a', false)
    retryNight()
    const s = useCaseStore.getState()
    expect(s.cases[c1.id].found).toEqual(expect.arrayContaining([c1.notes[0].a, c1.notes[0].b]))
    expect(s.cases[c1.id].wrongAnswers).toBe(0)
    expect(s.doubt.doubt).toBe(0)
    resetRun()
    expect(useCaseStore.getState().cases).toEqual(freshCaseSave().cases)
    expect(useCaseStore.getState().closed).toEqual([])
  })

  it('Retry from morning also keeps what was found', () => {
    saveMorningSnapshot()
    expect(hasMorningSnapshot()).toBe(true)
    useCaseStore.getState().findClue(c1.notes[0].a)
    retryFromMorning()
    expect(useCaseStore.getState().cases[c1.id].found).toContain(c1.notes[0].a)
  })
})
