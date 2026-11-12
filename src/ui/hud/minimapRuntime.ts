// Counters the dev hook reads to check the minimap's redraw budget. Plain numbers, no subscribers,
// so keeping them costs nothing in play.
export const minimapRuntime = {
  /** Canvas redraws since the page loaded. */
  draws: 0,
  /** Animation frames the minimap loop has run (visible or not). */
  frames: 0,
}
