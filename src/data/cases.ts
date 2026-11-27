// Case data (spec 10 task 2.1, design bible §15, docs/case-design.md §3). Three cases, one per
// stage. Answers are data; the case systems only compare player input with it. Minigame
// internals (ledger rows, bell posts, hymn board and so on) join this file in tasks 3 to 5.
// Pure data: no logic, no side effects.

import type { ItemId } from '../game/types'
import type { InteractRuneId, MarkId } from './assets'
import { CLOSED_CASE_PAGES } from './caseText'
import { RELIC_MAP, RITE_ORDER } from './relics'
import type { CaseId, StageNumber } from './stages'
import type { ZoneId } from './zones'

export type { CaseId } from './stages'

export type MinigameId = '1a' | '1b' | '2a' | '2b' | '2c' | '2d' | '3a' | '3b' | '3c' | '3d'

/** Clue ids are kebab-case literals, one union per case. */
export type Case1ClueId =
  | 'ledger-wrong-cause'
  | 'ledger-date-mismatch'
  | 'pell-rope-cut'
  | 'two-bells-ring'
  | 'pell-tag-early'
  | 'hale-fresh-flowers'
  | 'marsh-stone-toppled'
export type Case2ClueId =
  | 'robbed-grave'
  | 'watch-log-gap'
  | 'boot-print-match'
  | 'vane-sons-receipt'
  | 'spade-fresh-clay'
  | 'doctor-school-letter'
export type Case3ClueId =
  | 'hymn-letters-below'
  | 'hearse-cart-ruts'
  | 'hearse-pin-hasp'
  | 'elias-unsent-letter'
  | 'silas-handwriting'
  | 'vane-receipt'
  | 'oil-other-crypt'
  | 'old-bishops-seal'
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
  /**
   * The case board asks this about card `a`; the answer is card `b` (playtest: free linking was
   * guesswork). It must not name `b`'s title.
   */
  question?: string
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
  /** Not judged as the case answer (the Stage 3 accusation, given before the rite). */
  optional?: boolean
  /**
   * Typed at the altar instead of chosen (playtest: options gave the answer away). `template` is
   * then the whole question, `slots` and `answer` are empty, and any of these forms is right.
   * Matching ignores case, spaces and punctuation (`normalizeAnswer` in caseAnswer.ts).
   */
  typed?: {
    accept: readonly string[]
    /** Forms that are neither right nor wrong: the altar asks again with `reply` and counts nothing. */
    ask?: { forms: readonly string[]; reply: string }
  }
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

// ---- Case 1 minigame data (spec 10 task 3.1) ----

export type LedgerFlagKind = 'date' | 'plot' | 'cause'

/** One line of the parish register page on the hut shelf (minigame 1a, left page). */
export interface LedgerEntryDef {
  id: string
  name: string
  /** ISO date of death as the ledger writes it. */
  date: string
  plot: string
  cause: string
  doctor: string
  /** False when the line cites no death certificate. */
  certificate: boolean
  /** Initials written in the margin beside a line that was changed after the burial. */
  amendedBy?: string
}

/** A readable stone (minigame 1a, right page: the rubbing). */
export interface StoneRubbingDef {
  id: string
  name: string
  date: string
  plot: string
  /** What the stone says took them, when it says. */
  cause?: string
  /** The ledger line this stone belongs to. */
  ledgerId: string
  /** Where the stone stands. The four old stones reuse `tombstones.ts`; the two new ones are guesses. */
  position: readonly [number, number, number]
  /** The one mismatch a careful reader finds, when there is one. */
  mismatch?: LedgerFlagKind
}

export type BellPostId = 'bell-pell' | 'bell-hale' | 'bell-ames'

export type BellCondition = 'rope-cut' | 'intact'

/** A safety-bell post at a candidate grave (minigame 1b). */
export interface BellPostDef {
  id: BellPostId
  stone: string
  position: readonly [number, number, number]
  rope: string
  bell: string
  tag: string
  condition: BellCondition
  /** The clue the player gets by finding the telling detail, if any. */
  clueId?: Case1ClueId
  /** The clue the tag gives, when the tag itself is telling (Pell's early date). */
  tagClueId?: Case1ClueId
}

/** Shown when a ledger flag is wrong (requirement 12.4). */
export const LEDGER_WRONG_FLAG_MESSAGE = 'These two agree. The ledger is innocent on this one'

