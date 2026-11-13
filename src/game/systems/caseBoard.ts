// Case board rules (spec 10 task 2.2, Req 8.2, 8.5-8.7, 4.5). Pure: the board only records
// strings the player draws; it never solves anything on its own.

import { caseOfStage, type CaseDef, type ClueDef, type DeductionNote } from '../../data/cases'
import type { StageNumber } from '../../data/stages'

export interface BoardState {
  /** Unique `linkKey` pairs the player has drawn, in the order they were made. */
  links: readonly string[]
}

export const EMPTY_BOARD: BoardState = { links: [] }

/** Order-independent key for a pair of clue ids. */
export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function noteFor(caseDef: CaseDef, a: string, b: string): DeductionNote | null {
  const key = linkKey(a, b)
  return caseDef.notes.find((n) => linkKey(n.a, n.b) === key) ?? null
}

/**
 * Draw a string between two clues of this case. A pair joins at most once, so a repeat returns
 * the same board and no note (Req 8.7). Unknown clues and a card joined to itself are ignored.
 * A wrong pair is kept on the board but gives no note and costs nothing (Req 8.6).
 */
export function addLink(
  board: BoardState,
  caseDef: CaseDef,
  a: string,
  b: string,
): { board: BoardState; note: DeductionNote | null } {
  const known = (id: string) => caseDef.clues.some((c) => c.id === id)
  if (a === b || !known(a) || !known(b)) return { board, note: null }
  const key = linkKey(a, b)
  if (board.links.includes(key)) return { board, note: null }
  return { board: { links: [...board.links, key] }, note: noteFor(caseDef, a, b) }
}

/** Links that join a pair listed in the case's notes. These are the ones that lower the curse. */
export function correctLinkCount(board: BoardState, caseDef: CaseDef): number {
  const good = new Set(caseDef.notes.map((n) => linkKey(n.a, n.b)))
  return board.links.filter((k) => good.has(k)).length
}

/** The Curse meter: starts at the case's steps and falls one per correct link, never below 0. */
export function curseMeter(board: BoardState, caseDef: CaseDef): { value: number; max: number } {
  const max = caseDef.curseSteps
  return { value: Math.max(0, max - correctLinkCount(board, caseDef)), max }
}

/** Notes the player has earned, in the order the links were made. */
export function earnedNotes(board: BoardState, caseDef: CaseDef): DeductionNote[] {
  return board.links.flatMap((k) => {
    const n = caseDef.notes.find((x) => linkKey(x.a, x.b) === k)
    return n ? [n] : []
  })
}

/**
 * Cards on the board: found clues that belong to this stage's case only (Req 4.5, 8.2).
 * Starting the next stage swaps the set, since the earlier case's clue ids are not in it.
 */
export function visibleClues(stage: StageNumber, found: readonly string[]): ClueDef[] {
  const have = new Set(found)
  return caseOfStage(stage).clues.filter((c) => have.has(c.id))
}
