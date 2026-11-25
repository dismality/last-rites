// Case 1 in the world (playtest story pass): reading the three stones, pulling the three bell
// cords and answering "Which bell was cut?" in the journal. Each find records progress in the
// Case_Store and has the keeper say what it means. The verdicts are the pure rules in
// caseMinigames.ts; the words are data in case1Narration.ts. No React or three.js imports.

import { CASE_1_BELLS, type BellPostId } from '../../data/cases'
import { CASE1_SAY } from '../../data/case1Narration'
import { bellPosts, candidateGraves } from '../systems/caseMinigames'
import { useCaseStore } from './caseStore'
import { narrate } from './narrationStore'
import { useGameStore } from './gameStore'
import { useMysteryStore } from './mysteryStore'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

const CASE_ID = 'saved-by-the-bell'
const progress = () => useCaseStore.getState().cases[CASE_ID]
const inCase1 = () => useStageStore.getState().stage === 1

/** A stone was read at its grave. Only the three graves Elias named count, and only before the ledger is done. */
export function noteStoneRead(id: string): void {
  if (!inCase1() || !candidateGraves().includes(id)) return
  const before = progress()
  if (before.minigames.includes('1a')) return
  const first = !before.stonesRead.includes(id)
  useCaseStore.getState().readStone(id)
  if (!first) return
  const line = CASE1_SAY.stone[id]
  const all = candidateGraves().every((g) => progress().stonesRead.includes(g))
  narrate(all ? [line, CASE1_SAY.stonesDone] : [line])
}

/** The ring of a sound bell, or silence for a cut cord. Injected so this stays free of audio code. */
export type BellSound = (post: BellPostId, rings: boolean) => void

/** Pull a bell post's cord: record it examined, ring it (or not), and say what it means. */
export function pullBellCord(id: BellPostId, sound?: BellSound): void {
  const post = CASE_1_BELLS.find((p) => p.id === id)
  if (!post) return
  const rings = post.condition !== 'rope-cut'
  sound?.(id, rings)
  const p = progress()
  if (p.minigames.includes('1b') || p.bellsExamined.includes(id)) {
    narrate(CASE1_SAY.bellAgain[id])
    return
  }
  useCaseStore.getState().examineBell(id)
  const all = CASE_1_BELLS.every((b) => progress().bellsExamined.includes(b.id))
  narrate(all ? [...CASE1_SAY.bell[id], CASE1_SAY.bellsDone] : CASE1_SAY.bell[id])
}

export type CutAnswer = { kind: 'right' } | { kind: 'wrong'; text: string } | { kind: 'not-yet' }

/**
 * The journal's "Which bell was cut?". Opens once every cord is pulled. A wrong pick costs nothing
 * (playtest); the right one solves minigame 1b, which pins its clue cards.
 */
export function answerCutBell(id: BellPostId): CutAnswer {
  const p = progress()
  if (!CASE_1_BELLS.every((b) => p.bellsExamined.includes(b.id))) return { kind: 'not-yet' }
  const v = bellPosts({ examined: p.bellsExamined, cutAnswer: id })
  if (!v.ok) {
    const text = CASE1_SAY.cutWrong[id] || (v.message ?? '')
    narrate(text)
    return { kind: 'wrong', text }
  }
  if (!p.minigames.includes('1b')) {
    useCaseStore.getState().submitMinigame('1b', true)
    narrate([...CASE1_SAY.cutRight, CASE1_SAY.seal])
  }
  return { kind: 'right' }
}

/**
 * Says the page lines when Elias's first page is read during Case 1, and the closing lines when
 * the case is solved at the altar. Returns the unsubscribe function; install once.
 */
export function installCase1Story(): () => void {
  const offPage = useMysteryStore.subscribe((s, prev) => {
    if (!inCase1() || !s.mystery.pages.has(1) || prev.mystery.pages.has(1)) return
    if (useGameStore.getState().screen !== 'game') return
    narrate(CASE1_SAY.page)
  })
  const offSolved = useStageStore.subscribe((s, prev) => {
    if (s.stage !== 1 || !s.caseSolved || prev.caseSolved) return
    if (useWorldStore.getState().phase !== 'night') return
    narrate(CASE1_SAY.solved)
  })
  return () => {
    offPage()
    offSolved()
  }
}
