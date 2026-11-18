// Lantern light constants (design bible §14.7, spec 11 §12.7). The flicker, hand and rig code read
// these; none of the numbers are repeated elsewhere.

export const LANTERN_LIGHT = {
  /** About 1900 K. */
  color: '#ffb46b',
  /** Below `lowOilBelow` percent oil the light shifts redder. */
  lowOilColor: '#ff6a3a',
  /** The one shadow-casting spot (1024 or smaller). */
  shadowMap: 1024,
  /** Fill point light, no shadow, at most this many metres. */
  fillRadius: 3,
  /** Slow breathing, in Hz. */
  breathHz: [0.2, 0.5],
  /** Gutters, in Hz. */
  gutterHz: [4, 12],
  /** Dips go down at most this fraction of the base. */
  dipMax: 0.25,
  /** Low oil is below this percent. */
  lowOilBelow: 15,
  /** Gutter amplitude multiplier (at least) below the low oil threshold. */
  lowOilGutterMult: 2,
  /** Gutter amplitude multiplier (at least) while sprinting or in a gust. */
  moveGutterMult: 1.5,
  /** With Flashing lights off: no frame-to-frame step over this fraction of the base. */
  flashingOffMaxStep: 0.1,
  /** With Flashing lights off: every change is slower than this many Hz. */
  flashingOffMaxHz: 1,
  /** The single flare when oil reaches 0, in seconds (at most). */
  flareS: 0.3,
  /** A Hollow Bride within 8 m dims the light by this fraction (×0.7). */
  brideDim: 0.3,
} as const

/** Tuning of the flicker signal (systems/lanternFlicker.ts). */
export const LANTERN_FLICKER = {
  /** The signal is a multiplier of the base light: never below or above these. */
  minMult: 0.75,
  maxMult: 1.15,
  /** Breathing amplitude (fraction of base). */
  breathAmp: 0.05,
  /** Gutter amplitude when walking with enough oil (fraction of base). */
  gutterAmp: 0.06,
  /** Dips: one chance per cell, a short bump of up to `LANTERN_LIGHT.dipMax`. */
  dipCellS: 2,
  dipChance: 0.3,
  dipLenS: 0.15,
  /** Flashing lights off: the one slow dip left (Hz and depth). */
  slowDipHz: 0.1,
  slowDipDepth: 0.08,
  /** Flashing lights off: oil 0 fades out over this long instead of flaring. */
  fadeOutS: 1,
  /** The flare briefly brightens by this fraction. */
  flareBoost: 0.15,
  /** Bride distance (m) inside which the light dims, and the slew limit with Flashing lights off. */
  brideRangeM: 8,
  brideSlewPerS: 0.7,
  /** Flame scale and glass emissive per unit of signal. */
  flameBase: 1,
  glassBase: 0.8,
  /** Breathing is two sine waves mixed with these weights (they sum to 1). */
  breathWeights: [0.6, 0.4],
  /** A dip's depth is dipMax times (floor + (1 - floor) * hash). */
  dipDepthFloor: 0.4,
  /** Seed offsets that decorrelate the dip chance, start and depth hashes. */
  dipSeedChance: 11,
  dipSeedStart: 23,
  dipSeedDepth: 37,
  /** Bit shifts of the integer hash (xorshift mix); pure hashing, not balance. */
  hashShiftMid: 13,
  hashShiftEnd: 16,
} as const

/** Shown once per run when the shotgun sends the lantern to the belt. */
export const LANTERN_HOOK_CAPTION = 'Lantern hooked to your belt'
/** How long the hook caption stays up (at least the 1.5 s caption floor). */
export const LANTERN_HOOK_CAPTION_S = 2
