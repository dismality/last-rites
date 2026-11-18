// Creature tells (spec 11 H2): every new creature warns 0.5 to 1.5 s before it does damage.
// Pure TypeScript: no React, three.js or Howler imports.

import { CREATURE_SOUNDS, CREATURE_TELL_S, type CreatureId, type CreatureSounds } from '../../data/creatures'
import type { Rng } from '../rng'

/** A warning length in [0.5, 1.5] s, drawn from the given stream. */
export function tellLead(rng: Rng): number {
  const r = Math.min(1, Math.max(0, rng()))
  return CREATURE_TELL_S.min + r * (CREATURE_TELL_S.max - CREATURE_TELL_S.min)
}

/** The tell and attack sounds of a creature (each has a caption in data/captions.ts). */
export function soundsFor(id: CreatureId): CreatureSounds {
  return CREATURE_SOUNDS[id]
}

/** True once the warning that began at `tellStart` has run for its whole `lead` by time `now`. */
export function tellElapsed(tellStart: number, lead: number, now: number): boolean {
  return now - tellStart >= lead
}
