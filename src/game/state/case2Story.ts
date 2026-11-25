// Case 2 in the world (playtest story pass): the fresh graves, the burial register, the watch log,
// the print and the boots, and Kerr's crest-locked locker. Each find records progress in the
// Case_Store and has the keeper say what it means. The verdicts are the pure rules in
// caseMinigames.ts; the words are data in case2Narration.ts. No React or three.js imports.

import { CASE_2_FRESH_GRAVES, CASE_2_WATCH_ROUNDS, type BootId, type FreshGraveId, type VaneCrestId } from '../../data/cases'
import { CASE2_SAY } from '../../data/case2Narration'
import { bootMatch, crestTurns, isRightRegisterMark, registerSolved, type RegisterMark } from '../systems/caseMinigames'
import { useCaseStore } from './caseStore'
import { useGameStore } from './gameStore'
import { narrate } from './narrationStore'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

const CASE_ID = 'resurrection-men'
const progress = () => useCaseStore.getState().cases[CASE_ID]
const inCase2 = () => useStageStore.getState().stage === 2
const solved = (id: '2a' | '2b' | '2c' | '2d') => progress().minigames.includes(id)

/** A fresh grave was inspected. The first look says what it shows; all three point to the register. */
export function inspectFreshGrave(id: FreshGraveId): void {
  if (!inCase2()) return
  const first = !progress().gravesSeen.includes(id)
  useCaseStore.getState().seeGrave(id)
  const line = CASE2_SAY.grave[id]
  const all = CASE_2_FRESH_GRAVES.every((g) => progress().gravesSeen.includes(g.id))
  narrate(first && all && !solved('2a') ? [line, CASE2_SAY.gravesDone] : [line])
}

export type MarkResult = 'right' | 'wrong' | 'not-seen'

/**
 * Minigame 2a: mark a register line. A grave must be inspected first. A wrong mark is a wrong
 * answer (Doubt by day), as in the Case 1 ledger; the third right line solves 2a.
 */
export function markRegisterLine(id: FreshGraveId, mark: RegisterMark): MarkResult {
  if (!progress().gravesSeen.includes(id)) return 'not-seen'
  if (!isRightRegisterMark(id, mark)) {
    useCaseStore.getState().submitMinigame('2a', false)
    narrate(mark === 'agrees' ? CASE2_SAY.registerNotAgree : CASE2_SAY.registerNotDisturbed)
    return 'wrong'
  }
  if (progress().registerMarked.includes(id)) return 'right'
  useCaseStore.getState().markRegister(id)
  const done = registerSolved(progress().registerMarked)
  if (done) useCaseStore.getState().submitMinigame('2a', true)
  narrate(done ? [...CASE2_SAY.registerRight[id], ...CASE2_SAY.registerSolved] : CASE2_SAY.registerRight[id])
  return 'right'
}

/** Minigame 2b: a countersign box clicked in the watch log. An empty one solves it; a signed one costs nothing. */
export function checkCountersign(round: number): 'solved' | 'signed' {
  const r = CASE_2_WATCH_ROUNDS[round]
  if (!r || r.countersign !== null) {
    narrate(CASE2_SAY.watchSigned)
    return 'signed'
  }
  if (!solved('2b')) {
    useCaseStore.getState().submitMinigame('2b', true)
    narrate(CASE2_SAY.watchSolved)
  }
  return 'solved'
}

/** The print at the robbed grave is taken into the journal. */
export function takeBootPrint(): void {
  if (!inCase2()) return
  const first = !progress().printTaken
  useCaseStore.getState().takePrint()
  if (first) narrate(CASE2_SAY.print)
}

export type BootResult = 'no-print' | 'wrong' | 'right'

/** Minigame 2c: hold a boot's sole against the print. A wrong pair costs nothing; Kerr's solves it. */
export function compareBootWithPrint(id: BootId): BootResult {
  if (!progress().printTaken) {
    narrate(CASE2_SAY.bootsNoPrint)
    return 'no-print'
  }
  useCaseStore.getState().compareBoot(id)
  if (!bootMatch(id).ok) {
    narrate(CASE2_SAY.bootWrong[id])
    return 'wrong'
  }
  if (!solved('2c')) {
    useCaseStore.getState().submitMinigame('2c', true)
    narrate(CASE2_SAY.bootRight)
  }
  return 'right'
}

/** Minigame 2d: the locker key tried with a crest under the arrow. Needs the key from Kerr's boot. */
export function turnLockerKey(crest: VaneCrestId): 'no-key' | 'wrong' | 'open' {
  if (!solved('2c')) {
    narrate(CASE2_SAY.lockerNoKey)
    return 'no-key'
  }
  if (!crestTurns(crest)) {
    narrate(CASE2_SAY.crestWrong)
    return 'wrong'
  }
  if (!solved('2d')) {
    useCaseStore.getState().submitMinigame('2d', true)
    narrate(CASE2_SAY.lockerOpen)
  }
  return 'open'
}

/**
 * Says Elias's next note when Stage 2's first day begins, and the closing lines when the case is
 * solved at the altar. Returns the unsubscribe function; install once.
 */
export function installCase2Story(): () => void {
  const offStage = useStageStore.subscribe((s, prev) => {
    if (s.stage !== 2 || prev.stage === 2) return
    if (useGameStore.getState().screen !== 'game') return
    narrate(CASE2_SAY.page)
  })
  const offSolved = useStageStore.subscribe((s, prev) => {
    if (s.stage !== 2 || !s.caseSolved || prev.caseSolved) return
    if (useWorldStore.getState().phase !== 'night') return
    narrate(CASE2_SAY.solved)
  })
  return () => {
    offStage()
    offSolved()
  }
}