/** Shown when the wrong post is named as the cut bell (requirement 13.4). */
export const BELL_WRONG_POST_MESSAGE = 'That bell rang when you pulled it. Which one stayed silent?'

export const CASE_1_LEDGER: readonly LedgerEntryDef[] = [
  {
    id: 'l-marsh',
    name: 'Marsh (eleven)',
    date: '1849-11-03',
    plot: 'Grounds, north row 2',
    cause: 'Cholera',
    doctor: 'Dr. Pryor',
    certificate: true,
  },
  {
    id: 'l-hale',
    name: 'Tobias Hale',
    date: '1849-11-05',
    plot: 'Grounds, east row 4',
    cause: 'Cholera',
    doctor: 'Dr. Pryor',
    certificate: true,
    amendedBy: 'J.V.',
  },
  {
    id: 'l-ames',
    name: 'Esther Ames',
    date: '1849-11-07',
    plot: 'Grounds, east row 1',
    cause: 'A fall',
    doctor: 'Dr. Pryor',
    certificate: true,
    amendedBy: 'J.V.',
  },
  {
    id: 'l-corbet',
    name: 'Anne Corbet',
    date: '1849-11-08',
    plot: 'Grounds, south row 3',
    cause: 'Cholera',
    doctor: 'Dr. Pryor',
    certificate: true,
  },
  {
    id: 'l-child',
    name: 'A child, unnamed',
    date: '1849-11-09',
    plot: 'Grounds, west hill',
    cause: 'Cholera',
    doctor: 'Dr. Pryor',
    certificate: true,
  },
  {
    id: 'l-wren',
    name: 'Martha Wren',
    date: '1851-06-20',
    plot: 'Grounds, north row 5',
    cause: 'Age',
    doctor: 'Dr. Lisle',
    certificate: true,
  },
  {
    id: 'l-dowd',
    name: 'Samuel Dowd',
    date: '1856-01-09',
    plot: 'Grounds, east row 3',
    cause: 'Fall',
    doctor: 'Dr. Lisle',
    certificate: true,
  },
  {
    id: 'l-pell',
    name: 'John Pell, sexton',
    date: '1862-03-11',
    plot: 'Grounds, north row 3',
    cause: 'Apoplexy',
    doctor: 'Dr. Lisle',
    certificate: true,
    amendedBy: 'J.V.',
  },
]

export const CASE_1_STONES: readonly StoneRubbingDef[] = [
  {
    id: 'marsh',
    name: 'Marsh',
    date: '1849-11-03',
    plot: 'Grounds, north row 2',
    ledgerId: 'l-marsh',
    position: [-10.4, 0, -18.8],
  },
  {
    id: 'hale',
    name: 'Tobias Hale',
    date: '1849-11-05',
    plot: 'Grounds, west row 1',
    cause: 'Cholera',
    ledgerId: 'l-hale',
    position: [-14.6, 0, -15.8],
    mismatch: 'plot',
  },
  {
    id: 'ames',
    name: 'Esther Ames',
    date: '1849-11-07',
    plot: 'Grounds, east row 1',
    cause: 'Fever',
    ledgerId: 'l-ames',
    position: [16.4, 0, -22.6],
    mismatch: 'cause',
  },
  {
    id: 'pell',
    name: 'John Pell',
    date: '1862-03-12',
    plot: 'Grounds, north row 3',
    cause: 'Apoplexy',
    ledgerId: 'l-pell',
    position: [-8.4, 0, -22.4],
    mismatch: 'date',
  },
  // Guessed positions: free ground in the grounds' graveyard, to be checked when task 3.4 places them.
  {
    id: 'wren',
    name: 'Martha Wren',
    date: '1851-06-20',
    plot: 'Grounds, north row 5',
    ledgerId: 'l-wren',
    position: [-12.6, 0, -12.4],
  },
  {
    id: 'dowd',
    name: 'Samuel Dowd',
    date: '1856-01-09',
    plot: 'Grounds, east row 3',
    ledgerId: 'l-dowd',
    position: [14, 0, -18],
  },
]

/** The three flags that narrow the case to three graves. */
export const CASE_1_RIGHT_FLAGS: readonly { stoneId: string; kind: LedgerFlagKind }[] = [
  { stoneId: 'pell', kind: 'date' },
  { stoneId: 'ames', kind: 'cause' },
  { stoneId: 'hale', kind: 'plot' },
]

