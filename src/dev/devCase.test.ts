// Spec 10 Req 5.3 and 5.5: the Dev_Panel case actions go through the real case store.
import { beforeEach, describe, expect, it } from 'vitest'
import { CASE_MAP } from '../data/cases'
import { useCaseStore } from '../game/state/caseStore'
import { useOverlayStore } from '../game/state/overlayStore'
import { useStageStore } from '../game/state/stageStore'
import { freshCaseSave } from '../game/systems/caseSave'
import { giveAllClues, giveClue, linkClues, setAltarPanel, solveCurrentMinigame, unsolvedMinigames } from './devActions'

const case1 = CASE_MAP['saved-by-the-bell']

beforeEach(() => {
  useStageStore.getState().startStage(1)
  useCaseStore.setState(freshCaseSave())
})

describe('giveAllClues', () => {
  it('finds every clue of the active case and nothing from other cases', () => {
    expect(giveAllClues()).toContain(`${case1.clues.length} clues`)
    const cases = useCaseStore.getState().cases
    expect([...cases['saved-by-the-bell'].found].sort()).toEqual(case1.clues.map((c) => c.id).sort())
    expect(cases['resurrection-men'].found).toEqual([])
    expect(giveAllClues()).toContain('already')
  })
})

describe('solveCurrentMinigame', () => {
  it('solves the minigames of the case in order, then reports none left', () => {
    const all = [...case1.minigames]
    expect(unsolvedMinigames()).toEqual(all)
    for (const m of all) expect(solveCurrentMinigame()).toContain(m)
    expect(unsolvedMinigames()).toEqual([])
    expect(solveCurrentMinigame()).toContain('No unsolved')
    expect(useCaseStore.getState().cases[case1.id].minigames).toEqual(all)
  })

  it('finds the clues a solved minigame yields', () => {
    const first = case1.minigames[0]
    const yields = case1.clues.filter((c) => c.found.kind === 'minigame' && c.found.id === first)
    solveCurrentMinigame()
    for (const c of yields) expect(useCaseStore.getState().cases[case1.id].found).toContain(c.id)
  })
})

describe('linkClues and giveClue', () => {
  it('links a deduction pair once both clues are found', () => {
    const n = case1.notes[0]
    expect(linkClues(n.a, n.b)).toContain('Could not')
    giveClue(n.a)
    giveClue(n.b)
    expect(giveClue(n.a)).toContain('already')
    expect(linkClues(n.a, n.b)).toContain('Linked')
    expect(useCaseStore.getState().cases[case1.id].links).toHaveLength(1)
  })
})

describe('setAltarPanel', () => {
  it('opens and closes the overlay', () => {
    setAltarPanel(true)
    expect(useOverlayStore.getState().altarPanelOpen).toBe(true)
    setAltarPanel(false)
    expect(useOverlayStore.getState().altarPanelOpen).toBe(false)
  })
})
