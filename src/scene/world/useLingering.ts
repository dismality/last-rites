// Keeps objects the world just removed (a stack you took) on screen for a moment as "ghosts", so
// they can fade out instead of vanishing. A ghost is rendered with usedUp, never targetable, and
// is dropped after `ms`. Items that come back (a respawn with the same key) replace their ghost.

import { useEffect, useState } from 'react'

export interface Lingering<T> {
  item: T
  key: string
  /** Removed from the world; render it fading and untargetable. */
  gone: boolean
}

/** Longer than the cue fade (0.5 s) so the fade always finishes before the ghost unmounts. */
export const LINGER_MS = 900

/**
 * For a single object: true while `removed` is false, and for `ms` after it turns true (so its
 * Interactable stays mounted for the fade). Turns true again straight away when `removed` clears.
 */
export function useLingerAfter(removed: boolean, ms = LINGER_MS): boolean {
  const [expired, setExpired] = useState(removed)
  if (!removed && expired) setExpired(false)
  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setExpired(true), ms)
    return () => clearTimeout(timer)
  }, [removed, ms])
  return !removed || !expired
}

export function useLingering<T>(items: readonly T[], keyOf: (t: T) => string, ms = LINGER_MS): Lingering<T>[] {
  const [prev, setPrev] = useState<readonly T[]>(items)
  const [ghosts, setGhosts] = useState<ReadonlyMap<string, T>>(new Map())

  // Adjusting state while rendering (React's documented pattern) so the ghost appears in the same
  // commit as the removal, with no frame where the object is simply missing.
  if (items !== prev) {
    setPrev(items)
    const now = new Set(items.map(keyOf))
    const next = new Map(ghosts)
    for (const old of prev) if (!now.has(keyOf(old))) next.set(keyOf(old), old)
    for (const k of now) next.delete(k)
    if (next.size !== ghosts.size || [...next.keys()].some((k) => !ghosts.has(k))) setGhosts(next)
  }

  useEffect(() => {
    if (ghosts.size === 0) return
    const timer = setTimeout(() => setGhosts(new Map()), ms)
    return () => clearTimeout(timer)
  }, [ghosts, ms])

  const live = new Set(items.map(keyOf))
  return [
    ...items.map((item) => ({ item, key: keyOf(item), gone: false })),
    ...[...ghosts].filter(([k]) => !live.has(k)).map(([k, item]) => ({ item, key: k, gone: true })),
  ]
}
