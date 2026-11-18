// Bestiary rules (spec 11 H2). Pure TypeScript: no React, three.js or Howler imports.
// A creature is "seen" once it was in the lantern cone or within 10 m of the player. The journal's
// Creatures page shows only seen creatures, and an unseen one exposes no name and no sketch.

import { BESTIARY_MAP, type BestiaryEntry } from '../../data/bestiary'
import { BESTIARY_SEEN_RADIUS_M, type CreatureId } from '../../data/creatures'
import type { Vec2 } from './combat'

const IDS: readonly CreatureId[] = ['crawler', 'bride', 'hound']

/** The seen set, kept in the order creatures were first seen. */
export type SeenCreatures = readonly CreatureId[]

export const emptySeen = (): SeenCreatures => []

/** Reads a saved value; anything that is not a known creature id is dropped, duplicates too. */
export function normalizeSeen(raw: unknown): SeenCreatures {
  if (!Array.isArray(raw)) return []
  const out: CreatureId[] = []
  for (const v of raw) if (IDS.includes(v as CreatureId) && !out.includes(v as CreatureId)) out.push(v as CreatureId)
  return out
}

export const seenCreatures = (seen: SeenCreatures): CreatureId[] => [...normalizeSeen(seen)]

/** True when the player can see this creature: in the lantern cone, or within 10 m. */
export function canSee(player: Vec2, creature: Vec2, inCone: boolean): boolean {
  return inCone || Math.hypot(player.x - creature.x, player.z - creature.z) <= BESTIARY_SEEN_RADIUS_M
}

/** Adds `id` to the seen set when it can be seen; otherwise returns the set unchanged. */
export function markSeen(seen: SeenCreatures, id: CreatureId, player: Vec2, creature: Vec2, inCone: boolean): SeenCreatures {
  if (seen.includes(id) || !canSee(player, creature, inCone)) return seen
  return [...seen, id]
}

/** The entry for a seen creature, or null: the UI cannot leak a name or sketch of an unseen one. */
export function bestiaryEntry(id: CreatureId, seen: SeenCreatures): BestiaryEntry | null {
  return seen.includes(id) ? (BESTIARY_MAP[id] ?? null) : null
}

/** Entries of every seen creature, in the order they were first seen. */
export function visibleEntries(seen: SeenCreatures): BestiaryEntry[] {
  return seen.flatMap((id) => {
    const e = bestiaryEntry(id, seen)
    return e ? [e] : []
  })
}
