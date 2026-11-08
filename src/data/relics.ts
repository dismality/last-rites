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
