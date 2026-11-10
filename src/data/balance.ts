// Tuning constants for the day/night, lantern and stamina systems.
// Values mirror docs/game-design.md sections 6 and 8; the design bible wins on conflict.

// --- Day / night (design bible §8) ---
export const DAY_DURATION_S = 360
export const DUSK_DURATION_S = 30
export const DAWN_DURATION_S = 10
/** Seconds of dawn left once the player has picked an upgrade (design bible §12). */
export const DAWN_AFTER_PICK_S = 2
export const LAST_NIGHT = 5

/** Fog density per night number, index 0 = night 1. */
export const NIGHT_FOG_DENSITY: readonly number[] = [0.02, 0.03, 0.04, 0.05, 0.06]

// --- Lantern (design bible §6) ---
export const LANTERN_MAX_FUEL = 100
/**
 * Daylight burns no oil (spec 09, B3 and F4): a 6-minute day used to cost ~60% before night 1.
 * Kept as a rate, so 0 needs no division.
 */
export const LANTERN_DRAIN_PERCENT_PER_S_DAY = 0
/** Seconds to burn 1% fuel at dusk and night. */
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

// --- Combat (design bible §4 and §7; combat-waves requirements 2.1, 3.3, 4.5) ---
/** Melee swing reach in metres. */
export const MELEE_RANGE_M = 1.8
/** Full width of the melee swing cone in degrees. */
export const MELEE_ARC_DEG = 70
/** Damage multiplier a holy water flask deals to Wailers. */
export const FLASK_WAILER_DAMAGE_MULT = 2

// --- Player health (design bible §6; combat-waves requirements 2.4, 6.1, 6.2) ---
export const PLAYER_MAX_HEALTH = 100
/** Share of incoming melee damage removed while blocking. */
export const BLOCK_DAMAGE_REDUCTION = 0.6
/** Movement speed multiplier while blocking. */
export const BLOCK_MOVE_MULT = 0.5
/** HP below this value starts the heartbeat and desaturation. */
export const LOW_HEALTH_THRESHOLD = 30

/** sessionStorage key for the state saved at the start of each dusk (Retry Night). */
export const DUSK_SNAPSHOT_KEY = 'lastrites:dusk'
/** sessionStorage key for the state saved at the start of each day (Retry from morning). */
export const MORNING_SNAPSHOT_KEY = 'lastrites:morning'
/** A retried night or morning never starts with less lantern oil than this, in % (design bible §8). */
export const RETRY_MIN_FUEL = 60

// --- Day 1 setup (spec 09, F1; design bible §3) ---
/** The first grave dug on day 1 yields at least this much bone, enough for a Bone Club. */
export const DAY1_FIRST_DIG_MIN_BONE = 3
/** The hut shelf holds at least this much cloth on day 1. */
export const DAY1_HUT_MIN_CLOTH = 1

/** Max distance (m) at which the crosshair can target an interactable. */
export const INTERACT_RANGE_M = 2.5