// Posts stand 1.2 m beside their stones (x offset). Hale's is on the west side to clear the journal page 2 spawn. Checked by caseLayout.test.ts.
export const CASE_1_BELLS: readonly BellPostDef[] = [
  {
    id: 'bell-pell',
    stone: 'pell',
    position: [-7.2, 0, -22.4],
    rope: 'The cord ends in a clean slant, cut by a blade. It hangs loose and pulls nothing.',
    bell: 'The bell is sound, but with the cord cut it can never ring.',
    tag: 'Death certificate signed 11 March 1862 by J. Vane, Undertaker. His stone says he died on the 12th.',
    condition: 'rope-cut',
    clueId: 'pell-rope-cut',
    tagClueId: 'pell-tag-early',
  },
  {
    id: 'bell-hale',
    stone: 'hale',
    position: [-15.8, 0, -15.8],
    rope: 'The rope is whole, a little green with damp.',
    bell: 'The bell rings clear when turned.',
    tag: 'Death certificate signed 5 November 1849 by Dr. Pryor, the day of death.',
    condition: 'intact',
  },
  {
    id: 'bell-ames',
    stone: 'ames',
    position: [17.6, 0, -22.6],
    rope: 'The cord is whole, a little stiff.',
    bell: 'The bell rings clear when the cord is pulled.',
    tag: 'Death certificate signed 7 November 1849 by Dr. Pryor, the day of death.',
    condition: 'intact',
    clueId: 'two-bells-ring',
  },
]

/** Case 1's reward: the altar hands over the Rusted Crypt Key when the case is solved (design bible §2).
 * Its world copy in Pell's grave is marked taken then, so it is never searched for. */
export const CASE_1_REWARD = {
  item: 'rusted-crypt-key',
  stone: 'pell',
  position: [-8.4, 0, -21.6],
} as const satisfies { item: ItemId; stone: string; position: readonly [number, number, number] }

// ---- Case 2 minigame data (story pass) ----
// Fresh graves by the lodge are checked against the burial register (2a), the watch log for the
// night of the robbery is read (2b), the print from the robbed grave is compared with the boots by
// the lodge table (2c), and the key from Kerr's boot opens his crest-locked locker (2d).

/** The lodge keeper and the night porter who countersigns his rounds. PLACEHOLDER names. */
export const CASE_2_PEOPLE = { keeper: 'Kerr', porter: 'Dale' } as const

export type FreshGraveId = 'cobb' | 'reade' | 'finch'

/** A fresh grave near the lodge and its line in the burial register on the lodge table (2a). */
export interface FreshGraveDef {
  id: FreshGraveId
  name: string
  /** Day of October 1891 it was buried; the register and the grave's marker agree on it. */
  buried: number
  /** What the register says. */
  register: string
  /** What the grave shows when it is inspected. */
  looks: string
  robbed: boolean
  /** The foot of the mound; the marker stands at its head, 1 m north. */
  position: readonly [number, number, number]
}

/** October 1891, three weeks after Elias went missing. Finch's is the robbed grave. */
export const CASE_2_FRESH_GRAVES: readonly FreshGraveDef[] = [
  {
    id: 'cobb',
    name: 'Ellen Cobb',
    buried: 9,
    register: 'Buried the 9th of October. Grave filled and settled.',
    looks: 'The soil is settled, and grass is coming through. Nobody has touched it.',
    robbed: false,
    position: [-30.2, 0, -31],
  },
  {
    id: 'reade',
    name: 'Thomas Reade',
    buried: 11,
    register: 'Buried the 11th of October. Grave filled and settled.',
    looks: 'The soil is settled and firm. Nobody has touched it.',
    robbed: false,
    position: [-28, 0, -31],
  },
  {
    id: 'finch',
    name: 'Arthur Finch',
    buried: 14,
    register: 'Buried the 14th of October. Grave filled and settled.',
    looks: 'Loose soil, yellow clay spread on the grass, and the coffin lid showing through. The coffin is empty.',
    robbed: true,
    position: [-25.8, 0, -31],
  },
]

export const CASE_2_ROBBED_GRAVE: FreshGraveDef = CASE_2_FRESH_GRAVES.find((g) => g.robbed)!

