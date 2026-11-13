// Case data (spec 10 task 2.1, design bible §13, docs/case-design.md §3). Three cases, one per
// stage. Answers are data; the case systems only compare player input with it. Minigame
// internals (ledger rows, bell posts, hymn board and so on) join this file in tasks 3 to 5.
// Pure data: no logic, no side effects.

import type { ItemId, RelicId } from '../game/types'
import type { InteractRuneId, MarkId } from './assets'
import { CLOSED_CASE_PAGES } from './caseText'
import type { CaseId, StageNumber } from './stages'
import type { ZoneId } from './zones'

export type { CaseId } from './stages'

export type MinigameId = '1a' | '1b' | '2a' | '2b' | '2c' | '3a' | '3b'

/** Clue ids are kebab-case literals, one union per case. */
export type Case1ClueId =
  | 'ledger-no-certificates'
  | 'ledger-date-mismatch'
  | 'pell-rope-cut'
  | 'ames-bell-rusted'
  | 'pell-tag-early'
  | 'hale-fresh-flowers'
  | 'marsh-stone-toppled'
export type Case2ClueId =
  | 'sexton-watch-ledger'
  | 'watch-log-gap'
  | 'boot-print-match'
  | 'surgeon-receipt'
  | 'spade-fresh-clay'
  | 'doctor-school-letter'
export type Case3ClueId =
  | 'hymn-letters-below'
  | 'elias-unsent-letter'
  | 'hearse-cart-ruts'
  | 'hearse-pin-hasp'
  | 'vane-ledger-flyleaf'
  | 'vane-receipt'
  | 'censer-chain-marks'
  | 'cold-hearth-hut'
export type ClueId = Case1ClueId | Case2ClueId | Case3ClueId

export type ClueIcon = InteractRuneId | MarkId

/** Where a clue is found (design "Data Models"). */
export type ClueSourceDef =
  | { kind: 'minigame'; id: MinigameId }
  | { kind: 'walk'; spot: ZoneId; position: readonly [number, number, number] }
  | { kind: 'purchase' }
  | { kind: 'item'; item: ItemId }

export interface ClueDef {
  id: ClueId
  title: string
  line: string
  icon: ClueIcon
  redHerring: boolean
  found: ClueSourceDef
}

/** A pair of clues that belong together, with the note shown when the player links them. */
export interface DeductionNote {
  a: ClueId
  b: ClueId
  text: string
}

export interface FinalSlotDef {
  label: string
  options: readonly string[]
}

export interface FinalQuestionDef {
  /** `{0}`, `{1}` ... mark the slots. */
  template: string
  slots: readonly FinalSlotDef[]
  answer: readonly string[]
  /** The Stage 3 accusation does not affect the win. */
  optional?: boolean
}

export interface HintTierDef {
  cost: 5 | 10 | 20
  text: string
}

export interface CaseDef {
  id: CaseId
  stage: StageNumber
  title: string
  /** 6 to 8 clues, at least 2 of them red herrings. */
  clues: readonly ClueDef[]
  notes: readonly DeductionNote[]
  minigames: readonly MinigameId[]
  final: FinalQuestionDef
  accusation?: FinalQuestionDef
  /** Which cards matter, the rule to apply, then the answer (docs/case-design.md §2). */
  hints: readonly [HintTierDef, HintTierDef, HintTierDef]
  /** 3 to 5 sentences, from `caseText.ts`. */
  closedPage: readonly string[]
  /** Correct board links needed to bring the Curse meter to 0. */
  curseSteps: number
}

/** Default Curse meter length; it mirrors `CURSE_MAX` in stages.ts. */
export const DEFAULT_CURSE_STEPS = 10

/** Hint tiers cost 5, 10 and 20 Grave Coins in order. */
export const HINT_COSTS = [5, 10, 20] as const

