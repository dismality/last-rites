// Storm, lightning and rain tuning (spec 08 Req 10, design bible §12 "Storms"). The pure storm
// rules in src/game/systems/storm.ts read these; nothing there carries its own numbers.

/** Chance that a storm rolls when this night starts. A night with no entry is treated as 0. */
export const STORM_CHANCE_NIGHT: Readonly<Record<number, number>> = {
  1: 0,
  2: 0.25,
  3: 0.4,
  4: 0.5,
  5: 1,
}

/** Chance that a storm rolls when a day starts. */
export const STORM_CHANCE_DAY = 0.15

export const STORM = {
  gapMinS: 20,
  gapMaxS: 45,
  thunderMinS: 1,
  thunderMaxS: 4,
  /** Spacing between nights in the lightning seed stream, so strike indices never collide. */
  nightSeedStride: 1000,
  fogAdd: 0.01,
  lanternDrainMult: 1.2,
  /** Thunder that follows its flash within this time is "close" (shake, loud caption). */
  closeThunderMaxS: 2,
  rainFadeS: 3,
} as const

export const LIGHTNING = {
  flashS: 0.15,
  /** Flashing lights off: a slow brightening to a low peak, no flash. */
  slowRiseS: 1.5,
  slowPeak: 0.3,
  slowFallS: 1.5,
  /** A strike never starts within this time before a major scare's beat. */
  holdBeforeBeatS: 1.5,
  ambientBoost: 1.4,
  moonBoost: 1.6,
  skyLerp: 0.5,
  skyColor: '#d6e4ff',
} as const

/** Rain noise bed (Req 10.5): high-pass into band-pass, on the sfx bus. */
export const RAIN_NOISE = {
  highpassHz: 500,
  bandpassHz: 2400,
  bandpassQ: 0.5,
  gain: 0.22,
  /** Muting while the sim is frozen is quick; only the storm fade takes the full STORM.rainFadeS. */
  freezeFadeS: 0.15,
} as const

export const RAIN = {
  count: 600,
  boxM: [36, 20, 36],
  speedMps: 16,
  lengthM: 0.9,
  widthM: 0.02,
  slantDeg: 8,
  opacity: 0.28,
} as const
