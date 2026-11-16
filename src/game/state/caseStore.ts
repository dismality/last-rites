// Case domain store (spec 10 task 2.3): found clues, board links, solved minigames, answer slots,
// hints, Doubt, wrong answers and the closed-case list. The rules are the pure systems in
// systems/case*.ts; this store holds the data and wires them to the altar, score and coins.
// Pure zustand: no React / three.js imports.

import { create } from 'zustand'
import { CASES, caseOfStage, type BellPostId, type CaseDef, type CaseId, type DeductionNote, type EvidenceCardId, type MinigameId } from '../../data/cases'
import type { AltarVerdict } from '../systems/altarAnswer'
import { addLink, correctLinkCount, curseMeter, EMPTY_BOARD, visibleClues } from '../systems/caseBoard'
import { checkFinalAnswer, fillSlot as fillSlotRule, isAnswerComplete } from '../systems/caseAnswer'
import { nextHint } from '../systems/caseHints'
import { applyDoubt, DOUBT_SCORE_PENALTY, doubtForNight } from '../systems/caseScore'
import {
  CASE_PERSISTED,
  freshCaseSave,
  type CaseProgress,
  sanitizeCardIds,
  sanitizeHymnTiles,
  type LedgerLine,
  type CaseSave,
} from '../systems/caseSave'
import { economy } from './economyPort'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'
import { useClueRevealStore } from './clueRevealStore'

export type LinkResult = { added: boolean; note: DeductionNote | null }
export type HintOutcome =
  | { ok: true; tier: 1 | 2 | 3; cost: number; text: string }
  | { ok: false; reason: 'coins' | 'all-revealed'; cost: number }
/** `incomplete` means a slot is empty: nothing is given to the altar and nothing is lost. */
export type AnswerOutcome = AltarVerdict | { kind: 'incomplete' }

interface CaseStoreState extends CaseSave {
  /** Mark a clue found. Returns false for an unknown clue or one already found. */
  findClue: (id: string) => boolean
  /** Draw a string between two found clues of the active case. */
  link: (a: string, b: string) => LinkResult
  /** Choose an option for a Final_Question slot of the active case (null empties it). */
  fillSlot: (slot: number, option: string | null) => void
  /**
   * A minigame verdict. A right one marks it solved and finds the clues it yields; a wrong one
   * counts as a wrong answer and, in the day, adds Doubt (Req 9.4). Verdicts come from tasks 3 to 5.
   */
  submitMinigame: (id: MinigameId, correct: boolean) => void
  /** Replace the minigame 1a draft lines (kept when the overlay closes). */
  setLedgerLines: (lines: LedgerLine[]) => void
  /** Minigame 3a: keep the five tiles as set (kept when the overlay closes). */
  setHymnTiles: (tiles: readonly (string | null)[]) => void
  /** Minigame 3b: record an evidence card as examined in the world. False for a card already held. */
  findEvidence: (id: EvidenceCardId) => boolean
  /** Minigame 3b: keep the arrangement of cards on the slate (kept when the overlay closes). */
  setTimeline: (order: readonly EvidenceCardId[]) => void
  /** Minigame 1b: record a bell post as fully examined (bell, rope and tag read). */
  examineBell: (id: BellPostId) => void
  /** Give the altar the filled Final_Question; the real check (`checkFinalAnswer`) decides. */
  giveAnswer: () => AnswerOutcome
  /**
   * A relic placed in the wrong slot of the rite (Req 17.3): the altar judges it as a wrong
   * answer, so the 30 s lock, the instant wave, the link rule and Sharp Eye all apply.
   */
  misplaceRelic: () => AltarVerdict
  /** Buy the next hint tier with Grave Coins (Req 9.1-9.3). */
  useHint: () => HintOutcome
  /** A solved case moves to the closed list (Req 4.5). */
  closeCase: (id: CaseId) => void
  /** Doubt waiting for the night that is starting, one extra Shambler each (Req 9.5). */
  doubtForStage: (stage: number) => number
}

const fresh = (): CaseSave => freshCaseSave()

const activeCase = (): CaseDef => caseOfStage(useStageStore.getState().stage)

function patchProgress(set: (fn: (s: CaseStoreState) => Partial<CaseStoreState>) => void, id: CaseId, fn: (p: CaseProgress) => CaseProgress) {
  set((s) => ({ cases: { ...s.cases, [id]: fn(s.cases[id]) } }))
}

const addScore = (delta: number): void => economy().addScore(delta)

