// Strange distant noises: odd sounds that drift in now and then for atmosphere only. They mean
// nothing, spawn nothing and change nothing; the "Strange noises volume" setting (0 turns them off)
// scales them. Files: public/assets/audio/ambience/strange-<id>.ogg (tools/audio/prompts.mjs,
// batch "strange"). Rules: src/game/systems/strangeNoises.ts.

export type StrangeNoiseId =
  | 'train'
  | 'music-box'
  | 'child-laugh'
  | 'organ'
  | 'knocks'
  | 'dog-howl'
  | 'hand-bell'
  | 'chains'
  | 'piano'
  | 'whistling'
  | 'pocket-watch'
  | 'owl'

export interface StrangeNoiseDef {
  id: StrangeNoiseId
  /** Subtitle while it plays (shown only with Subtitles on). */
  caption: string
  /** Relative pick weight. */
  weight: number
  /** Played right beside the listener instead of far off. */
  near?: boolean
}

export const STRANGE_NOISES: readonly StrangeNoiseDef[] = [
  { id: 'train', caption: '[a train passes somewhere far off]', weight: 3 },
  { id: 'music-box', caption: '[a music box plays, winding down]', weight: 2 },
  { id: 'child-laugh', caption: '[a child laughs, far away]', weight: 2 },
  { id: 'organ', caption: '[an organ chord from the empty chapel]', weight: 2 },
  { id: 'knocks', caption: '[three slow knocks, somewhere]', weight: 2 },
  { id: 'dog-howl', caption: '[a dog howls far across the fields]', weight: 3 },
  { id: 'hand-bell', caption: '[a hand bell rings in the distance]', weight: 2 },
  { id: 'chains', caption: '[chains drag across stone]', weight: 2 },
  { id: 'piano', caption: '[a single piano note from nowhere]', weight: 2 },
  { id: 'whistling', caption: '[someone whistles a tune, then stops]', weight: 2 },
  { id: 'pocket-watch', caption: '[a watch ticks right beside you, then stops]', weight: 1, near: true },
  { id: 'owl', caption: '[an owl screeches in the trees]', weight: 3 },
]

/** Recorded file name for a noise. */
export const strangeNoiseFile = (id: StrangeNoiseId): string => `strange-${id}`

export const STRANGE_TIMING = {
  /** Quiet for this long into a run before the first one (s). */
  firstAfterS: 75,
  /** Seconds between noises at dusk and night. */
  gapS: { min: 70, max: 170 },
  /** By day the gaps are this many times longer. */
  dayGapMult: 2.5,
  /** How far away a distant noise starts (m). */
  distanceM: { min: 35, max: 70 },
  /** A near noise sits this far from the listener (m). */
  nearDistanceM: 1.2,
  /** Height of the sound (m). */
  heightM: 2,
  /** Base playback level before the setting. */
  volume: 0.85,
  /** Past this the panner is silent (m). */
  maxDistanceM: 140,
  /** Subtitle time on screen (s). */
  captionS: 4,
} as const
