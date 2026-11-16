// Name the Dead (spec 10 task 11, Req 28): a small puzzle inside the fight. In Stage 2 and 3
// nights one opening grave per wave glows with a name; holding Interact at it speaks the name,
// seals the grave for that wave and scores. The names live in data/cases.ts (DEAD_NAMES).

import type { StageNumber } from './stages'

export const NAME_THE_DEAD = {
  /** Seconds Interact must be held without taking damage. */
  holdS: 3,
  /** Score for a sealed grave. */
  score: 100,
  /** The first stage whose nights have a glowing grave. */
  fromStage: 2 as StageNumber,
} as const

/** Req 28.4: a name that no evidence found so far gives. */
export const UNKNOWN_NAME_TEXT = "You don't know who lies here."

/** Req 28.3: the hold is broken by a hit. */
export const NAME_HIT_TEXT = 'Struck. The name is lost.'

/** The toast once a grave is sealed. NAME is the name spoken. */
export const NAME_SEALED_TEXT = 'NAME rests. The grave is sealed for this wave.'
