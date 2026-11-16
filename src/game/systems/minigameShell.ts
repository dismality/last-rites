// Pure rules for the Minigame overlay shell (spec 10 task 3.2, Req 11 and 6.2): which scares are
// held back, how the focus trap moves, what Esc does, and how results and captions read.
// No store, React or three.js imports.

import type { MinigameId } from '../../data/cases'

/** A result is never colour alone: each kind carries a glyph and words (Req 11.4). */
export type ResultKind = 'right' | 'wrong' | 'partial' | 'info'

const GLYPHS: Record<ResultKind, string> = { right: '✦', wrong: '✕', partial: '◐', info: '·' }

export interface ResultView {
  glyph: string
  /** Spoken label so a screen reader hears the kind, not just the colour. */
  label: string
  text: string
}

const LABELS: Record<ResultKind, string> = {
  right: 'Right',
  wrong: 'Wrong',
  partial: 'Not finished',
  info: 'Note',
}

export function resultView(kind: ResultKind, text: string): ResultView {
  return { glyph: GLYPHS[kind], label: LABELS[kind], text }
}

/**
 * Scare gate: no scare begins while any menu or a Minigame is open (Req 6.2, 11.5). The Minigame
 * flag is checked on its own so the rule holds even if `menuOpen` is ever computed without it.
 */
export function scareUiBlocking(menuOpen: boolean, minigameOpen: MinigameId | null): boolean {
  return menuOpen || minigameOpen !== null
}

/** What a key press means to the shell. `null` means the shell has no opinion. */
export type ShellKeyAction = { kind: 'close' } | { kind: 'focus'; index: number } | null

/**
 * Esc closes. Tab wraps inside the overlay in reading order (Req 11.3). `current` is the focused
 * item's index, or -1 when focus is outside the overlay.
 */
export function shellKeyAction(code: string, shift: boolean, current: number, count: number): ShellKeyAction {
  if (code === 'Escape') return { kind: 'close' }
  if (code !== 'Tab' || count <= 0) return null
  if (current < 0) return { kind: 'focus', index: shift ? count - 1 : 0 }
  const next = shift ? current - 1 : current + 1
  if (next < 0) return { kind: 'focus', index: count - 1 }
  if (next >= count) return { kind: 'focus', index: 0 }
  // Inside the range the browser's own Tab order is already the reading order.
  return null
}

/** Captions currently shown: trimmed, no blanks, no repeats, newest last, at most `max`. */
export function visibleCaptions(captions: readonly string[], max = 3): string[] {
  const out: string[] = []
  for (const c of captions) {
    const t = c.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out.slice(-max)
}

/** Shell title line, e.g. "Ledger Cross-check". The shell has no timer by day (Req 11.2). */
export interface ShellView {
  title: string
  captions: string[]
  /** Closing without an answer never discards what the player placed (Req 11.7). */
  closeKeepsProgress: true
  showsTimer: false
}

export function shellView(title: string, captions: readonly string[]): ShellView {
  return { title: title.trim(), captions: visibleCaptions(captions), closeKeepsProgress: true, showsTimer: false }
}
