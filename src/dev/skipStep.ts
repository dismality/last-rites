// Developer mode's quick path: "Skip this step" does what the current objective asks, through the
// same stores the real play uses, so a judge or a demo can walk the whole story in minutes. Each
// press clears one step and returns a short line for the toast. No React imports.

import { candidateGraves } from '../game/systems/caseMinigames'
import { caseOfStage } from '../data/cases'
import { CASE_2_FRESH_GRAVES } from '../data/cases'
import { PREPARE_WEAPON_RULE, STAGE_DAY_RULES } from '../data/objectiveRules'
import { MODES } from '../data/modes'
import { useCaseStore } from '../game/state/caseStore'
import { useGuidanceStore } from '../game/state/guidanceStore'
import { useMysteryStore } from '../game/state/mysteryStore'
import { useProgressionStore } from '../game/state/progressionStore'
import { useStageStore } from '../game/state/stageStore'
import { useWorldStore } from '../game/state/worldStore'
import { selectCorrectLinks } from '../game/state/caseStore'
import {
  completeObjective,
  giveAllClues,
  giveKeyItem,
  givePage,
  giveRelic,
  giveWeapon,
  setTime,
  solveMinigame,
} from './devActions'
import { RELIC_IDS } from './devData'

/** Which of the stage's day steps the objective line names, or -1. */
function stepIndex(stage: 1 | 2 | 3, main: string): number {
  return STAGE_DAY_RULES[stage].findIndex((r) => main.startsWith(r.main) || main === r.whenCounted)
}

/** Every clue found, every right pair linked and the final question filled with its answer. */
function finishCaseBoard(stage: 1 | 2 | 3): string {
  const def = caseOfStage(stage)
  const store = useCaseStore.getState()
  giveAllClues()
  def.notes.forEach((n) => store.link(n.a, n.b))
  def.final.answer.forEach((a, i) => useCaseStore.getState().fillSlot(i, a))
  return `Linked every clue of ${def.title} and filled in the answer`
}

function doStageStep(stage: 1 | 2 | 3, at: number): string {
  const rule = STAGE_DAY_RULES[stage][at]
  if (rule.minigame) return solveMinigame(rule.minigame)
  if (stage === 1 && at === 0) {
    candidateGraves().forEach((g) => useCaseStore.getState().readStone(g))
    return 'Read the three stones'
  }
  if (stage === 2 && at === 0) return giveKeyItem('rusted-crypt-key')
  if (stage === 2 && at === 1) {
    useMysteryStore.setState((s) => ({
      mystery: { ...s.mystery, gates: { ...s.mystery.gates, 'mausoleum-row': true } },
    }))
    return 'Opened the Mausoleum Row gate'
  }
  if (stage === 2 && at === 2) {
    CASE_2_FRESH_GRAVES.forEach((g) => useCaseStore.getState().seeGrave(g.id))
    return 'Looked at the three fresh graves'
  }
  if (stage === 2 && at === 5) {
    useCaseStore.getState().takePrint()
    return 'Took the boot print'
  }
  if (stage === 3 && at === 1) {
    useCaseStore.getState().findClue('hearse-cart-ruts')
    return 'Found the cart ruts'
  }
  if (stage === 3 && at === 5) {
    RELIC_IDS.forEach(giveRelic)
    return 'Gave all five relics'
  }
  return `No quick path for "${rule.main}"`
}

/** Clears the current objective step. Safe to press at any time; it never skips two steps. */
export function skipStep(): string {
  const o = useGuidanceStore.getState().objective
  if (!o) return 'No objective yet'
  const phase = useWorldStore.getState().phase
  const story = MODES[useProgressionStore.getState().mode].story

  if (o.rule === PREPARE_WEAPON_RULE) return giveWeapon('revolver')
  if (phase === 'dusk') return setTime('night')
  if (phase === 'night') {
    // The answer goes in first, so the case reads as solved on the board too.
    if (story) finishCaseBoard(useStageStore.getState().stage)
    return completeObjective()
  }
  if (phase !== 'day') return 'Pick a dawn upgrade to start the next day'
  if (o.rule === 5) return givePage(1)
  if (!story) return setTime('dusk')

  const stage = useStageStore.getState().stage
  const at = stepIndex(stage, o.main)
  if (at >= 0) return doStageStep(stage, at)
  // Every day step done: link the case board, then call the dusk.
  const def = caseOfStage(stage)
  if (selectCorrectLinks(useCaseStore.getState(), stage) < def.notes.length) return finishCaseBoard(stage)
  return setTime('dusk')
}
