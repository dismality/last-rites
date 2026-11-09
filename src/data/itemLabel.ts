// Timing of the shared HUD item-name label (task 10.14).

export const ITEM_NAME_LABEL = {
  /** Fully visible time after a name is shown. */
  holdMs: 2000,
  /** Fade-out time after the hold. */
  fadeMs: 600,
  /** Fade-out when the player prefers reduced motion: nearly instant, not a slow dissolve. */
  reducedFadeMs: 100,
} as const
