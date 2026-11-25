// Spec 10 Req 5.3 and 5.5: the Dev_Panel case actions go through the real case store.
import { beforeEach, describe, expect, it } from 'vitest'
import { CASE_MAP } from '../data/cases'
import { useCaseStore } from '../game/state/caseStore'
import { RITE_ORDER } from '../data/relics'
import { useInventoryStore } from '../game/state/inventoryStore'
import { useOverlayStore } from '../game/state/overlayStore'
import { useRiteStore } from '../game/state/riteStore'
import { useStageStore } from '../game/state/stageStore'
import { useWorldStore } from '../game/state/worldStore'
import { freshCaseSave } from '../game/systems/caseSave'
import { giveAllClues, giveClue, linkClues, placeAllRelics, setAltarPanel, solveCurrentMinigame, solveMinigame, unsolvedMinigames } from './devActions'
import { lendFixtureNotes } from '../../tests/helpers/caseNotes'

// No story case links clues any more; the linking rules are tested on lent notes.
lendFixtureNotes()

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

describe('solveMinigame (Stage 1 helpers)', () => {
  it('solves 1b without 1a, then reports a repeat, through the real store', () => {
    expect(solveMinigame('1b')).toContain('Solved')
    expect(useCaseStore.getState().cases[case1.id].minigames).toEqual(['1b'])
    expect(solveMinigame('1b')).toContain('already')
    expect(solveMinigame('1a')).toContain('Solved')
    expect(unsolvedMinigames()).toEqual([])
  })

  it('refuses a minigame of another case', () => {
    expect(solveMinigame('2a')).toContain('not part')
    expect(useCaseStore.getState().cases[case1.id].minigames).toEqual([])
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
    // Cases 1 and 2 have no links (their journals ask one question); Case 3 does.
    useStageStore.setState({ stage: 3 })
    const case2 = CASE_MAP['sealed-catacombs']
    const n = case2.notes[0]
    expect(linkClues(n.a, n.b)).toContain('Could not')
    giveClue(n.a)
    giveClue(n.b)
    expect(giveClue(n.a)).toContain('already')
    expect(linkClues(n.a, n.b)).toContain('Linked')
    expect(useCaseStore.getState().cases[case2.id].links).toHaveLength(1)
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

describe('Stage 3 helpers', () => {
  beforeEach(() => {
    useWorldStore.setState({ nightNumber: 3, phase: 'day' })
    useStageStore.getState().startStage(3)
    useRiteStore.getState().reset()
    useInventoryStore.setState((s) => ({ inventory: { ...s.inventory, relics: [] } }))
  })

  it('solves 3a and 3b through the real store, and refuses them in stage 1', () => {
    expect(solveMinigame('3a')).toContain('Solved')
    expect(solveMinigame('3b')).toContain('Solved')
    expect(solveMinigame('3a')).toContain('already')
    useStageStore.getState().startStage(1)
    expect(solveMinigame('3a')).toContain('not part')
  })

  it('gives the relics by day without placing them', () => {
    expect(placeAllRelics()).toContain('Gave all')
    expect(useInventoryStore.getState().inventory.relics).toHaveLength(RITE_ORDER.length)
    expect(useRiteStore.getState().rite.placed).toEqual({})
  })

  it('lays the relics on the altar in rite order at the stage 3 night', () => {
    useWorldStore.setState({ phase: 'night' })
    expect(placeAllRelics()).toContain(`placed ${RITE_ORDER.length}`)
    const placed = useRiteStore.getState().rite.placed
    RITE_ORDER.forEach((r, i) => expect(placed[i]).toBe(r))
  })
})
