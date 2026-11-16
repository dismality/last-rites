// Pure verdicts for the case minigames (spec 10 task 3.3, requirements 11.6, 12.2-12.4, 13.2, 13.4).
// Answers live in `data/cases.ts`; these functions only compare the player's input with them.
// No React, three.js or Howler here so the rules run in Node.

import {
  BELL_WRONG_POST_MESSAGE,
  CASE_1_BELLS,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  LEDGER_WRONG_FLAG_MESSAGE,
  type BellPostId,
  type Case1ClueId,
  type LedgerFlagKind,
} from '../../data/cases'

/** What every minigame verdict returns. `firstWrong` is an index into the player's input. */
export interface MinigameVerdict {
  ok: boolean
  firstWrong?: number
  /** Short in-world line for a wrong answer; never a scare. */
  message?: string
}

/** A line drawn from a stone to a ledger entry, flagged with the kind of mismatch. */
export interface LedgerFlagInput {
  stoneId: string
  ledgerId: string
  kind: LedgerFlagKind
}

/** A flag is right when the stone's own ledger line is joined and the flag names its mismatch. */
export function isRightLedgerFlag(flag: LedgerFlagInput): boolean {
  const stone = CASE_1_STONES.find((s) => s.id === flag.stoneId)
  if (!stone || stone.ledgerId !== flag.ledgerId) return false
  return CASE_1_RIGHT_FLAGS.some((r) => r.stoneId === flag.stoneId && r.kind === flag.kind)
}

/**
 * Minigame 1a. `ok` once every right flag is set and no flag is wrong. `firstWrong` is the index
 * of the first wrong flag, which the case system rejects (Doubt and "These two agree").
 */
export function ledgerFlags(flags: readonly LedgerFlagInput[]): MinigameVerdict {
  const firstWrong = flags.findIndex((f) => !isRightLedgerFlag(f))
  if (firstWrong >= 0) return { ok: false, firstWrong, message: LEDGER_WRONG_FLAG_MESSAGE }
  const allSet = CASE_1_RIGHT_FLAGS.every((r) =>
    flags.some((f) => f.stoneId === r.stoneId && f.kind === r.kind),
  )
  return { ok: allSet }
}

/** The three graves left once 1a is solved: the stones that carry a right flag. */
export function candidateGraves(): readonly string[] {
  return CASE_1_RIGHT_FLAGS.map((r) => r.stoneId)
}

export interface BellPostsInput {
  /** Posts the player has examined so far. */
  examined: readonly BellPostId[]
  /** The post named as the answer to "Which bell was cut?", once asked. */
  cutAnswer?: BellPostId
}

/** Clue cards an examined post gives: the cut rope, the rusted bell, the early tag. */
export function bellClues(examined: readonly BellPostId[]): Case1ClueId[] {
  const clues: Case1ClueId[] = []
  for (const post of CASE_1_BELLS) {
    if (!examined.includes(post.id)) continue
    if (post.clueId) clues.push(post.clueId)
    if (post.tagClueId) clues.push(post.tagClueId)
  }
  return clues
}

/**
 * Minigame 1b. A wrong "which bell was cut?" answer is rejected (`firstWrong` 0). With the right
 * answer, `ok` also needs all three posts examined, so all three clue cards are pinned.
 */
export function bellPosts(input: BellPostsInput): MinigameVerdict {
  if (input.cutAnswer !== undefined) {
    const cut = CASE_1_BELLS.find((p) => p.condition === 'rope-cut')
    if (input.cutAnswer !== cut?.id) {
      return { ok: false, firstWrong: 0, message: BELL_WRONG_POST_MESSAGE }
    }
  }
  const allExamined = CASE_1_BELLS.every((p) => input.examined.includes(p.id))
  return { ok: allExamined && input.cutAnswer !== undefined }
}
