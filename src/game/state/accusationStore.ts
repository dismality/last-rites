// Accusation domain store (spec 10 task 4.6, Req 18): the four chosen options and the record of
// what the altar said. It is judged by the altar's own rule (`stageStore.giveAltarAnswer` with
// kind 'accusation'), so a wrong accusation spawns no wave, locks nothing and counts as nothing,
// and a right one never ends the night. Like the rite, it belongs to one run and is not saved:
// the autosaves fall at dawn and dusk, before the accusation can be given.
// Pure zustand: no React / three.js imports.

import { create } from 'zustand'
import { caseOfStage } from '../../data/cases'
import type { AltarVerdict } from '../systems/altarAnswer'
import { accusationOpen, NO_ACCUSATION, recordAccusation, type AccusationRecord } from '../systems/accusation'
import { correctLinkCount } from '../systems/caseBoard'
import { checkAccusation, fillSlot as fillSlotRule, isAnswerComplete } from '../systems/caseAnswer'
import { useCaseStore } from './caseStore'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

export type AccusationOutcome = AltarVerdict | { kind: 'incomplete' } | { kind: 'closed' } | { kind: 'already' }

interface AccusationStoreState {
  /** One option per slot of the accusation sentence; `null` is empty. */
  slots: (string | null)[]
  record: AccusationRecord
  fillSlot: (slot: number, option: string | null) => void
  /** Put the filled accusation to the altar. */
  give: () => AccusationOutcome
}

const CASE_3 = caseOfStage(3)
const QUESTION = CASE_3.accusation

const emptySlots = (): (string | null)[] => (QUESTION?.slots ?? []).map(() => null)

export const useAccusationStore = create<AccusationStoreState>((set, get) => ({
  slots: emptySlots(),
  record: NO_ACCUSATION,

  fillSlot: (slot, option) => {
    if (!QUESTION) return
    set({ slots: [...fillSlotRule(QUESTION, get().slots, slot, option)] })
  },

  give: () => {
    if (!QUESTION) return { kind: 'closed' }
    const stage = useStageStore.getState()
    if (!accusationOpen(stage.stage, useWorldStore.getState().phase, stage.caseSolved)) return { kind: 'closed' }
    if (get().record.correct) return { kind: 'already' }
    if (!isAnswerComplete(QUESTION, get().slots)) return { kind: 'incomplete' }
    const correct = checkAccusation(CASE_3, get().slots)
    const links = correctLinkCount({ links: useCaseStore.getState().cases[CASE_3.id].links }, CASE_3)
    const verdict = stage.giveAltarAnswer(correct, links, 'accusation')
    // Only a judged accusation is recorded; a silent altar or a day attempt was never heard.
    if (verdict.kind === 'solved') set({ record: recordAccusation(get().record, true) })
    else if (verdict.kind === 'wrong-accusation') set({ record: recordAccusation(get().record, false) })
    return verdict
  },
}))