// The positions of walk clues are first guesses on the real map; task 3 to 5 props place them.
const CASE_1: CaseDef = {
  id: 'saved-by-the-bell',
  stage: 1,
  title: 'Saved by the Bell',
  clues: [
    {
      id: 'ledger-no-certificates',
      title: 'No certificate',
      line: 'A burial the ledger lists, with no certificate to match.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '1a' },
    },
    {
      id: 'ledger-date-mismatch',
      title: 'Wrong date',
      line: 'The stone and the ledger disagree on the day.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '1a' },
    },
    {
      id: 'pell-rope-cut',
      title: 'The cut rope',
      line: 'The bell rope at Pell is cut clean, by a knife and not by rot.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'ames-bell-rusted',
      title: 'The rusted bell',
      line: 'The Ames bell is rusted solid. It never rang.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'pell-tag-early',
      title: 'The hasty tag',
      line: 'The tag on the Pell bell gives a date before the ledger says he died.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'hale-fresh-flowers',
      title: 'Fresh flowers',
      line: 'A widow still visits the Hale grave.',
      icon: 'read',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-14, 0, -6] },
    },
    {
      id: 'marsh-stone-toppled',
      title: 'Toppled stone',
      line: 'The Marsh stone lies on its side. Frost heave, nothing more.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-9, 0, 4] },
    },
  ],
  notes: [
    {
      a: 'ledger-no-certificates',
      b: 'ledger-date-mismatch',
      text: 'Two entries in the same hand, and neither fits the stones.',
    },
    {
      a: 'pell-rope-cut',
      b: 'ames-bell-rusted',
      text: 'One bell was cut, one never could ring. Only one grave was meant to be silenced.',
    },
    {
      a: 'pell-rope-cut',
      b: 'pell-tag-early',
      text: 'Someone cut the rope and signed the certificate before he had died.',
    },
    {
      a: 'ledger-date-mismatch',
      b: 'pell-tag-early',
      text: 'The tag date is a day before the ledger date. The ledger was written to cover it.',
    },
  ],
  minigames: ['1a', '1b'],
  final: {
    template: 'The one buried alive lies in {0} because {1}.',
    slots: [
      { label: 'Grave', options: ["Pell's grave", "Hale's grave", "Ames's grave", "Marsh's grave"] },
      {
        label: 'Reason',
        options: [
          'the bell rope was cut and the certificate was signed before the death',
          'fresh flowers show she was still visited',
          'the stone fell in the frost',
          'the bell was rusted solid',
        ],
      },
    ],
    answer: [
      "Pell's grave",
      'the bell rope was cut and the certificate was signed before the death',
    ],
  },
  hints: [
    { cost: 5, text: 'Look at the cards from the ledger and the bells. The flowers and the stone do not matter.' },
    { cost: 10, text: 'Find the grave where the rope was cut and the date is wrong by a day.' },
    { cost: 20, text: "Pell's grave: the rope was cut, and the certificate was signed before the death." },
  ],
  closedPage: CLOSED_CASE_PAGES['saved-by-the-bell'],
  curseSteps: DEFAULT_CURSE_STEPS,
}

const CASE_2: CaseDef = {
  id: 'resurrection-men',
  stage: 2,
  title: 'The Resurrection Men',
  clues: [
    {
      id: 'sexton-watch-ledger',
      title: "Sexton's watch ledger",
      line: 'Who held the night watch, week by week.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '2a' },
    },
    {
      id: 'watch-log-gap',
      title: 'The two-hour gap',
      line: 'On the night the Ames grave was robbed, the lodge keeper logged nothing for two hours.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '2b' },
    },
    {
      id: 'boot-print-match',
      title: 'Matching boots',
      line: 'One cast at the grave matches one pair of hobnailed boots.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '2c' },
    },
    {
      id: 'surgeon-receipt',
      title: "Surgeon's receipt",
      line: 'A receipt for "subjects", in the lodge keeper\'s hand.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'walk', spot: 'mausoleum-row', position: [-24, 0, -44] },
    },
    {
      id: 'spade-fresh-clay',
      title: 'Spade with clay',
      line: 'Fresh clay on the gravedigger\'s spade. He dug a lawful grave that day.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-4, 0, 8] },
    },
    {
      id: 'doctor-school-letter',
      title: 'School letter',
      line: 'The doctor bought for the anatomy school, with a licence.',
      icon: 'read',
      redHerring: true,
      found: { kind: 'walk', spot: 'mausoleum-row', position: [-20, 0, -48] },
    },
  ],
  notes: [
    {
      a: 'watch-log-gap',
      b: 'sexton-watch-ledger',
      text: 'The ledger puts the lodge keeper on watch in that gap.',
    },
    {
      a: 'boot-print-match',
      b: 'watch-log-gap',
      text: 'The boots at the grave belong to the man whose watch went quiet.',
    },
    {
      a: 'surgeon-receipt',
      b: 'boot-print-match',
      text: 'The one who was paid is the one who left the prints.',
    },
  ],
  minigames: ['2a', '2b', '2c'],
  final: {
    template: 'The bodies were sold by {0}. Motive: {1}. Means: {2}. Opportunity: {3}.',
    slots: [
      { label: 'Who', options: ['the sexton', 'the doctor', 'the lodge keeper', 'the gravedigger'] },
      {
        label: 'Motive',
        options: [
          "the surgeon's receipt in his hand",
          'the anatomy school letter',
          'the fresh clay on the spade',
          'the sexton\'s watch ledger',
        ],
      },
      { label: 'Means', options: ['the matching boots', 'the cut rope', 'the iron hearse-pin', 'a licence'] },
      {
        label: 'Opportunity',
        options: ['the gap on his watch', 'the legal grave he dug', 'the flowers on Hale', 'the cold hearth'],
      },
    ],
    answer: [
      'the lodge keeper',
      "the surgeon's receipt in his hand",
      'the matching boots',
      'the gap on his watch',
    ],
  },
  hints: [
    { cost: 5, text: 'The receipt, the boots and the gap matter. The spade and the school letter do not.' },
    { cost: 10, text: 'Look for who was paid, whose boots were there and whose watch was empty. It is one man.' },
    { cost: 20, text: 'The lodge keeper: the receipt, the matching boots and the gap on his watch.' },
  ],
  closedPage: CLOSED_CASE_PAGES['resurrection-men'],
  curseSteps: DEFAULT_CURSE_STEPS,
}

