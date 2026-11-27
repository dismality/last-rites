// Pure verdicts for the case minigames (spec 10 task 3.3, requirements 11.6, 12.2-12.4, 13.2, 13.4).
// Answers live in `data/cases.ts`; these functions only compare the player's input with them.
// No React, three.js or Howler here so the rules run in Node.

import {
  BELL_WRONG_POST_MESSAGE,
  CASE_1_BELLS,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  CASE_2_BOOTS,
  CASE_2_BOOT_MATCH,
  CASE_2_FRESH_GRAVES,
  CASE_2_VANE_CREST,
  CASE_3_HYMN_BOARD,
  CASE_3_HAND_SAMPLES,
  LEDGER_WRONG_FLAG_MESSAGE,
  type BellPostId,
  type Case1ClueId,
  type BootId,
  type FreshGraveId,
  type VaneCrestId,
  type HandSampleId,
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
 * The journal's "Which bell was cut?" opens once all three cords are pulled, or as soon as the cut
 * one is: finding Pell's silent bell first skips the other two (playtest, 2026-11-27).
 */
export function bellQuestionOpen(examined: readonly BellPostId[]): boolean {
  const cut = CASE_1_BELLS.find((p) => p.condition === 'rope-cut')
  return CASE_1_BELLS.every((p) => examined.includes(p.id)) || (cut !== undefined && examined.includes(cut.id))
}

/**
 * Minigame 1b. A wrong "which bell was cut?" answer is rejected (`firstWrong` 0). With the right
 * answer, `ok` also needs the question open (all three posts pulled, or the cut one).
 */
export function bellPosts(input: BellPostsInput): MinigameVerdict {
  if (input.cutAnswer !== undefined) {
    const cut = CASE_1_BELLS.find((p) => p.condition === 'rope-cut')
    if (input.cutAnswer !== cut?.id) {
      return { ok: false, firstWrong: 0, message: BELL_WRONG_POST_MESSAGE }
    }
  }
  return { ok: bellQuestionOpen(input.examined) && input.cutAnswer !== undefined }
}

/** The letters the five tiles must show: the first letter of each hymn the board names. */
export function hymnAnswer(): string[] {
  const { numbers, index } = CASE_3_HYMN_BOARD
  return numbers.map((n) => (index[n - 1] ?? '').charAt(0).toUpperCase())
}

/**
 * Minigame 3a. `tiles` holds one letter per tile (null for a tile not yet set), left to right.
 * Letters compare case-insensitively. A wrong or unset tile is rejected with `firstWrong` at the
 * first such tile and the message "The tiles do not sit true".
 */
export function hymnTiles(tiles: readonly (string | null)[]): MinigameVerdict {
  const want = hymnAnswer()
  const firstWrong = want.findIndex((w, i) => (tiles[i] ?? '').toUpperCase() !== w)
  if (firstWrong >= 0 || tiles.length !== want.length) {
    return {
      ok: false,
      firstWrong: firstWrong >= 0 ? firstWrong : want.length,
      message: CASE_3_HYMN_BOARD.wrongMessage,
    }
  }
  return { ok: true }
}

/** Minigame 3d: solved once every handwriting sample has been looked at side by side. */
export function handwritingSolved(seen: readonly HandSampleId[]): boolean {
  return CASE_3_HAND_SAMPLES.every((h) => seen.includes(h.id))
}

/** What the player marks on a register line: the grave agrees, or it has been disturbed. */
export type RegisterMark = 'agrees' | 'disturbed'

/** Minigame 2a, one line. Right when an untouched grave "agrees" and the robbed one is "disturbed". */
export function isRightRegisterMark(grave: FreshGraveId, mark: RegisterMark): boolean {
  const g = CASE_2_FRESH_GRAVES.find((x) => x.id === grave)
  return g !== undefined && (mark === 'disturbed') === g.robbed
}

/** Minigame 2a is solved once every line is marked right. */
export function registerSolved(marked: readonly FreshGraveId[]): boolean {
  return CASE_2_FRESH_GRAVES.every((g) => marked.includes(g.id))
}

/** Minigame 2c. Only Kerr's boots match the print (the keeper says what differs on the others). */
export function bootMatch(boot: BootId): MinigameVerdict {
  return CASE_2_BOOTS.some((b) => b.id === boot) && boot === CASE_2_BOOT_MATCH ? { ok: true } : { ok: false, firstWrong: 0 }
}

/** Minigame 2d. The key turns only with the Vane crest, the raven on a coffin, under the arrow. */
export function crestTurns(crest: VaneCrestId): boolean {
  return crest === CASE_2_VANE_CREST
}