export const useCaseStore = create<CaseStoreState>((set, get) => ({
  ...fresh(),

  findClue: (id) => {
    const def = CASES.find((c) => c.clues.some((x) => x.id === id))
    if (!def || get().cases[def.id].found.includes(id)) return false
    patchProgress(set, def.id, (p) => ({ ...p, found: [...p.found, id] }))
    // Clue reveal (spec 09 task 11q). Minigames and the merchant's receipt say so themselves.
    const clue = def.clues.find((x) => x.id === id)
    if (clue && clue.found.kind !== 'minigame' && clue.found.kind !== 'purchase') {
      useClueRevealStore.getState().revealCaseClue(id, clue.title, clue.line)
    }
    return true
  },

  link: (a, b) => {
    const def = activeCase()
    const p = get().cases[def.id]
    // Only clues already on the board can be joined.
    if (!p.found.includes(a) || !p.found.includes(b)) return { added: false, note: null }
    const r = addLink({ links: p.links }, def, a, b)
    if (r.board.links.length === p.links.length) return { added: false, note: null }
    patchProgress(set, def.id, (q) => ({ ...q, links: [...r.board.links] }))
    return { added: true, note: r.note }
  },

  fillSlot: (slot, option) => {
    const def = activeCase()
    patchProgress(set, def.id, (p) => ({ ...p, slots: [...fillSlotRule(def.final, p.slots, slot, option)] }))
  },

  submitMinigame: (id, correct) => {
    const def = activeCase()
    if (!def.minigames.includes(id)) return
    if (correct) {
      const yields = def.clues.filter((c) => c.found.kind === 'minigame' && c.found.id === id).map((c) => c.id)
      patchProgress(set, def.id, (p) => ({
        ...p,
        minigames: p.minigames.includes(id) ? p.minigames : [...p.minigames, id],
        found: [...p.found, ...yields.filter((y) => !p.found.includes(y))],
      }))
      return
    }
    patchProgress(set, def.id, (p) => ({ ...p, wrongAnswers: p.wrongAnswers + 1 }))
    // Doubt only matters for a night still to come; a wrong answer at night adds none.
    if (useWorldStore.getState().phase === 'night') return
    const stage = useStageStore.getState().stage
    const next = applyDoubt(get().doubt, stage)
    const grew = next.doubt > doubtForNight(get().doubt, stage)
    set({ doubt: next })
    // Each Doubt costs 50; a Doubt already at its cap adds nothing and costs nothing.
    if (grew) addScore(-DOUBT_SCORE_PENALTY)
  },

  setHymnTiles: (tiles) =>
    patchProgress(set, 'sealed-catacombs', (p) => ({ ...p, hymnTiles: sanitizeHymnTiles(tiles) })),

  findEvidence: (id) => {
    if (get().cases['sealed-catacombs'].evidenceFound.includes(id)) return false
    patchProgress(set, 'sealed-catacombs', (p) => ({ ...p, evidenceFound: [...p.evidenceFound, id] }))
    return true
  },

  setTimeline: (order) =>
    patchProgress(set, 'sealed-catacombs', (p) => ({ ...p, timeline: sanitizeCardIds(order) })),

  setLedgerLines: (lines) => patchProgress(set, 'saved-by-the-bell', (p) => ({ ...p, ledgerLines: lines })),

  examineBell: (id) =>
    patchProgress(set, 'saved-by-the-bell', (p) =>
      p.bellsExamined.includes(id) ? p : { ...p, bellsExamined: [...p.bellsExamined, id] },
    ),

  misplaceRelic: () => {
    const def = activeCase()
    const links = correctLinkCount({ links: get().cases[def.id].links }, def)
    const verdict = useStageStore.getState().giveAltarAnswer(false, links, 'case')
    // Same bookkeeping as a wrong case answer: only a judged answer counts against Sharp Eye.
    if (verdict.kind === 'wrong') patchProgress(set, def.id, (q) => ({ ...q, wrongAnswers: q.wrongAnswers + 1 }))
    return verdict
  },

  giveAnswer: () => {
    const def = activeCase()
    // Stage 3's answer is the rite itself (relic placement, `riteStore`); a filled slot sheet
    // must never solve it around Father Crane.
    if (def.id === 'sealed-catacombs') return { kind: 'incomplete' }
    const p = get().cases[def.id]
    if (!isAnswerComplete(def.final, p.slots)) return { kind: 'incomplete' }
    const correct = checkFinalAnswer(def, p.slots)
    const links = correctLinkCount({ links: p.links }, def)
    const verdict = useStageStore.getState().giveAltarAnswer(correct, links, 'case')
    // Only a real wrong answer counts against Sharp Eye; a locked or day answer was never judged.
    if (verdict.kind === 'wrong') patchProgress(set, def.id, (q) => ({ ...q, wrongAnswers: q.wrongAnswers + 1 }))
    return verdict
  },

  useHint: () => {
    const def = activeCase()
    const p = get().cases[def.id]
    const eco = economy()
    const r = nextHint(p.hints, eco.coins(), useStageStore.getState().nightElapsed, eco.story())
    if (r.kind === 'refused') return { ok: false, reason: r.reason === 'no-coins' ? 'coins' : 'all-revealed', cost: r.cost }
    if (r.cost > 0) eco.addCoins(-r.cost)
    patchProgress(set, def.id, (q) => ({ ...q, hints: r.state }))
    return { ok: true, tier: r.tier, cost: r.cost, text: def.hints[r.tier - 1].text }
  },

  closeCase: (id) => set((s) => (s.closed.includes(id) ? s : { closed: [...s.closed, id] })),

  doubtForStage: (stage) => doubtForNight(get().doubt, stage),
}))

/** Data fields a snapshot or save keeps (functions are never captured). */
export { CASE_PERSISTED }

/** Cards on the active case's board: found clues of this stage's case only (Req 4.5, 7.3). */
export function selectVisibleClues(s: Pick<CaseSave, 'cases'>, stage: 1 | 2 | 3) {
  return visibleClues(stage, s.cases[caseOfStage(stage).id].found)
}

/** Curse meter of a stage's case, from its correct links. */
export function selectCurse(s: Pick<CaseSave, 'cases'>, stage: 1 | 2 | 3): { value: number; max: number } {
  return curseMeter({ ...EMPTY_BOARD, links: s.cases[caseOfStage(stage).id].links }, caseOfStage(stage))
}

/** Correct links made on a stage's case (feeds the objective's Curse meter). */
export function selectCorrectLinks(s: Pick<CaseSave, 'cases'>, stage: 1 | 2 | 3): number {
  return correctLinkCount({ links: s.cases[caseOfStage(stage).id].links }, caseOfStage(stage))
}
