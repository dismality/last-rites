// The F8 journal rule (spec 10, Req 10.1 and 10.2): reading the journal (or the big map) stops the
// world by day only. At dusk, night and dawn the world keeps running, so studying the case board
// costs the player something. Pure: no store or React imports.

import type { Phase } from '../types'

/** True when an open journal-like overlay freezes the simulation: only by day. */
export function pausesSim(phase: Phase, overlayOpen: boolean): boolean {
  return overlayOpen && phase === 'day'
}

/**
 * Esc closes the journal or the big map only while they pause the world. Once the world runs
 * (dusk, night, dawn) Esc must reach the pause menu at once, so it is never held back (Req 10.6).
 */
export function escClosesOverlay(phase: Phase, overlayOpen: boolean): boolean {
  return pausesSim(phase, overlayOpen)
}