/** The burial register on the lodge table, beside the watch log. */
export const CASE_2_REGISTER_POSITION = [-24.25, 0.81, -36.6] as const

/** One round in the watch log for the night of the 14th (2b). Read only: nothing to put in order. */
export interface WatchRoundDef {
  time: string
  text: string
  watchman: string
  /** The night porter's countersign, or null where the box is empty. */
  countersign: string | null
}

export const CASE_2_WATCH_ROUNDS: readonly WatchRoundDef[] = [
  { time: '8 pm', text: 'Rounds, all quiet.', watchman: 'Kerr', countersign: 'Dale' },
  { time: '10 pm', text: 'Rounds, all quiet.', watchman: 'Kerr', countersign: 'Dale' },
  { time: '12 am', text: 'Rounds, all quiet.', watchman: 'Kerr', countersign: null },
  { time: '2 am', text: 'Rounds, all quiet.', watchman: 'Kerr', countersign: null },
  { time: '4 am', text: 'Rounds, all quiet.', watchman: 'Kerr', countersign: 'Dale' },
]

/** The watch log lies open on the lodge table (top 0.8); the shotgun lies at the table's centre. */
export const CASE_2_LOGBOOK_POSITION = [-23.45, 0.81, -36.45] as const

/** What a boot sole or the print shows. Each feature reads on Low graphics in the drawing. */
export interface SoleDef {
  heel: string
  nails: string
  sole: string
  /** Yellow clay from the robbed grave caked in the tread. */
  clay: boolean
}

export type BootId = 'visitor' | 'dale' | 'kerr'

export interface BootDef extends SoleDef {
  id: BootId
  title: string
}

/** The print cast in the mud at the foot of the robbed grave. */
export const CASE_2_PRINT: SoleDef = {
  heel: 'square, iron-tipped',
  nails: 'a full ring of hobnails',
  sole: 'cracked straight across',
  clay: true,
}

export const CASE_2_PRINT_POSITION = [-25.4, 0.01, -30.1] as const

/** The three pairs by the lodge table, left to right. Kerr's match the print. */
export const CASE_2_BOOTS: readonly BootDef[] = [
  {
    id: 'visitor',
    title: "A visitor's narrow boot",
    heel: 'narrow, a town heel',
    nails: 'none',
    sole: 'smooth, no crack',
    clay: false,
  },
  {
    id: 'dale',
    title: "Dale's porter's shoes",
    heel: 'broad and low',
    nails: 'a few, worn flat',
    sole: 'whole, no crack',
    clay: false,
  },
  {
    id: 'kerr',
    title: "Kerr's work boots",
    ...CASE_2_PRINT,
  },
]

export const CASE_2_BOOT_MATCH: BootId = 'kerr'

/** Where the boots stand, on the ground at the east end of the lodge table. */
export const CASE_2_BOOTS_POSITION = [-22.1, 0, -35.6] as const

export type VaneCrestId = 'raven-coffin' | 'owl-book' | 'stag-gate' | 'hound-lantern' | 'lion-spade' | 'dove-bell'

export interface CrestDef {
  id: VaneCrestId
  beast: string
  object: string
}

/** The six crests on the locker's dial plate, clockwise from the top. */
export const CASE_2_CRESTS: readonly CrestDef[] = [
  { id: 'owl-book', beast: 'owl', object: 'book' },
  { id: 'stag-gate', beast: 'stag', object: 'gate' },
  { id: 'raven-coffin', beast: 'raven', object: 'coffin' },
  { id: 'hound-lantern', beast: 'hound', object: 'lantern' },
  { id: 'lion-spade', beast: 'lion', object: 'spade' },
  { id: 'dove-bell', beast: 'dove', object: 'bell' },
]

/** The Vane family crest, from the wax seal on John Pell's tag. */
export const CASE_2_VANE_CREST: VaneCrestId = 'raven-coffin'

/** Kerr's locker, a Vane & Sons tool locker at the west end of the lodge table. */
export const CASE_2_LOCKER_POSITION = [-25.6, 0, -37.3] as const

/** What the receipt in the locker says. PLACEHOLDER: the surgeon's name and the sum. */
export const CASE_2_RECEIPT =
  'Received of Vane & Sons, for three subjects delivered to Dr. Hollis, surgeon: £12. Paid to Kerr.'

