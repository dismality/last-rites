// Titles and pictures for the clue reveal and the journal's Clues tab (spec 09 task 11q).
// Clues at a spot use the spot's label; the rest (headstones, the plaque) have a short title here.

import { CLUE_SPOTS } from './tombstones'

const OTHER_TITLES: Readonly<Record<string, string>> = {
  'clue-marsh-stone': 'The Marsh stone',
  'clue-wrong-grave-marsh': 'Marsh, against the ledger',
  'clue-wrong-grave-hale': 'Hale, against the ledger',
  'clue-wrong-grave-ames': 'Ames, against the ledger',
  'clue-crane-plaque': 'Father Crane’s plaque',
}

/** Clues with a rendered picture: every clue spot (tools/blender/clue_icons.py). */
export const CLUE_PICTURE_IDS: readonly string[] = CLUE_SPOTS.map((s) => s.clueId)

export function clueTitle(clueId: string): string {
  return CLUE_SPOTS.find((s) => s.clueId === clueId)?.label ?? OTHER_TITLES[clueId] ?? 'A clue'
}

/** The clue's picture, or undefined when it has none (no placeholder is drawn). */
export function cluePicture(clueId: string): string | undefined {
  return CLUE_PICTURE_IDS.includes(clueId) ? `/assets/icons/clues/${clueId}.png` : undefined
}

/** The refusal shown when a ledger clue is examined without the parish ledger. */
export const LEDGER_REFUSAL = 'The entries mean nothing without the parish ledger to compare.'

/** Caption for the reveal's page-turn and quill sound. */
export const CLUE_REVEAL_CAPTION = '[quill scratches]'
