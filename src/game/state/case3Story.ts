// Case 3 in the world (playtest story pass): the hymn board, the cart ruts down the Row, the hearse
// pin on the Crane crypt door, Elias and his letter, and the handwriting in the journal. Each find
// records progress in the Case_Store and has the keeper say what it means. The words are data in
// case3Narration.ts; the 3d rule is `handwritingSolved` in caseMinigames.ts. No React or three.js.

import { CASE3_SAY } from '../../data/case3Narration'
import type { HandSampleId } from '../../data/cases'
import { handwritingSolved } from '../systems/caseMinigames'
import { useAccusationStore } from './accusationStore'
import { useCaseStore } from './caseStore'
import { useGameStore } from './gameStore'
import { narrate } from './narrationStore'
import { useStageStore } from './stageStore'

const CASE_ID = 'sealed-catacombs'
const progress = () => useCaseStore.getState().cases[CASE_ID]
const inCase3 = () => useStageStore.getState().stage === 3
const solved = (id: '3a' | '3b' | '3c' | '3d') => progress().minigames.includes(id)

/** 3b: the hearse pin pulled from the Crane crypt door. The door swings open on Elias. */
export function pullCryptPin(): boolean {
  if (!inCase3() || solved('3b')) return false
  useCaseStore.getState().submitMinigame('3b', true)
  narrate(CASE3_SAY.door)
  return true
}

/** 3c: Elias searched. His coat holds the unsent letter and the note that called him here. */
export function searchElias(): boolean {
  if (!inCase3()) return false
  if (!solved('3b')) {
    narrate(CASE3_SAY.eliasShut)
    return false
  }
  if (solved('3c')) return false
  useCaseStore.getState().submitMinigame('3c', true)
  narrate(CASE3_SAY.elias)
  return true
}

/** 3d: one handwriting sample looked at in the journal; the last one solves it. */
export function compareHandSample(id: HandSampleId): 'seen' | 'solved' | 'not-yet' {
  if (!solved('3c')) return 'not-yet'
  useCaseStore.getState().seeHandSample(id)
  if (solved('3d')) return 'solved'
  if (!handwritingSolved(progress().handSeen)) return 'seen'
  useCaseStore.getState().submitMinigame('3d', true)
  narrate(CASE3_SAY.handSolved)
  return 'solved'
}

/**
 * Says Elias's last page when Stage 3's first day begins, what the hymn board means once solved,
 * the ruts and the oil when they are found, and the keeper's words when the altar holds the name.
 * Returns the unsubscribe function; install once.
 */
export function installCase3Story(): () => void {
  const offStage = useStageStore.subscribe((s, prev) => {
    if (s.stage !== 3 || prev.stage === 3) return
    if (useGameStore.getState().screen !== 'game') return
    narrate(CASE3_SAY.page)
  })
  const offFinds = useCaseStore.subscribe((s, prev) => {
    if (!inCase3()) return
    const now = s.cases[CASE_ID]
    const was = prev.cases[CASE_ID]
    if (now.minigames.includes('3a') && !was.minigames.includes('3a')) narrate(CASE3_SAY.hymnSolved)
    const newly = (id: string) => now.found.includes(id as never) && !was.found.includes(id as never)
    if (newly('hearse-cart-ruts')) narrate(CASE3_SAY.ruts)
    if (newly('oil-other-crypt')) narrate(CASE3_SAY.oil)
  })
  const offNamed = useAccusationStore.subscribe((s, prev) => {
    if (s.record.correct && !prev.record.correct) narrate(CASE3_SAY.named)
  })
  return () => {
    offStage()
    offFinds()
    offNamed()
  }
}