// Walk clue positions stand beside their real stones (tombstones.ts).
const CASE_1: CaseDef = {
  id: 'saved-by-the-bell',
  stage: 1,
  title: 'Saved by the Bell',
  clues: [
    {
      id: 'ledger-wrong-cause',
      title: 'Altered entries',
      line: 'Pell, Ames and Hale: three ledger entries changed in fresh ink, each initialled J.V.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '1a' },
    },
    {
      id: 'ledger-date-mismatch',
      title: 'Dead a day early',
      line: "The ledger has John Pell dead on the 11th. His own stone says the 12th.",
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '1a' },
    },
    {
      id: 'pell-rope-cut',
      title: 'The cut cord',
      line: "Pell's bell cord is cut clean, by a knife. His is the only bell that cannot ring.",
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'two-bells-ring',
      title: 'Two bells ring',
      line: 'The bells of Esther Ames and Tobias Hale both ring. Only Pell was silenced.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'pell-tag-early',
      title: 'Signed J. Vane',
      line: "Pell's certificate was signed on the 11th by J. Vane, the undertaker: a day before he died.",
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '1b' },
    },
    {
      id: 'hale-fresh-flowers',
      title: 'Fresh flowers',
      line: 'A widow still visits the Hale grave. Fresh flowers lie on it.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-14.6, 0, -14.6] },
    },
    {
      id: 'marsh-stone-toppled',
      title: 'Toppled stone',
      line: 'The Marsh stone lies on its side. Frost heave, nothing more.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'grounds', position: [-10.4, 0, -17.4] },
    },
  ],
  // No board links in Case 1: the journal asks which bell was cut instead (playtest).
  notes: [],
  minigames: ['1a', '1b'],
  final: {
    template: 'Who silenced John Pell?',
    slots: [],
    answer: [],
    typed: {
      accept: ['Josiah Vane', 'J. Vane', 'J.V.', 'Vane', 'Josiah', 'Mr Vane', 'the undertaker', 'Josiah Vane, the undertaker'],
    },
  },
  hints: [
    { cost: 5, text: 'Read the stones of Pell, Ames and Hale, then check each one against its ledger entry.' },
    { cost: 10, text: 'Pull the three bell cords. Only one bell stayed silent, and its tag is signed.' },
    { cost: 20, text: "The tag on Pell's cut cord is signed J. Vane: Josiah Vane, the undertaker." },
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
      id: 'robbed-grave',
      title: 'The robbed grave',
      line: 'Arthur Finch, buried the 14th: loose soil, yellow clay on the grass, and an empty coffin.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '2a' },
    },
    {
      id: 'watch-log-gap',
      title: 'No countersign',
      line: 'On the night of the 14th, Kerr walked the midnight and 2 am rounds alone. Dale never signed.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '2b' },
    },
    {
      id: 'boot-print-match',
      title: "Kerr's boots",
      line: 'Kerr’s hobnailed boots match the print at the grave: the nails, the crack, the yellow clay.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '2c' },
    },
    {
      id: 'vane-sons-receipt',
      title: 'The Vane & Sons receipt',
      line: 'Vane & Sons paid Kerr £12 for three “subjects”, delivered to a surgeon.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '2d' },
    },
    {
      id: 'spade-fresh-clay',
      title: 'Spade with clay',
      line: "Fresh clay on the gravedigger's spade. He dug a lawful grave that day.",
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
  // No board links: the findings are written up in the journal, as in Case 1 (playtest).
  notes: [],
  minigames: ['2a', '2b', '2c', '2d'],
  final: {
    template: 'Who paid for the stolen bodies?',
    slots: [],
    answer: [],
    typed: {
      accept: ['Vane and Sons', 'Vane & Sons', 'Vane Sons', 'Vanes', 'the Vanes', 'Vane', 'Vane and Son', 'the Vane family'],
    },
  },
  hints: [
    { cost: 5, text: 'Inspect the three fresh graves by the lodge, then check each one against the burial register.' },
    { cost: 10, text: 'Read the watch log for the night of the 14th, then compare the boots with the print from the robbed grave.' },
    { cost: 20, text: 'Kerr’s locker opens to the Vane crest, the raven on a coffin. The receipt inside names who paid.' },
  ],
  closedPage: CLOSED_CASE_PAGES['resurrection-men'],
  curseSteps: DEFAULT_CURSE_STEPS,
}

