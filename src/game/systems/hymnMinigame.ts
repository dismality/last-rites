// Pure view rules for minigame 3a, the Hymn Board (spec 10 task 4.3, Req 15.1-15.4). The verdict
// itself is `hymnTiles` in caseMinigames.ts; this file only decides how the five brass tiles move
// under the keyboard. Left and right choose a tile, up and down change its letter, a letter key
// sets it, Backspace clears it. No React, three.js or Howler imports.

import { CASE_3_HYMN_BOARD } from '../../data/cases'
import { HYMN_TILE_COUNT } from './caseSave'

export type TileLetter = string | null
export type HymnTiles = readonly TileLetter[]

const A = 'A'.charCodeAt(0)
const LETTER_COUNT = 26

/** Left and right choose a tile; the row does not wrap, so the ends are felt. */
export function moveTile(index: number, code: string, count = HYMN_TILE_COUNT): number {
  if (code === 'ArrowLeft') return Math.max(0, index - 1)
  if (code === 'ArrowRight') return Math.min(count - 1, index + 1)
  return index
}

/** Up goes to the next letter, down to the one before; both wrap. An empty tile starts at A (up) or Z (down). */
export function stepLetter(current: TileLetter, code: string): TileLetter {
  if (code !== 'ArrowUp' && code !== 'ArrowDown') return current
  const up = code === 'ArrowUp'
  if (current === null) return String.fromCharCode(A + (up ? 0 : LETTER_COUNT - 1))
  const n = (current.charCodeAt(0) - A + (up ? 1 : LETTER_COUNT - 1)) % LETTER_COUNT
  return String.fromCharCode(A + n)
}

/** A key code such as `KeyB` gives its letter; anything else gives null. */
export function letterOfKey(code: string): string | null {
  return /^Key[A-Z]$/.test(code) ? code.slice(3) : null
}

/** Sets one tile (a copy; the input is never changed). */
export function setTile(tiles: HymnTiles, index: number, letter: TileLetter): TileLetter[] {
  return Array.from({ length: HYMN_TILE_COUNT }, (_, i) => (i === index ? letter : (tiles[i] ?? null)))
}

export function filledCount(tiles: HymnTiles): number {
  return tiles.filter((t) => t !== null).length
}

/** The psalter as rows for display: hymn number and title, 1 to 60. */
export function psalterRows(): { n: number; title: string }[] {
  return CASE_3_HYMN_BOARD.index.map((title, i) => ({ n: i + 1, title }))
}
