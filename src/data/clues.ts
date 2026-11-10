// Clues — small discoveries that piece the mystery together (Requirement 3.3).
// Sources: readable tombstones, examinable props, environmental details, ledger entries.
// Pure data: no logic, no side effects.

import type { ItemId } from '../game/types'
import type { ZoneId } from './zones'

export type ClueSource = 'tombstone' | 'examine' | 'environment' | 'ledger'

export interface ClueDef {
  id: string
  zone: ZoneId
  source: ClueSource
  text: string
  /** Item the player must hold before this clue can be discovered. */
  requires?: ItemId
}

export const CLUES: readonly ClueDef[] = [
  // Grounds
  {
    id: 'clue-hut-boots',
    zone: 'grounds',
    source: 'examine',
    text: "Elias's boots stand by the hut door, dry and unworn. He did not walk out of here.",
  },
  {
    id: 'clue-empty-graves',
    zone: 'grounds',
    source: 'environment',
    text: 'The turned earth bulges upward. These graves were opened from the inside.',
  },
  {
    id: 'clue-marsh-stone',
    zone: 'grounds',
    source: 'tombstone',
    text: 'MARSH. Eleven names, one winter, 1849. The stone is newer than the dates it carries.',
  },
  {
    id: 'clue-ledger-week',
    zone: 'grounds',
    source: 'ledger',
    text: 'Thirty-one burials entered in one week, all in the same careful hand. No causes of death.',
    requires: 'parish-ledger',
  },
  // Points at the night-only Child's Locket (spec 09, F11): nothing else told the player.
  {
    id: 'clue-west-hill-glint',
    zone: 'grounds',
    source: 'environment',
    text: 'Something small glints on the west hill\u2026 but only after dark.',
  },
  // Wrong graves: stones whose date the parish ledger lists as a 1849 burial (Requirement 3.2).
  {
    id: 'clue-wrong-grave-marsh',
    zone: 'grounds',
    source: 'tombstone',
    text: 'The Marsh stone is dated 3 Nov 1849. The ledger lists the same day as a burial. Wrong grave: the stone was raised long after, and the earth beneath it is empty.',
    requires: 'parish-ledger',
  },
  {
    id: 'clue-wrong-grave-hale',
    zone: 'grounds',
    source: 'tombstone',
    text: 'Hale, 5 Nov 1849. The ledger agrees on the date, but no coffin was ever carried here. Wrong grave.',
    requires: 'parish-ledger',
  },
  {
    id: 'clue-wrong-grave-ames',
    zone: 'grounds',
    source: 'tombstone',
    text: 'Ames, 7 Nov 1849. Entered in the ledger that week, with no certificate. Wrong grave.',
    requires: 'parish-ledger',
  },
  // Mausoleum Row
  {
    id: 'clue-row-statues',
    zone: 'mausoleum-row',
    source: 'environment',
    text: 'The statues along the Row all face the chapel. Someone wanted the dead watched.',
  },
  {
    id: 'clue-crane-plaque',
    zone: 'mausoleum-row',
    source: 'tombstone',
    text: 'FATHER ALDOUS CRANE. "He kept them safe." The word safe has been scratched at.',
  },
  {
    id: 'clue-elias-body',
    zone: 'mausoleum-row',
    source: 'examine',
    text: 'A body in the Crane crypt wearing a keeper\u2019s coat. An iron key lies in its hand.',
  },
  // Catacombs
  {
    id: 'clue-cat-scratches',
    zone: 'catacombs',
    source: 'environment',
    text: 'Fingernail marks climb the stair side of the sealed door. They were not made by the dead.',
  },
  {
    id: 'clue-cat-names',
    zone: 'catacombs',
    source: 'examine',
    text: 'Names cut into the bone walls. Many match the ledger. The last is a child.',
  },
  {
    id: 'clue-cat-ledger-seal',
    zone: 'catacombs',
    source: 'ledger',
    text: 'The ledger entry for the catacombs reads "sealed", with no date of opening.',
    requires: 'parish-ledger',
  },
]

export const CLUE_MAP: Readonly<Record<string, ClueDef>> = Object.fromEntries(
  CLUES.map((c) => [c.id, c]),
)
