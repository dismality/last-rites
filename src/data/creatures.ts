// Traits of the three new creatures (spec 11 H2), mirrored from docs/game-design.md §14.2.
// Pure data: no logic, no side effects. Rules: game/systems/crawler.ts, bride.ts, hounds.ts.

import type { CaptionEvent } from './captions'
import type { SoundId } from './sounds'

export type CreatureId = 'crawler' | 'bride' | 'hound'

/** Every creature warns this long (s) before it does damage (fair scares: 0.5 to 1.5 s). */
export const CREATURE_TELL_S = { min: 0.5, max: 1.5 } as const

export const CRAWLER = {
  /** Crawler spots per stage 2 night, on distinct grave mounds or broken coffins. */
  spotsMin: 3,
  spotsMax: 6,
  /** Hidden until the player is this close (m), then it bursts out. */
  burstRangeM: 2,
  /** A burst this close and in front of the player starts the zombie-face scare (m). */
  faceRangeM: 1.5,
  /** Damage of a grab; one grab per cooldown per crawler. */
  grabDamage: 8,
  grabCooldownS: 1.5,
  /** A grab lands when the crawler is this close (m) once its tell has run out. */
  grabReachM: 1.2,
  crawlSpeedMps: 1.2,
  lungeSpeedMps: 6,
  lungeS: 0.6,
  /**
   * Looking this far down (radians, negative is down) turns a light swing into a downward one, so
   * aiming at a crawler on the ground hits it. A heavy swing is always downward.
   */
  downSwingPitchRad: -0.35,
} as const

export const BRIDE = {
  /** Seen only inside the lantern cone, or this close (m). */
  revealRadiusM: 3,
  /** Points of the 0 to 100 lantern fuel scale her touch drinks; never below 0. */
  drainPoints: 20,
  /** She vanishes at the touch and returns after a time in this range (s). At most one alive. */
  respawnMinS: 30,
  respawnMaxS: 60,
  maxAlive: 1,
  /** First stage she can appear in. */
  fromStage: 2,
  driftSpeedMps: 2.2,
  /** Her touch lands when she is this close (m) once her tell has run out. */
  touchRangeM: 1.2,
  /** Within this distance (m) the lantern flame bends and its light is multiplied by (1 - dim). */
  lanternDimNearM: 8,
  lanternDim: 0.3,
  /** With Flashing lights off the dim fades over at least this long (s). */
  lanternFadeMinS: 1,
} as const

export const HOUND = {
  packMin: 2,
  packMax: 3,
  /** Hounds circle the player at a distance in this range (m). */
  circleMinM: 4,
  circleMaxM: 6,
  dartDamage: 10,
  /** One dart at a time, at least this long (s) apart. */
  dartGapS: 2,
  /** A lantern flare or gunshot within this distance (m) scatters the pack, for scatterS, harmlessly. */
  scatterRadiusM: 15,
  scatterS: 4,
  /** A dart bites when the hound is this close (m); it gives up after dartMaxS seconds. */
  dartReachM: 1.2,
  dartMaxS: 3,
  /** Speed (m/s) along the circle while a hound circles the player. */
  circleSpeedMps: 3,
} as const

/**
 * How long a creature stays in the world before it slinks away (s). Keeps the wave's alive count
 * honest: a creature the player cannot yet kill must not hold a wave's alive-cap slot forever.
 */
export const CREATURE_LIFETIME_S = {
  /** An emerged crawler sinks back into the soil this long after it burst out. */
  crawlerEmerged: 25,
  /** A hound pack drifts off into the dark this long after it formed. */
  houndPack: 45,
} as const

/** At most this many hound packs at once (perf budget; hounds count in the alive caps). */
export const HOUND_PACKS_MAX = 2

/** The Hollow Bride appears this far from the player (m). */
export const BRIDE_SPAWN_DIST_M = { min: 22, max: 30 } as const

/** Half-angle (deg) of the lantern cone for "seen in the lantern light". */
export const LANTERN_CONE_HALF_DEG = 35

/** Sound sources sit at about knee height for crawlers and hounds, head height for the bride. */
export const CREATURE_SOUND_Y = { crawler: 0.2, bride: 1.5, hound: 0.6 } as const

/** Seen (bestiary): inside the lantern cone, or within this distance (m), once. */
export const BESTIARY_SEEN_RADIUS_M = 10

/** A scripted event never takes the player below this many HP if they were above it at the start. */
export const SCRIPTED_HP_FLOOR = 1

export interface CreatureSounds {
  /** The warning sound (3D, from the creature) and its caption. */
  tell: SoundId
  /** The sound of the attack itself and its caption. */
  attack: SoundId
}

export const CREATURE_SOUNDS: Readonly<Record<CreatureId, CreatureSounds>> = {
  crawler: { tell: 'crawler-tell', attack: 'crawler-grab' },
  bride: { tell: 'bride-tell', attack: 'bride-touch' },
  hound: { tell: 'hound-tell', attack: 'hound-bite' },
}

/** The caption event of every creature sound; each has a caption of at least 1.5 s in captions.ts. */
export const CREATURE_CAPTION_EVENTS: readonly CaptionEvent[] = Object.values(CREATURE_SOUNDS).flatMap((s) => [
  s.tell,
  s.attack,
])