// ---- Case 3 minigame data (spec 10 task 4.1) ----

/** The hymn board in the chapel (minigame 3a). The board numbers are also painted in the chapel model. */
export interface HymnBoardDef {
  /** The five numbers painted on the board, left to right. */
  numbers: readonly [number, number, number, number, number]
  /** The word the first letters of those hymns spell. */
  letters: 'BELOW'
  /** The psalter on the vestry shelf: hymn N is `index[N - 1]`. Always 60 titles. */
  index: readonly string[]
  /** Crane's line that points at the Word, shown with his confession (journal page 3). */
  confession: string
  /** Shown on a wrong tile setting (requirement 15.3). */
  wrongMessage: string
}

const HYMN_NUMBERS = [4, 19, 2, 41, 23] as const

/**
 * 60 hymn titles. The first letters of hymns 4, 19, 2, 41 and 23 spell BELOW; every other title
 * is free. Titles are invented in the period's style so no real hymn text is copied.
 */
const HYMN_INDEX: readonly string[] = [
  'All Creatures of the Field', // 1
  'Lord, Hear the Sleepers', // 2 L
  'Come, Ye Weary Travellers', // 3
  'Behold the Lamp Is Lit', // 4 B
  'Day Is Dying in the West', // 5
  'Father of Our Fathers', // 6
  'God Keep the Parish Fold', // 7
  'Hark, the Bell Across the Moor', // 8
  'In the Cold of Winter Dark', // 9
  'Jesus, Shepherd of the Lost', // 10
  'Kindly Light, Lead Thou Me On', // 11
  'Let the Lowly Voices Rise', // 12
  'My Soul Doth Wait Upon the Lord', // 13
  'Not by Might and Not by Power', // 14
  'Our Help in Ages Gone', // 15
  'Praise to the Keeper of the Gate', // 16
  'Rock of the Faithful Dead', // 17
  'Sing to the Morning Star', // 18
  'Early, Before the Cock Crows', // 19 E
  'The Church Is One Foundation', // 20
  'Unto the Hills Do I Lift Mine Eyes', // 21
  'Vesper Song for the Weary', // 22
  'Watchman, Tell Us of the Night', // 23 W
  'Ye Servants of the Light', // 24
  'Abide with the Dying', // 25
  'Come, Thou Fount of Mercy', // 26
  'Dear Lord, the Harvest Fails', // 27
  'Eternal Rest Grant Them', // 28
  'Faith of Our Mothers', // 29
  'Gentle Jesus, Mild and Meek', // 30
  'Holy, Holy, Holy', // 31
  'I Heard the Voice of Thunder', // 32
  'Judge Us Not in Anger', // 33
  'King of the Silent Hours', // 34
  'Lead On, O Patient Sexton', // 35
  'Mercy for the Parish Poor', // 36
  'Now the Labourer Is Home', // 37
  'On the Shore of the Last River', // 38
  'Peace in the Narrow House', // 39
  'Rest, Weary Pilgrim, Rest', // 40
  'Oh, Sleep Beneath the Yew', // 41 O
  'Saviour, Breathe an Evening Blessing', // 42
  'Thy Word Is a Lamp Unto My Feet', // 43
  'Under the Wings of Mercy', // 44
  'Visit Us, O Morning Light', // 45
  'When Shadows Gather Deep', // 46
  'Yet Shall the Faithful Rise', // 47
  'Zion, Fair City of God', // 48
  'Angels, Roll the Stone Away', // 49
  'Bless the Hands That Bury Us', // 50
  'Christ Is Risen from the Grave', // 51
  'Deep Is the Well of Sorrow', // 52
  'Each Little Flower That Opens', // 53
  'For All the Saints Who Sleep', // 54
  'Grant Us, Lord, a Quiet End', // 55
  'He Leadeth Me by Still Waters', // 56
  'It Is Well with My Soul', // 57
  'Just as I Am, Without One Plea', // 58
  'Keep Us Near the Cross', // 59
  'Lo, the Dawn Is Breaking', // 60
]

export const CASE_3_HYMN_BOARD: HymnBoardDef = {
  numbers: HYMN_NUMBERS,
  letters: 'BELOW',
  index: HYMN_INDEX,
  confession: 'What I hid, I hid beneath the Word.',
  wrongMessage: 'The tiles do not sit true',
}