/** The five relics in the order Crane's confession gives; task 4 can move the rite order here. */
const RITE_ORDER: readonly RelicId[] = [
  'crane-rosary',
  'sextons-bell-clapper',
  'childs-locket',
  'burial-shroud',
  'reliquary-heart',
]

const RELIC_NAMES = [
  "Crane's Rosary",
  "Sexton's Bell Clapper",
  "Child's Locket",
  'Burial Shroud',
  'Reliquary Heart',
] as const

const CASE_3: CaseDef = {
  id: 'sealed-catacombs',
  stage: 3,
  title: 'The Sealed Catacombs',
  clues: [
    {
      id: 'hymn-letters-below',
      title: 'Hymn letters',
      line: 'The first letters of the hymns spell BELOW.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '3a' },
    },
    {
      id: 'elias-unsent-letter',
      title: "Elias's letter",
      line: 'An unsent letter to the Bishop that names "the undertaker\'s family".',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '3b' },
    },
    {
      id: 'hearse-cart-ruts',
      title: 'Cart ruts',
      line: 'Hearse-cart ruts at the Row gate, the night Elias vanished.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '3b' },
    },
    {
      id: 'hearse-pin-hasp',
      title: 'The hearse-pin',
      line: 'An iron hearse-pin still in the crypt door\'s outer hasp.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '3b' },
    },
    {
      id: 'vane-ledger-flyleaf',
      title: 'Flyleaf name',
      line: 'Josiah Vane, parish undertaker, written in the same careful hand as the ledger.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'walk', spot: 'catacombs', position: [-8, -3, -75] },
    },
    {
      id: 'vane-receipt',
      title: 'Vane & Sons receipt',
      line: 'A receipt from the dawn merchant, in the same careful hand.',
      icon: 'trade',
      redHerring: false,
      found: { kind: 'purchase' },
    },
    {
      id: 'censer-chain-marks',
      title: 'Censer marks',
      line: 'Chain scratches on the chapel floor, left by Crane long ago.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'chapel', position: [10, 0, 6] },
    },
    {
      id: 'cold-hearth-hut',
      title: 'Cold hearth',
      line: 'The hut hearth has not been lit in weeks.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-2, 0, -2] },
    },
  ],
  notes: [
    {
      a: 'vane-ledger-flyleaf',
      b: 'vane-receipt',
      text: 'The same careful hand: father and son.',
    },
    {
      a: 'elias-unsent-letter',
      b: 'vane-ledger-flyleaf',
      text: '"The undertaker\'s family" is the Vane family.',
    },
    {
      a: 'hearse-cart-ruts',
      b: 'hearse-pin-hasp',
      text: 'A hearse cart came and went, and the pin that held the door came from it.',
    },
    {
      a: 'hymn-letters-below',
      b: 'elias-unsent-letter',
      text: 'What was hidden below, Elias wrote of before he was sealed in.',
    },
  ],
  minigames: ['3a', '3b'],
  // The rite is the winning answer; the relic slots are filled in order on the altar.
  final: {
    template: 'The rite: {0}, {1}, {2}, {3}, {4}.',
    slots: RITE_ORDER.map((_, i) => ({ label: `Relic ${i + 1}`, options: RELIC_NAMES })),
    answer: RELIC_NAMES,
  },
  accusation: {
    template: 'Elias was sealed in by {0}. Motive: {1}. Means: {2}. Opportunity: {3}.',
    slots: [
      { label: 'Who', options: ['Silas Vane', 'Father Crane', 'the sexton', 'the lodge keeper'] },
      { label: 'Motive', options: ['the handwriting', 'the cold hearth', 'the censer marks', 'a licence'] },
      { label: 'Means', options: ['the hearse-pin', 'the cut rope', 'the matching boots', 'a spade'] },
      { label: 'Opportunity', options: ['the cart ruts', 'the gap on his watch', 'the flowers', 'the hymn board'] },
    ],
    answer: ['Silas Vane', 'the handwriting', 'the hearse-pin', 'the cart ruts'],
    optional: true,
  },
  hints: [
    { cost: 5, text: 'The hymn letters, the letter, the ruts, the pin and the Vane hands matter. The hearth and chains do not.' },
    { cost: 10, text: 'Follow the handwriting: ledger, flyleaf and receipt. Then the cart and the pin show how.' },
    { cost: 20, text: 'Silas Vane: the handwriting, the hearse-pin and the cart ruts.' },
  ],
  closedPage: CLOSED_CASE_PAGES['sealed-catacombs'],
  curseSteps: DEFAULT_CURSE_STEPS,
}

export const CASES: readonly CaseDef[] = [CASE_1, CASE_2, CASE_3]

export const CASE_MAP: Readonly<Record<CaseId, CaseDef>> = {
  'saved-by-the-bell': CASE_1,
  'resurrection-men': CASE_2,
  'sealed-catacombs': CASE_3,
}

/** The case of a stage. */
export function caseOfStage(stage: StageNumber): CaseDef {
  return CASES[stage - 1]
}
