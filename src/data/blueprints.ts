// Tier 3 blueprints (spec 10 task 10, Req 27.2): each is pieced together from 2 Case 3 clues.
// The keeper holds a blueprint once both clues are found; nothing is consumed.

import type { ClueId } from './cases'

export type BlueprintId = 'bp-nail-bomb' | 'bp-blessed-rounds'

export interface BlueprintDef {
  id: BlueprintId
  name: string
  /** The two clues that piece it together (ids from data/cases.ts). */
  clues: readonly [ClueId, ClueId]
}

export const BLUEPRINTS: Readonly<Record<BlueprintId, BlueprintDef>> = {
  // The hearse-pin's iron and the oil spilled in the other crypt: iron, oil and fire.
  'bp-nail-bomb': { id: 'bp-nail-bomb', name: 'Bomb plan', clues: ['hearse-pin-hasp', 'oil-other-crypt'] },
  // The old bishop's seal and the hymn's letters: the words to bless a round.
  'bp-blessed-rounds': {
    id: 'bp-blessed-rounds',
    name: 'Blessing rite',
    clues: ['old-bishops-seal', 'hymn-letters-below'],
  },
}
