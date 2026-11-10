// Readable tombstones and placed environmental clues (Requirements 3.1 to 3.3).
// Pure data. The ledger entries here are the parish register the player finds in
// Mausoleum Row; a stone whose date appears in it is a "wrong grave".

import type { HeadstoneKind, Vec3 } from './cemeteryLayout'
import type { ZoneId } from './zones'

export type TombstoneId = 'marsh' | 'hale' | 'ames' | 'pell' | 'crane-plaque'

export interface TombstoneDef {
  id: TombstoneId
  zone: ZoneId
  model: HeadstoneKind
  position: Vec3
  rotationY: number
  /** Stone height in metres (model is scaled to fit). */
  height: number
  /** Inscription lines, top to bottom, as cut into the stone. */
  inscription: readonly string[]
  /** ISO date carved on the stone; compared with the ledger. */
  date: string
  /** Clue recorded the first time the stone is read. */
  clueId?: string
  /** Clue recorded when the date is in the parish ledger and the player holds it. */
  wrongGraveClueId?: string
}

/** 1849 burials listed in the parish ledger (a sample of the thirty-one). */
export const LEDGER_1849_DATES: readonly string[] = [
  '1849-11-03',
  '1849-11-05',
  '1849-11-07',
  '1849-11-08',
  '1849-11-09',
]

export const TOMBSTONES: readonly TombstoneDef[] = [
  {
    id: 'marsh',
    zone: 'grounds',
    model: 'gravestone-wide',
    position: [-10.4, 0, -18.8],
    rotationY: 0.1,
    height: 1.1,
    inscription: ['MARSH', 'Eleven souls', 'Called home', '3rd November 1849'],
    date: '1849-11-03',
    clueId: 'clue-marsh-stone',
    wrongGraveClueId: 'clue-wrong-grave-marsh',
  },
  {
    id: 'hale',
    zone: 'grounds',
    model: 'gravestone-round',
    position: [-14.6, 0, -15.8],
    rotationY: -0.15,
    height: 1.1,
    inscription: ['TOBIAS HALE', 'Weaver of this parish', 'Rest in Peace', '5th November 1849'],
    date: '1849-11-05',
    wrongGraveClueId: 'clue-wrong-grave-hale',
  },
  {
    id: 'ames',
    zone: 'grounds',
    model: 'gravestone-cross',
    position: [16.4, 0, -22.6],
    rotationY: 0.2,
    height: 1.2,
    inscription: ['ESTHER AMES', 'Beloved wife', 'Gone before', '7th November 1849'],
    date: '1849-11-07',
    wrongGraveClueId: 'clue-wrong-grave-ames',
  },
  {
    // Decoy: a real death, never in the ledger, so the cross-check has a negative case.
    id: 'pell',
    zone: 'grounds',
    model: 'gravestone-bevel',
    position: [-8.4, 0, -22.4],
    rotationY: -0.1,
    height: 1,
    inscription: ['JOHN PELL', 'Sexton', 'Faithful to the last', '12th March 1862'],
    date: '1862-03-12',
  },
  {
    id: 'crane-plaque',
    zone: 'mausoleum-row',
    model: 'gravestone-broken',
    position: [-20, 0, -59.5],
    rotationY: Math.PI,
    height: 0.9,
    inscription: ['FATHER ALDOUS CRANE', 'Priest of Hollowmere', '"He kept them safe"', 'Died 1851'],
    date: '1851-02-14',
    clueId: 'clue-crane-plaque',
  },
]

export const TOMBSTONE_MAP: Readonly<Record<TombstoneId, TombstoneDef>> = Object.fromEntries(
  TOMBSTONES.map((t) => [t.id, t]),
) as Record<TombstoneId, TombstoneDef>

/** A clue found by examining a spot in the world rather than a tombstone. */
export interface ClueSpot {
  clueId: string
  position: Vec3
  /** Shape cue for the placeholder prop. */
  prop: 'parchment' | 'coat' | 'marks'
  /** Short name for the interact prompt. */
  label: string
}

export const CLUE_SPOTS: readonly ClueSpot[] = [
  { clueId: 'clue-hut-boots', position: [-2.2, 0, 1.6], prop: 'marks', label: "Elias's boots" },
  { clueId: 'clue-empty-graves', position: [12.5, 0, -20.5], prop: 'marks', label: 'Turned earth' },
  // Just east of the west-hill scare zone (x < -26), looking out toward the locket's grave.
  { clueId: 'clue-west-hill-glint', position: [-24.5, 0, 9], prop: 'marks', label: 'View of the west hill' },
  { clueId: 'clue-ledger-week', position: [7.6, 0, -4], prop: 'parchment', label: 'Burial notice' },
  { clueId: 'clue-row-statues', position: [-18.9, 0, -30], prop: 'marks', label: 'Statue plinth' },
  { clueId: 'clue-elias-body', position: [-18.9, 0, -59], prop: 'coat', label: 'Keeper\u2019s coat' },
  { clueId: 'clue-cat-scratches', position: [24, 0, 43.5], prop: 'marks', label: 'Scratch marks' },
  { clueId: 'clue-cat-names', position: [26, 0, 47], prop: 'marks', label: 'Names in bone' },
  { clueId: 'clue-cat-ledger-seal', position: [26, 0, 42], prop: 'parchment', label: 'Sealed entry' },
]
