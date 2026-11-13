// Procedural sound recipes (Req 23.7). No audio files: `synth.ts` builds each voice from
// noise and oscillator layers on Howler's shared AudioContext. These are tuning values.

export type SoundId =
  | 'revolver-shot'
  | 'shotgun-blast'
  | 'dry-click'
  | 'reload'
  | 'weapon-break'
  | 'weapon-crack'
  | 'board-break'
  | 'board-nail'
  | 'bloater-hiss'
  | 'bloater-burst'
  | 'brute-grunt'
  | 'brute-step'
  | 'elite-arrival'
  | 'boss-rise'
  | 'congregation'
  | 'toll'
  | 'heavy-swing'
  | 'melee-hit'
  | 'kick'
  | 'dodge'
  | 'censer-chain'
  | 'effect-apply'
  | 'thunder-close'
  | 'thunder-far'
  | 'rain-noise'
  | 'pin-reached'

export interface NoiseLayer {
  kind: 'noise'
  filter: 'lowpass' | 'highpass' | 'bandpass'
  /** Filter frequency sweeps from start to end (Hz) over the layer's life. */
  fromHz: number
  toHz: number
  q: number
  gain: number
}

export interface ToneLayer {
  kind: 'tone'
  wave: 'sine' | 'square' | 'sawtooth' | 'triangle'
  fromHz: number
  toHz: number
  gain: number
}

export type SoundLayer = NoiseLayer | ToneLayer

export interface SoundRecipe {
  id: SoundId
  /** Heard from a world position (panned, distance-attenuated) or flat in the head. */
  spatial: boolean
  /** Panner max distance in metres. 0 for flat sounds. */
  maxDistanceM: number
  attackS: number
  decayS: number
  layers: readonly SoundLayer[]
}

const noise = (
  filter: NoiseLayer['filter'],
  fromHz: number,
  toHz: number,
  q: number,
  gain: number,
): NoiseLayer => ({ kind: 'noise', filter, fromHz, toHz, q, gain })

const tone = (wave: ToneLayer['wave'], fromHz: number, toHz: number, gain: number): ToneLayer => ({
  kind: 'tone',
  wave,
  fromHz,
  toHz,
  gain,
})

