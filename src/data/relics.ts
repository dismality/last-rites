// Relics of the Rite of Rest — mirrored from docs/game-design.md §3.
// Pure data: no logic, no side effects.

import type { RelicId } from '../game/types'
import type { ZoneId } from './zones'

export interface RelicDef {
  id: RelicId
  name: string
  zone: ZoneId
  /** Id of the FixedSpawn (src/data/zones.ts) that holds this relic. */
  location: string
  /** Short line shown in the journal's relic list. */
  description: string
}

export const RELICS: readonly RelicDef[] = [
  {
    id: 'crane-rosary',
    name: "Crane's Rosary",
    zone: 'mausoleum-row',
    location: 'fx-rosary',
    description: 'Worn black beads from the Crane sarcophagus.',
  },
  {
    id: 'sextons-bell-clapper',
    name: "Sexton's Bell Clapper",
    zone: 'grounds',
    location: 'fx-bell-clapper',
    description: 'Iron clapper buried under the fallen bell tower.',
  },
  {
    id: 'childs-locket',
    name: "Child's Locket",
    zone: 'grounds',
    location: 'fx-locket',
    description: 'A tiny locket that only appears at night, on the smallest grave.',
  },
  {
    id: 'burial-shroud',
    name: 'Burial Shroud',
    zone: 'catacombs',
    location: 'fx-shroud',
    description: 'A grey shroud folded in the ossuary.',
  },
  {
    id: 'reliquary-heart',
    name: 'Reliquary Heart',
    zone: 'catacombs',
    location: 'fx-heart',
    description: 'Kept in the deepest chamber, behind the iron door.',
  },
]

export const RELIC_MAP: Readonly<Record<RelicId, RelicDef>> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
) as Record<RelicId, RelicDef>

/**
 * The order the rite takes the relics (spec 10 task 4.1, requirement 17.1). It is the order of
 * Crane's confession: his prayer, the bell that tolled, the smallest of the lost, the cloth that
 * covered them, and last the heart that was sealed away. Journal page 4 (Elias's note) lists the
 * same five in the same order, so the player can read it in the game and need not guess.
 */
export const RITE_ORDER: readonly RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

/** One line per step of the rite, as Crane's confession and Elias's note give it (shown by the altar). */
export const RITE_STEP_LINES: Readonly<Record<RelicId, string>> = {
  'crane-rosary': 'First the prayer: the beads he told over them.',
  'sextons-bell-clapper': 'Then the bell, that those below might be heard.',
  'childs-locket': 'Then the smallest of them, who was not named.',
  'burial-shroud': 'Then the cloth laid over the lost.',
  'reliquary-heart': 'Last the heart, that was kept behind the iron door.',
}
