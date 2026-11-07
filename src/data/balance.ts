// Tuning constants for the day/night, lantern and stamina systems.
// Values mirror docs/game-design.md sections 6 and 8; the design bible wins on conflict.

// --- Day / night (design bible §8) ---
export const DAY_DURATION_S = 360
export const DUSK_DURATION_S = 30
export const DAWN_DURATION_S = 10
export const LAST_NIGHT = 5

/** Fog density per night number, index 0 = night 1. */
export const NIGHT_FOG_DENSITY: readonly number[] = [0.02, 0.03, 0.04, 0.05, 0.06]

// --- Lantern (design bible §6) ---
export const LANTERN_MAX_FUEL = 100
/** Seconds to burn 1% fuel. */
export const LANTERN_DRAIN_S_PER_PERCENT_DAY = 6
export const LANTERN_DRAIN_S_PER_PERCENT_NIGHT = 3
export const LANTERN_FLICKER_BELOW = 20
export const LANTERN_RADIUS_MIN_M = 2
export const LANTERN_RADIUS_MAX_M = 8
/** Ember glow at empty so the player always keeps a silhouette (horror-design: never fully black). */
export const LANTERN_EMBER_RADIUS_M = 1.5

// --- Stamina (design bible §6) ---
export const STAMINA_MAX = 100
export const STAMINA_DRAIN_PER_S = 20
export const STAMINA_REGEN_PER_S = 15
export const STAMINA_REGEN_DELAY_S = 1
