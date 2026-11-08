// Tuning for thrown and placed items (design bible §4; combat-waves requirements 3.1–3.6).
// Damage, radius and duration numbers live in weapons.ts; this file holds only
// what the weapon table does not: throw physics, fuse and trigger timings.

export type ThrowableId = 'holy-water-flask' | 'nail-bomb'
export type PlaceableId = 'lantern-trap' | 'salt-circle'

export const THROWABLE_IDS: readonly ThrowableId[] = ['holy-water-flask', 'nail-bomb']
export const PLACEABLE_IDS: readonly PlaceableId[] = ['lantern-trap', 'salt-circle']

export const GRAVITY = 9.81
/** Launch speed in m/s; about a 9 m throw at a slight upward angle. */
export const THROW_SPEED = 11
/** Extra upward angle added to the look pitch so a level throw still lobs (rad). */
export const THROW_LOFT_RAD = 0.12
/** Spawn point offset from the eye along the look direction (m); clears the player capsule. */
export const THROW_SPAWN_OFFSET_M = 0.6
/** Number of samples in the preview arc. */
export const ARC_STEPS = 40
/** Seconds between preview arc samples. */
export const ARC_STEP_S = 0.05

/** Flask stuns whatever it hits (seconds). Reuses the stagger timer in the AI. */
export const FLASK_STUN_S = 2
/** Nail bomb detonates this long after leaving the hand (design bible §4). */
export const NAIL_BOMB_FUSE_S = 2
/** A thrown flask that never lands shatters after this long. */
export const FLASK_MAX_FLIGHT_S = 6

/** Max distance in front of the player at which a placeable is set down (m). */
export const PLACE_DISTANCE_M = 1.5

/** A zombie this close springs the lantern trap (m). */
export const TRAP_TRIGGER_RADIUS_M = 1.5
/** Burn radius once sprung (m). */
export const TRAP_BURN_RADIUS_M = 2
/** Trap burn damage per second and duration come from WEAPON_MAP['lantern-trap']. */
export const TRAP_LIGHT_INTENSITY = 6
