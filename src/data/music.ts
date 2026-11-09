// Reactive music tuning (spec 08 Req 9, design bible §12 "Reactive music"). Procedural Web Audio
// only: the graph in src/audio/music.ts reads SYNTH_MUSIC, the pure layer/mixer rules read MUSIC.

export type MusicLayer = 0 | 1 | 2 | 3

export const MUSIC = {
  crossfadeS: 2,
  duckFadeS: 0.3,
  fadeInS: 2,
  silenceBeforeBeatS: 1.5,
  silenceAfterBeatS: 2,
  /** Nearest-zombie distance limits (m), inclusive. */
  distance: { danger: 6, tension: 15, unease: 30 },
} as const

/** Stem weights per layer as [drone, unease, tension, danger]. Layers add up (design table). */
export const STEM_WEIGHTS: Readonly<Record<MusicLayer, readonly [number, number, number, number]>> = {
  0: [1, 0, 0, 0],
  1: [1, 1, 0, 0],
  2: [0.8, 1, 1, 0],
  3: [1, 1, 1, 1],
}

/** Oscillator frequencies (Hz), filter cut-offs (Hz), LFO rates (Hz), stem peaks and heartbeat. */
export const SYNTH_MUSIC = {
  drone: { sineHz: 55, triangleHz: 82.4, lowpassHz: 240, lfoHz: 0.07 },
  unease: { detunedSineHz: 56.2, pulseSineHz: 110, pulseLfoHz: 0.9, lowpassHz: 400 },
  tension: { sawHz: [110, 110.9, 164.8], lowpassHz: 1100, filterLfoHz: 0.12, pulseLfoHz: 1.7 },
  danger: { subHz: 41.2 },
  heartbeat: { thudGapS: 0.22, periodS: 0.85, lookAheadS: 0.25, activeAbove: 0.05 },
  /** Peak gain of each stem: drone, unease, tension, danger. */
  stemPeaks: [0.55, 0.4, 0.35, 0.6],
  /** Smoothing for parameter writes, so the pure mixer keeps control of the fade times. */
  smoothingS: 0.04,
} as const
