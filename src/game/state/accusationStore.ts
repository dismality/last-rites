// Accusation domain store (spec 10 task 4.6, Req 18; playtest story pass): the name typed at the
// altar on the last night, "Who sealed Elias Thorne in the Crane crypt?", and the record of what the
// altar said. It is judged by the altar's own rule (`stageStore.giveAltarAnswer` with kind
// 'accusation'), so a wrong name spawns no wave, locks nothing and counts as nothing, and a right
// one never ends the night: it opens the rite. A bare "Vane" is asked again ("Which Vane?").
// Like the rite, it belongs to one run and is not saved: the autosaves fall at dawn and dusk.
// Pure zustand: no React / three.js imports.

import { create } from 'zustand'
import { caseOfStage } from '../../data/cases'
import type { AltarVerdict } from '../systems/altarAnswer'
import { accusationOpen, NO_ACCUSATION, recordAccusation, type AccusationRecord } from '../systems/accusation'
import { correctLinkCount } from '../systems/caseBoard'
import { checkAccusation, normalizeAnswer, typedAskReply } from '../systems/caseAnswer'
import { useCaseStore } from './caseStore'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

export type AccusationOutcome =
  | AltarVerdict
  | { kind: 'incomplete' }
  | { kind: 'closed' }
  | { kind: 'already' }
  | { kind: 'ask'; reply: string }

interface AccusationStoreState {
  record: AccusationRecord
  /** Put a typed name to the altar. */
  give: (text: string) => AccusationOutcome
}

const CASE_3 = caseOfStage(3)
const QUESTION = CASE_3.accusation

export const useAccusationStore = create<AccusationStoreState>((set, get) => ({
  record: NO_ACCUSATION,

  give: (text) => {
    if (!QUESTION) return { kind: 'closed' }
    const stage = useStageStore.getState()
    if (!accusationOpen(stage.stage, useWorldStore.getState().phase, stage.caseSolved)) return { kind: 'closed' }
    if (get().record.correct) return { kind: 'already' }
    if (normalizeAnswer(text) === '') return { kind: 'incomplete' }
    const ask = typedAskReply(QUESTION, text)
    if (ask) return { kind: 'ask', reply: ask }
    const correct = checkAccusation(CASE_3, [], text)
    const links = correctLinkCount({ links: useCaseStore.getState().cases[CASE_3.id].links }, CASE_3)
    const verdict = stage.giveAltarAnswer(correct, links, 'accusation')
    // Only a judged accusation is recorded; a silent altar or a day attempt was never heard.
    if (verdict.kind === 'solved') set({ record: recordAccusation(get().record, true) })
    else if (verdict.kind === 'wrong-accusation') set({ record: recordAccusation(get().record, false) })
    return verdict
  },
}))
