// Case data (spec 10 task 2.1, design bible §13, docs/case-design.md §3). Three cases, one per
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

// ---- Case 1 minigame data (spec 10 task 3.1) ----

export type LedgerFlagKind = 'date' | 'plot' | 'certificate'

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
}

/** A readable stone (minigame 1a, right page: the rubbing). */
export interface StoneRubbingDef {
  id: string
  name: string
  date: string
  plot: string
  /** The ledger line this stone belongs to. */
  ledgerId: string
  /** Where the stone stands. The four old stones reuse `tombstones.ts`; the two new ones are guesses. */
  position: readonly [number, number, number]
  /** The one mismatch a careful reader finds, when there is one. */
  mismatch?: LedgerFlagKind
}

export type BellPostId = 'bell-pell' | 'bell-hale' | 'bell-ames'

export type BellCondition = 'rope-cut' | 'rusted-solid' | 'intact'

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
export const LEDGER_WRONG_FLAG_MESSAGE = 'These two agree'

/** Shown when the wrong post is named as the cut bell (requirement 13.4). */
export const BELL_WRONG_POST_MESSAGE = 'That rope is sound. Look again at the others.'

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
  },
  {
    id: 'l-ames',
    name: 'Esther Ames',
    date: '1849-11-07',
    plot: 'Grounds, east row 1',
    cause: 'Fever',
    doctor: 'Dr. Pryor',
    certificate: false,
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
    date: '1862-03-13',
    plot: 'Grounds, north row 3',
    cause: 'Apoplexy',
    doctor: 'Dr. Lisle',
    certificate: true,
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
    ledgerId: 'l-hale',
    position: [-14.6, 0, -15.8],
    mismatch: 'plot',
  },
  {
    id: 'ames',
    name: 'Esther Ames',
    date: '1849-11-07',
    plot: 'Grounds, east row 1',
    ledgerId: 'l-ames',
    position: [16.4, 0, -22.6],
    mismatch: 'certificate',
  },
  {
    id: 'pell',
    name: 'John Pell',
    date: '1862-03-12',
    plot: 'Grounds, north row 3',
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
  { stoneId: 'ames', kind: 'certificate' },
  { stoneId: 'hale', kind: 'plot' },
]

// Posts stand 1.2 m beside their stones (x offset). Hale's is on the west side to clear the journal page 2 spawn. Checked by caseLayout.test.ts.
export const CASE_1_BELLS: readonly BellPostDef[] = [
  {
    id: 'bell-pell',
    stone: 'pell',
    position: [-7.2, 0, -22.4],
    rope: 'The rope ends in a clean slant, cut by a blade, and the cord above is still sound.',
    bell: 'The bell turns freely and is bright where the hand has worn it.',
    tag: 'Certificate signed 12 March 1862, the day before the ledger says he died.',
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
    tag: 'Certificate signed 5 November 1849, the day of death.',
    condition: 'intact',
  },
  {
    id: 'bell-ames',
    stone: 'ames',
    position: [17.6, 0, -22.6],
    rope: 'The rope is whole but stiff.',
    bell: 'The bell is rusted solid. The clapper will not move.',
    tag: 'No certificate is tied here.',
    condition: 'rusted-solid',
    clueId: 'ames-bell-rusted',
  },
]

/** Pell's grave gives up the Rusted Crypt Key once case 1 is solved (design bible §2). */
export const CASE_1_REWARD = {
  item: 'rusted-crypt-key',
  stone: 'pell',
  position: [-8.4, 0, -21.6],
} as const satisfies { item: ItemId; stone: string; position: readonly [number, number, number] }

// Walk clue positions stand beside their real stones (tombstones.ts).
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
      a: 'ledger-no-certificates',
      b: 'ames-bell-rusted',
      text: 'No certificate and a bell that cannot ring: a careless burial, not a plotted one.',
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
      {
        label: 'Grave',
        options: ["Pell's grave", "Hale's grave", "Ames's grave", "Marsh's grave"],
      },
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
    {
      cost: 5,
      text: 'Look at the cards from the ledger and the bells. The flowers and the stone do not matter.',
    },
    { cost: 10, text: 'Find the grave where the rope was cut and the date is wrong by a day.' },
    {
      cost: 20,
      text: "Pell's grave: the rope was cut, and the certificate was signed before the death.",
    },
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
      {
        label: 'Who',
        options: ['the sexton', 'the doctor', 'the lodge keeper', 'the gravedigger'],
      },
      {
        label: 'Motive',
        options: [
          "the surgeon's receipt in his hand",
          'the anatomy school letter',
          'the fresh clay on the spade',
          "the sexton's watch ledger",
        ],
      },
      {
        label: 'Means',
        options: ['the matching boots', 'the cut rope', 'the iron hearse-pin', 'a licence'],
      },
      {
        label: 'Opportunity',
        options: [
          'the gap on his watch',
          'the legal grave he dug',
          'the flowers on Hale',
          'the cold hearth',
        ],
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
    {
      cost: 5,
      text: 'The receipt, the boots and the gap matter. The spade and the school letter do not.',
    },
    {
      cost: 10,
      text: 'Look for who was paid, whose boots were there and whose watch was empty. It is one man.',
    },
    {
      cost: 20,
      text: 'The lodge keeper: the receipt, the matching boots and the gap on his watch.',
    },
  ],
  closedPage: CLOSED_CASE_PAGES['resurrection-men'],
  curseSteps: DEFAULT_CURSE_STEPS,
}

