// Enemy definitions — source of truth mirrored from docs/game-design.md §7.
// Pure data: no logic, no side effects.

export type EnemyId = 'shambler' | 'lurker' | 'wailer'

/**
 * Audio signature cues. Each enemy type is recognisable by ear before it is
 * seen (horror-design rule). The AudioManager maps these to real files later.
 */
export type AudioCueId = 'shambler-drag' | 'lurker-breath' | 'wailer-wail'

export interface EnemyDef {
  id: EnemyId
  name: string
  hp: number
  /** Normal movement speed in m/s. For the lurker this is its post-lunge chase speed. */
  speed: number
  damage: number
  /** Distance in metres at which a melee attack lands. */
  attackRange: number
  /** Seconds between attacks. */
  attackCooldown: number
  audio: AudioCueId
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'shambler',
    name: 'Shambler',
    hp: 60,
    speed: 1.4,
    damage: 10,
    attackRange: 1.2,
    attackCooldown: 1.5,
    audio: 'shambler-drag',
  },
  {
    id: 'lurker',
    name: 'Lurker',
    hp: 90,
    speed: 6, // lunge speed; it is motionless (0 m/s) until triggered
    damage: 20,
    attackRange: 1.2,
    attackCooldown: 1.5,
    audio: 'lurker-breath',
  },
  {
    id: 'wailer',
    name: 'Wailer',
    hp: 50,
    speed: 2.0,
    damage: 5,
    attackRange: 1.2,
    attackCooldown: 1.5,
    audio: 'wailer-wail',
  },
]

export const ENEMY_MAP: Readonly<Record<EnemyId, EnemyDef>> = Object.fromEntries(
  ENEMIES.map((e) => [e.id, e]),
) as Readonly<Record<EnemyId, EnemyDef>>

/** Lurker ambush rules. */
export const LURKER_TRIGGER_RADIUS = 4 // m, when the player is not facing it
/** Lantern fuel fraction (0–1) under which a lurker lunges regardless of facing. */
export const LURKER_LOW_FUEL_THRESHOLD = 0.2

/** Wailer behaviour. */
export const WAILER_KEEP_DISTANCE_MIN = 8 // m
export const WAILER_KEEP_DISTANCE_MAX = 12 // m
export const WAILER_SCREAM_INTERVAL = 8 // s
export const WAILER_PULL_RADIUS = 25 // m, zombies inside are drawn toward the player
export const WAILER_AUDIBLE_RADIUS = 40 // m

/** AI timing and tuning (combat-waves design: enemy state machines). */
export const ENEMY_RISE_S = 1.5 // clawing out of the grave, harmless
export const ENEMY_DYING_S = 1.5 // collapse-to-dust; removed after this (Req 4.6 says within 2 s)
export const ENEMY_ATTACK_WINDUP_S = 0.4 // telegraph before the blow lands
export const ENEMY_ATTACK_DURATION_S = 0.7
/** A swing still connects if the player has stepped back at most this far past attackRange. */
export const ENEMY_ATTACK_LEEWAY_M = 0.5

/** Lurker specifics. */
export const LURKER_TELEGRAPH_S = 0.8 // motionless breath before the lunge (fair scares: 0.5–1.5 s)
export const LURKER_LUNGE_MAX_S = 1.2 // gives up and chases if it overshoots
export const LURKER_CHASE_SPEED = 2.5 // m/s after the first lunge; 6 m/s forever would be a cheap death
/** Half-angle (deg) of the player's view cone; outside it the player is "not facing" the lurker. */
export const LURKER_FACING_HALF_ANGLE_DEG = 60
/**
 * Low lantern fuel only wakes lurkers this close, so one dim lantern does not
 * release every lurker on the map at once.
 */
export const LURKER_LOW_FUEL_RADIUS = 10

/** Wailer specifics. */
export const WAILER_SCREAM_DURATION_S = 1.0
export const WAILER_BOOST_S = 3
export const WAILER_BOOST_MULT = 1.5

/**
 * All three types share zombie.glb (docs/enemy-models.md); a colour multiplier and a
 * small scale change tell them apart. Tint multiplies the model's own colours.
 */
export const ENEMY_LOOKS: Readonly<Record<EnemyId, { tint: string; scale: number }>> = {
  shambler: { tint: '#ffffff', scale: 1 },
  lurker: { tint: '#6b6f7a', scale: 1.05 }, // darker, so it hides in alleys
  wailer: { tint: '#c9d6e6', scale: 0.92 }, // paler and smaller, a priority target by sight
}

/** Walk-cycle ground speed (m/s) the clip looks right at; timeScale = speed / this. */
export const ZOMBIE_WALK_CLIP_SPEED = 1.4
/** How far below ground a rising zombie starts (m). */
export const ENEMY_RISE_DEPTH_M = 1.1

/** Howler panner maxDistance per cue (m). Wailers carry furthest, per the design bible. */
export const CUE_MAX_DISTANCE: Readonly<Record<AudioCueId, number>> = {
  'shambler-drag': 18,
  'lurker-breath': 12,
  'wailer-wail': WAILER_AUDIBLE_RADIUS,
}

/** Subtitle lines for the key enemy sounds (shown when subtitles are enabled). */
export const CUE_SUBTITLES: Readonly<Record<AudioCueId, string>> = {
  'shambler-drag': '[wet dragging footsteps]',
  'lurker-breath': '[a sharp breath, close by]',
  'wailer-wail': '[a rising wail]',
}
