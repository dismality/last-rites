import type { ModeId } from '../game/types'

// Design bible §12 "Modes". Endless reuses Normal's modifiers; it differs only in
// having no story, a short day and no Retry Night.
export interface ModeDef {
  id: ModeId
  label: string
  hpMult: number
  damageMult: number
  lanternDrainMult: number
  eliteChance: number
  scoreMult: number
  /** Story modes play the five nights and the rite. */
  story: boolean
  /** Day length override in seconds; null keeps the normal day. */
  dayLengthS: number | null
  retryNight: boolean
}

export const ENDLESS = {
  dayS: 120,
  waveBase: 2,
  waveCap: 6,
  shamblerBase: 4,
  hpScale: 1.08,
  hpScaleAfterNight: 5,
} as const

const NORMAL_MODIFIERS = {
  hpMult: 1,
  damageMult: 1,
  lanternDrainMult: 1,
  eliteChance: 0.06,
  scoreMult: 1,
} as const

export const MODE_IDS: readonly ModeId[] = ['easy', 'normal', 'hard', 'endless']

export const MODES: Readonly<Record<ModeId, ModeDef>> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    hpMult: 0.75,
    damageMult: 0.6,
    lanternDrainMult: 0.75,
    eliteChance: 0.04,
    scoreMult: 0.75,
    story: true,
    dayLengthS: null,
    retryNight: true,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    ...NORMAL_MODIFIERS,
    story: true,
    dayLengthS: null,
    retryNight: true,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    hpMult: 1.25,
    damageMult: 1.4,
    lanternDrainMult: 1,
    eliteChance: 0.1,
    scoreMult: 1.5,
    story: true,
    dayLengthS: null,
    retryNight: true,
  },
  endless: {
    id: 'endless',
    label: 'Endless Survival',
    ...NORMAL_MODIFIERS,
    story: false,
    dayLengthS: ENDLESS.dayS,
    retryNight: false,
  },
}

export const DEFAULT_MODE: ModeId = 'normal'

export const ENDLESS_BEST_KEY = 'lastrites:endless-best'