export const SOUND_RECIPES: Readonly<Record<SoundId, SoundRecipe>> = {
  'revolver-shot': {
    id: 'revolver-shot',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.002,
    decayS: 0.28,
    layers: [noise('lowpass', 5000, 400, 0.7, 0.9), tone('sine', 140, 45, 0.6)],
  },
  'shotgun-blast': {
    id: 'shotgun-blast',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.002,
    decayS: 0.55,
    layers: [noise('lowpass', 4000, 200, 0.7, 1), tone('sine', 90, 30, 0.8)],
  },
  'dry-click': {
    id: 'dry-click',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.001,
    decayS: 0.05,
    layers: [noise('highpass', 3000, 2000, 1, 0.4), tone('square', 1800, 900, 0.1)],
  },
  reload: {
    id: 'reload',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.01,
    decayS: 0.4,
    layers: [noise('bandpass', 2200, 1200, 4, 0.35), tone('square', 600, 300, 0.08)],
  },
  'weapon-break': {
    id: 'weapon-break',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.003,
    decayS: 0.35,
    layers: [noise('bandpass', 1800, 500, 2, 0.8), tone('triangle', 220, 90, 0.3)],
  },
  // A short dry crack: the warning that comes before 'weapon-break'.
  'weapon-crack': {
    id: 'weapon-crack',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.002,
    decayS: 0.12,
    layers: [noise('highpass', 2600, 1200, 1.5, 0.6), tone('triangle', 320, 160, 0.2)],
  },
  'board-break': {
    id: 'board-break',
    spatial: true,
    maxDistanceM: 45,
    attackS: 0.004,
    decayS: 0.5,
    layers: [noise('bandpass', 2400, 500, 1.5, 0.9), tone('triangle', 180, 70, 0.4)],
  },
  'board-nail': {
    id: 'board-nail',
    spatial: true,
    maxDistanceM: 20,
    attackS: 0.002,
    decayS: 0.12,
    layers: [tone('square', 1500, 900, 0.3), noise('highpass', 2500, 2500, 1, 0.25)],
  },
  'bloater-hiss': {
    id: 'bloater-hiss',
    spatial: true,
    maxDistanceM: 30,
    attackS: 0.6,
    decayS: 0.5,
    layers: [noise('highpass', 1500, 5000, 1, 0.5)],
  },
  'bloater-burst': {
    id: 'bloater-burst',
    spatial: true,
    maxDistanceM: 40,
    attackS: 0.005,
    decayS: 0.7,
    layers: [noise('lowpass', 1800, 150, 0.8, 0.9), tone('sine', 80, 35, 0.5)],
  },
  'brute-grunt': {
    id: 'brute-grunt',
    spatial: true,
    maxDistanceM: 35,
    attackS: 0.05,
    decayS: 0.8,
    layers: [tone('sawtooth', 70, 50, 0.5), noise('lowpass', 500, 200, 1, 0.3)],
  },
  'brute-step': {
    id: 'brute-step',
    spatial: true,
    maxDistanceM: 30,
    attackS: 0.005,
    decayS: 0.25,
    layers: [tone('sine', 65, 35, 0.9), noise('lowpass', 300, 100, 1, 0.3)],
  },
  'elite-arrival': {
    id: 'elite-arrival',
    spatial: true,
    maxDistanceM: 50,
    attackS: 0.2,
    decayS: 1.6,
    layers: [
      tone('sawtooth', 110, 55, 0.4),
      tone('sine', 55, 40, 0.5),
      noise('bandpass', 800, 300, 2, 0.2),
    ],
  },
  'boss-rise': {
    id: 'boss-rise',
    spatial: true,
    maxDistanceM: 60,
    attackS: 0.4,
    decayS: 1.4,
    layers: [noise('lowpass', 400, 120, 1.2, 0.9), tone('sine', 45, 30, 0.7)],
  },
  congregation: {
    id: 'congregation',
    spatial: true,
    maxDistanceM: 50,
    attackS: 0.3,
    decayS: 1.2,
    layers: [noise('bandpass', 600, 250, 2, 0.6), tone('triangle', 90, 60, 0.3)],
  },
  toll: {
    id: 'toll',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.01,
    decayS: 2.5,
    layers: [
      tone('sine', 196, 190, 0.7),
      tone('sine', 392, 385, 0.3),
      tone('sine', 587, 580, 0.15),
    ],
  },
  'heavy-swing': {
    id: 'heavy-swing',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.05,
    decayS: 0.3,
    layers: [noise('bandpass', 400, 1600, 1, 0.5)],
  },
  'melee-hit': {
    id: 'melee-hit',
    spatial: true,
    maxDistanceM: 25,
    attackS: 0.003,
    decayS: 0.18,
    layers: [noise('lowpass', 1200, 200, 1, 0.7), tone('sine', 120, 50, 0.5)],
  },
  kick: {
    id: 'kick',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.003,
    decayS: 0.15,
    layers: [tone('sine', 110, 45, 0.7), noise('lowpass', 800, 200, 1, 0.3)],
  },
  dodge: {
    id: 'dodge',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.03,
    decayS: 0.22,
    layers: [noise('highpass', 800, 2500, 0.7, 0.3)],
  },
  'censer-chain': {
    id: 'censer-chain',
    spatial: true,
    maxDistanceM: 40,
    attackS: 0.005,
    decayS: 0.3,
    layers: [tone('triangle', 2400, 1800, 0.12), noise('highpass', 4000, 3000, 2, 0.2)],
  },
  'effect-apply': {
    id: 'effect-apply',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.02,
    decayS: 0.5,
    layers: [tone('sine', 440, 660, 0.25), tone('sine', 660, 880, 0.12)],
  },
  // Close thunder is a sharp crack into a rumble; far thunder is only the low roll (spec 08 Req 10).
  'thunder-close': {
    id: 'thunder-close',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.01,
    decayS: 2.8,
    layers: [noise('lowpass', 3000, 90, 0.8, 0.9), tone('sine', 70, 28, 0.7)],
  },
  'thunder-far': {
    id: 'thunder-far',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.4,
    decayS: 3.4,
    layers: [noise('lowpass', 500, 70, 0.8, 0.6), tone('sine', 50, 30, 0.5)],
  },
  // A soft two-note chime: a map pin was reached (spec 09 task 11l).
  'pin-reached': {
    id: 'pin-reached',
    spatial: false,
    maxDistanceM: 0,
    attackS: 0.02,
    decayS: 0.7,
    layers: [tone('sine', 523, 520, 0.18), tone('sine', 784, 780, 0.1)],
  },
  // A steady hiss; the rain loop (src/audio/rain.ts) re-triggers or sustains it.
  'rain-noise': {
    id: 'rain-noise',
    spatial: false,
    maxDistanceM: 0,
    attackS: 1,
    decayS: 3,
    layers: [noise('highpass', 1200, 1200, 0.5, 0.25), noise('bandpass', 5000, 5000, 0.7, 0.15)],
  },
}

export const SOUND_IDS = Object.keys(SOUND_RECIPES) as SoundId[]