// ---- Case 3 minigame data (spec 10 task 4.1) ----

export type EvidenceCardId =
  'dry-boots' | 'unsent-letter' | 'cart-ruts' | 'spilled-oil' | 'nail-marks' | 'hearse-pin'

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

/** One evidence card of minigame 3b. */
export interface EvidenceCardDef {
  id: EvidenceCardId
  title: string
  /** What the player reads on the card. */
  text: string
  zone: ZoneId
  /** Where it lies, in words; the props are placed in task 4.4. */
  place: string
  /** The time of night this card belongs to, on the midnight-to-dawn timeline. */
  time: string
  /** Caption shown when the right order replays the night (one beat per card). */
  beat: string
  /** The clue this card gives when it is also a clue on the board. */
  clueId?: Case3ClueId
}

/** Texts of the three papers that tie the Vanes to the ledger (requirement 18.1). */
export interface VanePapersDef {
  letter: string
  flyleaf: string
  receipt: string
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

/** The six cards in the right order, midnight to dawn. The pin goes in before the nails scratch. */
export const CASE_3_TIMELINE_ORDER: readonly EvidenceCardId[] = [
  'dry-boots',
  'unsent-letter',
  'cart-ruts',
  'spilled-oil',
  'hearse-pin',
  'nail-marks',
]

export const CASE_3_EVIDENCE: readonly EvidenceCardDef[] = [
  {
    id: 'dry-boots',
    title: "Elias's dry boots",
    text: 'His boots stand by the hut hearth, dry. He had not yet been out in the wet grass.',
    zone: 'grounds',
    place: "the keeper's hut",
    time: 'Midnight',
    beat: '[midnight: Elias sits in the hut, his boots dry]',
  },
  {
    id: 'unsent-letter',
    title: 'The unsent letter',
    text: 'A letter to the Bishop, folded and hidden in the hut bench. It speaks of "the undertaker\'s family".',
    zone: 'grounds',
    place: 'the hut bench',
    time: 'Past midnight',
    beat: '[he writes to the Bishop, and hides the letter]',
    clueId: 'elias-unsent-letter',
  },
  {
    id: 'cart-ruts',
    title: 'Hearse-cart ruts',
    text: 'Deep wheel ruts in the soft ground at the Row gate, where no cart should come at night.',
    zone: 'mausoleum-row',
    place: 'the Row gate',
    time: 'One in the morning',
    beat: '[a hearse cart creaks to the Row gate]',
    clueId: 'hearse-cart-ruts',
  },
  {
    id: 'spilled-oil',
    title: 'Spilled lantern oil',
    text: 'Lamp oil dark on the Crane crypt step. A lantern was dropped in a struggle.',
    zone: 'mausoleum-row',
    place: 'the Crane crypt step',
    time: 'Two in the morning',
    beat: '[a lantern falls on the crypt step]',
  },
  {
    id: 'hearse-pin',
    title: 'The iron hearse-pin',
    text: "An iron hearse-pin pushed through the crypt door's outer hasp. It came off a hearse cart.",
    zone: 'mausoleum-row',
    place: 'the crypt door hasp',
    time: 'Three in the morning',
    beat: '[an iron pin is driven into the hasp]',
    clueId: 'hearse-pin-hasp',
  },
  {
    id: 'nail-marks',
    title: 'Fingernail marks',
    text: 'Long scratches low on the inside of the crypt door. Someone inside tried to open it, and could not.',
    zone: 'mausoleum-row',
    place: 'inside the crypt door',
    time: 'Before dawn',
    beat: '[scratching, then silence, until the dawn]',
  },
]

/**
 * Where the evidence cards lie in the world (spec 10 task 4.4, Req 16.1). The dry boots are the
 * existing hut clue spot, so the card counts as found once that clue is in the journal. The rest
 * are props mounted by CaseProps. The Mausoleum Row avenue is 3.5 m wide (x -21.75 to -18.25) and
 * ends at the Crane crypt's front face at z -60.
 */
export const CASE_3_BOOTS_CLUE = 'clue-hut-boots'

export const CASE_3_EVIDENCE_SPOTS: Readonly<
  Record<Exclude<EvidenceCardId, 'dry-boots'>, { position: readonly [number, number, number]; label: string }>
> = {
  // Hut west table (top 0.78), beside the powder tin at x -1.8.
  'unsent-letter': { position: [-2.35, 0.79, -1.15], label: 'Folded letter' },
  // Two wheel ruts just inside the Row gate (z -40).
  'cart-ruts': { position: [-20.6, 0, -38.6], label: 'Cart ruts' },
  // The east edge of the avenue end, in front of the crypt step.
  'spilled-oil': { position: [-18.6, 0.01, -57.2], label: 'Spilled oil' },
  // On the crypt door's face, about hasp height.
  'hearse-pin': { position: [-19.3, 1.0, -59.95], label: 'Iron pin in the hasp' },
  // Low on the same door face.
  'nail-marks': { position: [-20.7, 0.5, -59.95], label: 'Scratches on the door' },
}

/** The slate that opens minigame 3b, and where Elias lies once the pin is pulled. */
export const CASE_3_CRYPT_PROPS = {
  slate: [-21.3, 0, -58.6] as const,
  body: [-20.0, 0.02, -59.0] as const,
  /** The crypt door is 1.77 m wide, centred on the avenue. */
  doorX: -20,
  doorFaceZ: -60,
} as const

/**
 * The order cards first lie on the slate, before the player moves any. It is not the right order
 * (a property test checks), so a card found in walking order still has to be thought about.
 */
export const CASE_3_CARD_SHELF: readonly EvidenceCardId[] = [
  'hearse-pin',
  'dry-boots',
  'nail-marks',
  'cart-ruts',
  'unsent-letter',
  'spilled-oil',
]

/** What the vane papers say. The hand is the same careful hand in all three. */
export const CASE_3_VANE_PAPERS: VanePapersDef = {
  letter:
    'My lord Bishop. The ledger of 1849 is false. Thirty-one were buried that week who were not yet dead, ' +
    "and the one who was paid for it was the undertaker's family. I am going to the Crane crypt to find proof. " +
    'If I do not return, look to them.',
  flyleaf:
    'Josiah Vane, parish undertaker. Paid in full for thirty-one funerals, 1849. ' +
    'Written in the careful hand that also keeps the parish ledger.',
  receipt:
    'Vane & Sons, undertakers. Received of the keeper, one purchase, with thanks. ' +
    'Written in the careful hand that also keeps the parish ledger.',
}

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
      line: "An iron hearse-pin still in the crypt door's outer hasp.",
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
      id: 'oil-other-crypt',
      title: 'Oil at another crypt',
      line: 'Lamp oil is spilled on the step of a different crypt. The sexton filled his lamps here.',
      icon: 'examine',
      redHerring: true,
      found: { kind: 'walk', spot: 'mausoleum-row', position: [-24, 0, -50] },
    },
    {
      id: 'old-bishops-seal',
      title: "The old bishop's seal",
      line: 'A wax seal on a parish paper. The bishop who pressed it died years before Elias came.',
      icon: 'read',
      redHerring: true,
      found: { kind: 'walk', spot: 'chapel', position: [8, 0, 9] },
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
      {
        label: 'Motive',
        options: [
          'the handwriting',
          "the old bishop's seal",
          'the oil at the other crypt',
          'a licence',
        ],
      },
      {
        label: 'Means',
        options: ['the hearse-pin', 'the cut rope', 'the matching boots', 'a spade'],
      },
      {
        label: 'Opportunity',
        options: ['the cart ruts', 'the gap on his watch', 'the flowers', 'the hymn board'],
      },
    ],
    answer: ['Silas Vane', 'the handwriting', 'the hearse-pin', 'the cart ruts'],
    optional: true,
  },
  hints: [
    {
      cost: 5,
      text: "The hymn letters, the letter, the ruts, the pin and the Vane hands matter. The seal and the other crypt's oil do not.",
    },
    {
      cost: 10,
      text: 'Follow the handwriting: ledger, flyleaf and receipt. Then the cart and the pin show how.',
    },
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
