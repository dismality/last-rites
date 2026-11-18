// Bestiary notes for the new creatures (spec 11 H2), mirrored from docs/game-design.md §14.2.
// Shown on the journal's Creatures page only once the creature has been seen.

import type { CreatureId } from './creatures'

/** Longest field note (characters). */
export const FIELD_NOTE_MAX = 200

export interface BestiaryEntry {
  id: CreatureId
  /** Shown only after the creature has been seen. */
  name: string
  fieldNote: string
  whatWorks: string
}

export const BESTIARY: readonly BestiaryEntry[] = [
  {
    id: 'crawler',
    name: 'Pale Crawler',
    fieldNote:
      'It waits under mounds and broken coffins and drags itself out when you pass. Its body is too low for a level swing.',
    whatWorks: 'Look down at it and swing, or chop with a heavy swing; shoot it, or burn it with a lantern trap.',
  },
  {
    id: 'bride',
    name: 'Hollow Bride',
    fieldNote: "A drifting bride seen only in your lantern's light. She cannot wound you, but her touch drinks your oil.",
    whatWorks: 'Holy water, the silver sabre, Blessed Rounds; she cannot cross salt. Lead passes through.',
  },
  {
    id: 'hound',
    name: 'Corpse Hound',
    fieldNote: 'They hunt in twos and threes, circling out of reach until one darts in.',
    whatWorks: 'A gunshot or a lantern flare scatters them; guns and heavy swings bring them down.',
  },
]

export const BESTIARY_MAP: Readonly<Record<CreatureId, BestiaryEntry>> = Object.fromEntries(
  BESTIARY.map((e) => [e.id, e]),
) as Readonly<Record<CreatureId, BestiaryEntry>>
