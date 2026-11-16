// Pure view-model rules for minigame 1a, the Ledger Cross-check (spec 10 task 3.4, Req 12).
// The overlay (`ui/minigames/LedgerMinigame.tsx`) only draws these results. The verdict itself is
// `ledgerFlags` / `isRightLedgerFlag` from `caseMinigames.ts`, so the answer is never decided here.
// No React, three.js or Howler imports.

import { LEDGER_WRONG_FLAG_MESSAGE, type LedgerFlagKind } from '../../data/cases'
import { isRightLedgerFlag, ledgerFlags } from './caseMinigames'
import type { LedgerLine } from './caseSave'

export const FLAG_LABEL: Record<LedgerFlagKind, string> = {
  date: 'Date',
  plot: 'Plot',
  certificate: 'Missing certificate',
}

export const FLAG_KINDS: readonly LedgerFlagKind[] = ['date', 'plot', 'certificate']

export const NO_LINE_MESSAGE = 'Draw a line from a stone to a ledger entry first.'
export const SOLVED_MESSAGE = 'Three burials do not add up. Their graves are marked in your journal.'

/** Draw a line. One line per stone and one per entry, so a new line replaces older ones it crowds out. */
export function joinLine(lines: readonly LedgerLine[], stoneId: string, ledgerId: string): LedgerLine[] {
  const same = lines.find((l) => l.stoneId === stoneId && l.ledgerId === ledgerId)
  if (same) return [...lines] // idempotent: joining twice changes nothing
  return [...lines.filter((l) => l.stoneId !== stoneId && l.ledgerId !== ledgerId), { stoneId, ledgerId, flag: null }]
}

/** Rub out the line from a stone. A line that carries an accepted flag is kept: that answer is final. */
export function removeLine(lines: readonly LedgerLine[], stoneId: string): LedgerLine[] {
  return lines.filter((l) => l.stoneId !== stoneId || l.flag !== null)
}

export interface Cursor {
  side: 'stone' | 'entry'
  index: number
}

/** Arrow keys: up and down walk a column, left and right cross to the other page. No wrapping. */
export function moveCursor(c: Cursor, code: string, stoneCount: number, entryCount: number): Cursor {
  const count = (side: Cursor['side']) => (side === 'stone' ? stoneCount : entryCount)
  switch (code) {
    case 'ArrowUp':
      return { ...c, index: Math.max(0, c.index - 1) }
    case 'ArrowDown':
      return { ...c, index: Math.min(count(c.side) - 1, c.index + 1) }
    case 'ArrowLeft':
    case 'ArrowRight': {
      // The ledger is the left page and the rubbings the right page.
      const side: Cursor['side'] = code === 'ArrowLeft' ? 'entry' : 'stone'
      if (side === c.side) return c
      return { side, index: Math.min(c.index, count(side) - 1) }
    }
    default:
      return c
  }
}

/** Which stone's line F flags: the cursor's stone, the stone joined to the cursor's entry, or the selected stone. */
export function flagTarget(
  lines: readonly LedgerLine[],
  cursor: Cursor,
  stoneIds: readonly string[],
  entryIds: readonly string[],
  selected: string | null,
): string | null {
  if (cursor.side === 'stone') {
    const id = stoneIds[cursor.index]
    return id && lines.some((l) => l.stoneId === id) ? id : selected
  }
  const entry = entryIds[cursor.index]
  return lines.find((l) => l.ledgerId === entry)?.stoneId ?? selected
}

export type FlagOutcomeKind = 'right' | 'wrong' | 'no-line' | 'repeat'

export interface FlagOutcome {
  kind: FlagOutcomeKind
  lines: LedgerLine[]
  message: string
  /** True once the flags set now solve the minigame. */
  solved: boolean
}

/** The accepted flags, in the shape the verdict takes. */
const setFlags = (lines: readonly LedgerLine[]) =>
  lines.flatMap((l) => (l.flag ? [{ stoneId: l.stoneId, ledgerId: l.ledgerId, kind: l.flag }] : []))

/**
 * Set a flag on a stone's line. A wrong flag changes nothing and says "These two agree"; the
 * caller adds Doubt. A right one is kept, and `solved` is the pure `ledgerFlags` verdict.
 */
export function applyFlag(lines: readonly LedgerLine[], stoneId: string, kind: LedgerFlagKind): FlagOutcome {
  const line = lines.find((l) => l.stoneId === stoneId)
  const keep = [...lines]
  if (!line) return { kind: 'no-line', lines: keep, message: NO_LINE_MESSAGE, solved: false }
  if (line.flag === kind) {
    return { kind: 'repeat', lines: keep, message: `Already flagged: ${FLAG_LABEL[kind]}.`, solved: ledgerFlags(setFlags(lines)).ok }
  }
  if (!isRightLedgerFlag({ stoneId, ledgerId: line.ledgerId, kind })) {
    return { kind: 'wrong', lines: keep, message: LEDGER_WRONG_FLAG_MESSAGE, solved: false }
  }
  const next = lines.map((l) => (l.stoneId === stoneId ? { ...l, flag: kind } : l))
  const solved = ledgerFlags(setFlags(next)).ok
  return {
    kind: 'right',
    lines: next,
    message: solved ? SOLVED_MESSAGE : `Flagged: ${FLAG_LABEL[kind]}. These two do not agree.`,
    solved,
  }
}