// ---- Case 3: the ruts, the Crane crypt, Elias and the handwriting (playtest story pass) ----

/**
 * The hearse cart's ruts: two grooves from just inside the Row gate (z -40) down the avenue to the
 * Crane crypt's step. The walk clue that names them lies where they start.
 */
export const CASE_3_RUTS = {
  start: [-20, 0, -41.2] as const,
  /** The two wheel lines (x), the cart's track about 0.9 m. */
  wheels: [-20.45, -19.55] as const,
  fromZ: -38.4,
  toZ: -59.4,
} as const

/** The Crane crypt door: the hearse pin in its outer hasps, Elias behind it once the pin is out. */
export const CASE_3_CRYPT_PROPS = {
  pin: [-19.3, 1.0, -59.95] as const,
  body: [-20.0, 0.02, -59.0] as const,
  /** The crypt door is 1.77 m wide, centred on the avenue. */
  doorX: -20,
  doorFaceZ: -60,
} as const

/** The other crypt on the Row, where the oil is spilled. Its family name is on its lintel. */
export const CASE_3_OIL_CRYPT = 'Lowe'

/** The note that called Elias to the Crane crypt, found in his coat with his letter. */
export const CASE_3_NOTE =
  'Mr. Thorne. Meet me at the Crane crypt at midnight, and come alone. You will see what the Vanes have done.'

/** Elias's unsent letter, in his coat. */
export const CASE_3_LETTER =
  'My lord Bishop. The Vanes are burying the living and selling the dead. A man has asked to meet me at the ' +
  'Crane crypt tonight; he says he has proof. If I do not come back, look to the Vanes.'

export type HandSampleId = 'ledger' | 'receipt' | 'note' | 'signature'

/**
 * One handwriting sample in the journal (minigame 3d). In `text`, `{V}` is a looped capital V and
 * `{s}` a long, sloping s; `{v}` is a plain V. They are what is circled when the sample is clicked.
 */
export interface HandSampleDef {
  id: HandSampleId
  title: string
  text: string
  /** The careful hand (looped V, long s), or Josiah's plain, shaky one. */
  careful: boolean
  /** What the circle says. */
  feature: string
}

export const CASE_3_HAND_SAMPLES: readonly HandSampleDef[] = [
  {
    id: 'ledger',
    title: 'The changed ledger entry (John Pell)',
    text: 'Pell, John. Died the 11th of March 1862. Entry {s}igned J.{V}.',
    careful: true,
    feature: 'A looped V and a long, sloping s.',
  },
  {
    id: 'receipt',
    title: 'The receipt from Kerr’s locker',
    text: 'Received of {V}ane & Son{s}, for three {s}ubjects delivered to Dr. Hollis, surgeon: £12. Paid to Kerr.',
    careful: true,
    feature: 'A looped V and a long, sloping s.',
  },
  {
    id: 'note',
    title: 'The note in Elias’s coat',
    text: 'Mr. Thorne. Meet me at the Crane crypt at midnight, and come alone. You will {s}ee what the {V}ane{s} have done.',
    careful: true,
    feature: 'A looped V and a long, sloping s.',
  },
  {
    id: 'signature',
    title: 'Josiah Vane’s signature (John Pell’s tag)',
    text: 'J. {v}ane, Undertaker.',
    careful: false,
    feature: 'Plain and shaky. No loop on the V.',
  },
]

/** The rite's relic names in rite order, taken from the relic data so the two cannot drift apart. */
const RELIC_NAMES = RITE_ORDER.map((id) => RELIC_MAP[id].name)

