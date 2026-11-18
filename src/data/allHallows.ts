// All Hallows' Eve dressing: turnip lanterns, blowing leaves, the harvest moon and the autumn
// ambience (design bible §15). Visual and sound tuning only; none of it changes a game rule.

import type { Phase } from '../game/types'
import { HUT, type Vec3 } from './cemeteryLayout'

// --- Turnip lanterns ---------------------------------------------------------

/**
 * Carved turnips with a candle inside, the 1890s British and Irish jack-o'-lantern. Two flank the
 * hut step; the rest sit at the foot of the readable headstones and a few graves along the paths.
 */
export const TURNIP_LANTERNS: ReadonlyArray<{ position: Vec3; rotationY: number }> = [
  // Hut step, either side of the door (the doorway is 1.4 m wide, centred on x = 0).
  { position: [-1.1, 0, HUT.halfZ + 0.45], rotationY: 0.2 },
  { position: [1.1, 0, HUT.halfZ + 0.45], rotationY: -0.25 },
  // Readable headstones (src/data/tombstones.ts), beside the stone on its front side.
  { position: [-9.8, 0, -18.3], rotationY: 0.4 }, // marsh
  { position: [-14.0, 0, -15.3], rotationY: -0.3 }, // hale
  { position: [17.0, 0, -22.1], rotationY: 0.1 }, // ames
  { position: [-7.8, 0, -21.9], rotationY: -0.5 }, // pell
  // The oak-hollow grave and the chapel path.
  { position: [-17.6, 0, 14.2], rotationY: 0.9 },
  { position: [8.6, 0, -2.2], rotationY: 2.6 },
]

export const TURNIP = {
  /** Body radius before squashing, metres. */
  radius: 0.18,
  /** Height over width: turnips are a little squat. */
  squash: 0.82,
  /** Pale flesh shading to purple at the top, like a swede. */
  fleshColor: '#d9cfa8',
  topColor: '#6b3d6e',
  candleColor: '#ff9a3c',
  /** Emissive strength of the carved face at a steady flame. */
  glow: 3.2,
  /** Warm pool of light painted on the ground under each lantern (no real light: budget). */
  poolRadiusM: 0.75,
  poolOpacity: 0.5,
} as const

/** Candle flicker: two slow waves and a quick one, per lantern, so they never pulse together. */
export const CANDLE_FLICKER = {
  /** Brightness swing either side of 1 (0.18 = 0.82..1.18). */
  amount: 0.18,
  /** With Flashing lights off the flame barely moves. */
  calmAmount: 0.04,
  slowHz: 0.7,
  midHz: 1.9,
  fastHz: 7.3,
  /** Share of each wave in the mix (they add up to 1, so the swing never exceeds `amount`). */
  weights: [0.5, 0.3, 0.2] as const,
  /** How far each wave's phase is pushed per unit of a lantern's seed. */
  seedSpread: [1, 2.1, 3.7] as const,
} as const

// --- Autumn leaves -----------------------------------------------------------

export const LEAVES = {
  /** Leaves in the box around the camera; Low graphics halves it. */
  count: 160,
  /** Side of the square box around the camera that the leaves wrap within, metres. */
  boxM: 26,
  /** Leaves start falling from up to this height, metres. */
  topM: 4,
  /** Leaf size, metres. */
  sizeM: 0.09,
  fallSpeed: { min: 0.35, max: 0.8 },
  /** Wind along the ground, metres per second, blowing roughly from the north-west. */
  wind: { x: 0.9, z: 0.55 },
  /** Gusts swing the wind between (1 - gust) and (1 + gust) of its strength. */
  gust: 0.6,
  gustHz: 0.13,
  /** Side-to-side flutter while falling. */
  flutterM: 0.35,
  flutterHz: { min: 0.4, max: 1.1 },
  /** A landed leaf still skates along at this share of the wind, then lifts off again. */
  groundDrag: 0.25,
  groundTimeS: { min: 3, max: 9 },
  /** Share of the leaves already lying on the ground when the field is made. */
  startOnGround: 0.4,
  /** How the flutter splits across the wind's sideways X and Z (a leaf swings across the wind). */
  flutterMix: { x: 0.6, z: -0.4 },
  /** A leaf that lifts off again starts between this share of the top and the top. */
  relaunchFrom: 0.6,
  /** Storms blow harder. */
  stormWindScale: 2.2,
  colors: ['#9a4a1c', '#b8641f', '#7a3a18', '#c98a2a', '#5e3a1e', '#8c2f1a'],
} as const

// --- Harvest moon ------------------------------------------------------------

/** How much of the moon shows in each phase (it rises in the dusk and sets at dawn). */
export const MOON_SHOW: Readonly<Record<Phase, number>> = { day: 0, dusk: 0.55, night: 1, dawn: 0.25 }

export const HARVEST_MOON = {
  /**
   * Direction from the player to the moon: low behind the chapel as you approach its door from
   * the hut (the chapel is at +X +Z of the hut). Normalised in harvestMoon.ts.
   */
  direction: [0.42, 0.3, 1] as const,
  /** Drawn this far away (inside the camera's far plane of 200 m), metres. */
  distanceM: 170,
  /** Disc radius at that distance: about 9° across, a big low moon. */
  radiusM: 13,
  /** The halo is this many times the disc. */
  haloScale: 2.6,
  color: '#f2b36b',
  haloColor: '#c86a2a',
  haloOpacity: 0.45,
  /** Under storm cloud the moon is only a smudge. */
  stormShow: 0.15,
  /** Seconds to fade in or out when the phase changes. */
  fadeS: 6,
} as const

// --- Autumn ambience ---------------------------------------------------------

/** Recorded files this dressing plays (public/assets/audio, made by tools/audio). */
export const AUTUMN_SOUNDS = {
  wind: 'wind-night',
  crow: 'crow-caw',
  bell: 'bell-all-souls',
} as const

export const AUTUMN_AMBIENCE = {
  /** Wind bed level per phase, 0..1 (the filtered-noise stand-in plays until wind-night exists). */
  wind: { day: 0.25, dusk: 0.45, night: 0.6, dawn: 0.35 } as Readonly<Record<Phase, number>>,
  windFadeS: 4,
  /** Noise stand-in: a low band of noise whose loudness swells slowly like gusts. */
  windNoise: { lowpassHz: 520, gain: 0.05, swellHz: 0.09, swell: 0.5 },
  /** Recorded wind sits at this share of the bed level. */
  windFileGain: 0.55,
  /** Crows call by day and dusk from the trees, never at night. */
  crowGapS: { min: 12, max: 30 },
  crowPhases: ['day', 'dusk', 'dawn'] as readonly Phase[],
  crowDistanceM: { min: 14, max: 30 },
  crowVolume: 0.55,
  /** A far-off village bell tolls for All Souls through the night. */
  bellGapS: { min: 70, max: 130 },
  bellPhases: ['night'] as readonly Phase[],
  bellTolls: 3,
  bellTollGapS: 4.5,
  bellVolume: 0.3,
  /** Heard from beyond the south fence, far away. */
  bellPosition: [-20, 8, 140] as const,
  bellMaxDistanceM: 400,
} as const