const CASE_3: CaseDef = {
  id: 'sealed-catacombs',
  stage: 3,
  title: 'The Sealed Catacombs',
  clues: [
    {
      id: 'hymn-letters-below',
      title: 'Hymn letters',
      line: 'The first letters of the hymns spell BELOW. The stair behind the altar is open.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '3a' },
    },
    {
      id: 'hearse-cart-ruts',
      title: 'Cart ruts',
      line: 'Hearse-cart ruts run from the Row gate to the Crane crypt, and back out.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'walk', spot: 'mausoleum-row', position: CASE_3_RUTS.start },
    },
    {
      id: 'hearse-pin-hasp',
      title: 'The hearse pin',
      line: 'An iron hearse pin, stamped with the Vane raven, pinned the Crane crypt shut from outside.',
      icon: 'examine',
      redHerring: false,
      found: { kind: 'minigame', id: '3b' },
    },
    {
      id: 'elias-unsent-letter',
      title: "Elias's letter and the note",
      line: 'His unsent letter, and the note that called him to the Crane crypt at midnight.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '3c' },
    },
    {
      id: 'silas-handwriting',
      title: 'The same hand',
      line: 'The ledger, the receipt and the note share one hand. Not Josiah’s: his son Silas’s.',
      icon: 'read',
      redHerring: false,
      found: { kind: 'minigame', id: '3d' },
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
      id: 'oil-other-crypt',
      title: 'Oil at the Lowe crypt',
      line: 'Spilled lantern oil at the Lowe crypt, but no cart ruts lead there.',
      icon: 'examine',
      redHerring: true,
      // On the avenue at the railing gate of the crypt at z -49.9 (the old spot was inside it).
      found: { kind: 'walk', spot: 'mausoleum-row', position: [-21.35, 0.01, -49.9] },
    },
    {
      id: 'old-bishops-seal',
      title: "The old bishop's seal",
      line: 'A wax seal on a parish paper. The bishop who pressed it died years before Elias came.',
      icon: 'read',
      redHerring: true,
      // On the vestry cupboard top (0.89), beside the psalter and the weapon that lies there.
      found: { kind: 'walk', spot: 'chapel', position: [7.9, 0.895, 7.25] },
    },
  ],
  // The playtest story pass writes Case 3 up as findings, like Cases 1 and 2: no board links.
  notes: [],
  minigames: ['3a', '3b', '3c', '3d'],
  // The rite is the winning answer; the relic slots are filled in order on the altar.
  final: {
    template: 'The rite: {0}, {1}, {2}, {3}, {4}.',
    slots: RITE_ORDER.map((_, i) => ({ label: `Relic ${i + 1}`, options: RELIC_NAMES })),
    answer: RELIC_NAMES,
  },
  // Named at the altar on the last night, before the rite can be laid.
  accusation: {
    template: 'Who sealed Elias Thorne in the Crane crypt?',
    slots: [],
    answer: [],
    optional: true,
    typed: {
      accept: ['Silas Vane', 'Silas', 'S Vane', 'S. Vane', 'SV', 'S.V.', 'the son', 'Vane’s son', 'Vanes son', 'Silas Vane the son'],
      ask: { forms: ['Vane', 'the Vanes', 'Mr Vane', 'Vanes', 'Vane and Sons', 'Vane & Sons'], reply: 'Which Vane?' },
    },
  },
  hints: [
    { cost: 5, text: 'The hymn board in the chapel spells a word. Then follow the cart ruts from the Row gate.' },
    { cost: 10, text: 'Pull the pin from the Crane crypt door, search Elias, then compare the handwriting in your journal.' },
    { cost: 20, text: 'The careful hand is not Josiah’s. His son, Silas Vane, sealed Elias in.' },
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

// ---------------------------------------------------------------------------
// Name the Dead (spec 10 task 11, Req 28)
// ---------------------------------------------------------------------------

/** A name a glowing grave can show at night, and the evidence that names it. */
export interface DeadNameDef {
  name: string
  /** The first stage whose nights may show it. */
  stage: StageNumber
  /** Finding any of these clues makes the name known. Empty: a stranger no evidence names. */
  clues: readonly ClueId[]
}

/**
 * The names come from the cases' evidence (the stones and the bells of Case 1, the watch log of
 * Case 2, Elias's letter in Case 3). The strangers are in no evidence, so they can never be named.
 */
export const DEAD_NAMES: readonly DeadNameDef[] = [
  { name: 'Esther Ames', stage: 2, clues: ['two-bells-ring', 'watch-log-gap'] },
  { name: 'John Pell', stage: 2, clues: ['pell-rope-cut', 'pell-tag-early'] },
  { name: 'Tobias Hale', stage: 2, clues: ['hale-fresh-flowers'] },
  { name: 'Marsh', stage: 2, clues: ['marsh-stone-toppled'] },
  { name: 'Hester Lowe', stage: 2, clues: [] },
  { name: 'Elias Thorne', stage: 3, clues: ['elias-unsent-letter', 'hearse-cart-ruts'] },
  { name: 'Ezra Crane', stage: 3, clues: [] },
]
