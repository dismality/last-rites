// Objective tracker rules (design bible §11). Order is priority: the selector returns
// the first rule whose condition matches, and rule 11 is the fallback.

import {
  CASE_1_BELLS,
  CASE_1_RIGHT_FLAGS,
  CASE_1_STONES,
  CASE_2_BOOTS_POSITION,
  CASE_2_FRESH_GRAVES,
  CASE_2_LOCKER_POSITION,
  CASE_2_LOGBOOK_POSITION,
  CASE_2_PRINT_POSITION,
  CASE_2_REGISTER_POSITION,
  CASE_3_CRYPT_PROPS,
  CASE_3_RUTS,
  type MinigameId,
} from './cases'
import { MAUSOLEUM_ROW, POWDER_TIN_HUT } from './cemeteryLayout'
import { HYMN_BOARD_POSITION } from './chapelScenery'

export type ObjectiveRuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * Rule 12 (spec 09, F1) shows when it is day, the player owns no weapon but the shovel and dusk
 * is closer than this. It sits above the story rules, whose line moves to the second line.
 */
export const PREPARE_WEAPON_BEFORE_DUSK_S = 120

/** Id of the "Craft a weapon" rule, named so the selector holds no bare rule number. */
export const PREPARE_WEAPON_RULE = 12 satisfies ObjectiveRuleId

/** Where an objective points, resolved by the selector against world data. */
export type PlaceRef =
  /** A `FIXED_SPAWNS` id in `zones.ts`. */
  | { kind: 'fixed-spawn'; id: string }
  /** The chapel altar. */
  | { kind: 'altar' }
  /** Nearest uncollected relic site in an already explored map cell (never reveals unexplored sites). */
  | { kind: 'nearest-relic' }
  /** The workbench in the keeper's hut. */
  | { kind: 'workbench' }

export interface ObjectiveRuleDef {
  readonly id: ObjectiveRuleId
  /** Main line. `{n}`, `{m}` are filled by the selector; any `target` appends " (count/target)". */
  readonly main: string
  /** Progress denominator shown as " (0/1)" or " (R/5)". */
  readonly target?: number
  /** Second line template. `{k}` zombies left, `{clock}` m:ss. Day rules use the day countdown. */
  readonly second?: string
  /** Short map label for the objective marker. */
  readonly marker?: string
  readonly place?: PlaceRef
  /** Why this matters, shown under the objective (at most OBJECTIVE_WHY_MAX characters). */
  readonly why?: string
}

/** Day countdown line shared by every day rule (§11: "Dusk in 3:12"). */
export const DAY_SECOND_LINE = 'Dusk in {clock}'

export const OBJECTIVE_RULES: readonly ObjectiveRuleDef[] = [
  { id: 1, main: 'Survive: Wave {n} of {m}', second: 'Zombies left: {k}' },
  {
    id: 2,
    main: 'Finish the rite at the altar',
    target: 5,
    marker: 'Altar',
    place: { kind: 'altar' },
  },
  // Selector priority is 3, 2, 1 (rite before waves); ids keep the design-bible numbers.
  { id: 3, main: 'Put Father Crane to rest', marker: 'Father Crane', place: { kind: 'altar' } },
  { id: 4, main: 'Prepare for the night', second: 'Night falls in {clock}' },
  {
    id: 5,
    main: 'Read the page Elias left in the hut',
    why: 'Elias Thorne vanished. His notes are the only lead.',
    target: 1,
    second: DAY_SECOND_LINE,
    marker: 'Page',
    place: { kind: 'fixed-spawn', id: 'fx-page-1' },
  },
  {
    id: 6,
    main: 'Find the Rusted Crypt Key',
    target: 1,
    second: DAY_SECOND_LINE,
    marker: 'Crypt key',
    place: { kind: 'fixed-spawn', id: 'fx-crypt-key' },
  },
  {
    id: 7,
    main: "Search Mausoleum Row for the sexton's whistle",
    target: 1,
    second: DAY_SECOND_LINE,
    marker: 'Whistle',
    place: { kind: 'fixed-spawn', id: 'fx-bone-whistle' },
  },
  {
    id: 8,
    main: 'Blow the Bone Whistle at the chapel altar',
    second: DAY_SECOND_LINE,
    marker: 'Altar',
    place: { kind: 'altar' },
  },
  {
    id: 9,
    main: 'Find the Iron Ossuary Key in the Crane crypt',
    target: 1,
    second: DAY_SECOND_LINE,
    marker: 'Ossuary key',
    place: { kind: 'fixed-spawn', id: 'fx-ossuary-key' },
  },
  {
    id: 10,
    main: 'Gather the relics of the rite',
    target: 5,
    second: DAY_SECOND_LINE,
    marker: 'Relic',
    place: { kind: 'nearest-relic' },
  },
  { id: 11, main: 'Hold out until the fifth night', second: DAY_SECOND_LINE },
  // Selector priority: after the dusk and wave rules, before rule 5. Its second line is the
  // story objective it stands above.
  {
    id: PREPARE_WEAPON_RULE,
    main: 'Craft a weapon at the workbench',
    why: 'The dead rise at dusk, and the rusty shovel will not hold them.',
    target: 1,
    marker: 'Workbench',
    place: { kind: 'workbench' },
  },
]

// --- Stage text (spec 10, design bible §11 "Objective tracker in the 3-stage design") ---
// Additive: the selector adopts these in task 1.5; the five-night rules above stay until then.

/** Rule 1 in a Story stage: the night has no wave count. The second line is the Curse meter. */
export const CURSE_RULE = {
  id: 1,
  main: 'The curse holds. Solve the case at the altar.',
  second: 'Curse {value} / {max}',
  marker: 'Altar',
  place: { kind: 'altar' },
} as const satisfies ObjectiveRuleDef

/** Second line while the 30 s altar lock runs; `{clock}` is m:ss. */
export const ALTAR_LOCKED_LINE = 'The altar is silent: {clock}'

/** Rule 11 once every minigame of the case is solved: `{title}` and clue counts fill in. */
export const CASE_SOLVE_LINE = 'Solve the case: {title}, clues {n}/{m}'

/**
 * By day once the stage's steps are done, what to do next: link the clues on the case board, then
 * answer at the altar after dusk. `{n}` and `{m}` are the correct links made and needed.
 */
export const CASE_LINK_LINE = 'Link clues on the case board in your journal ({n}/{m})'
export const CASE_LINK_WHY = 'Join the clues that belong together. Each right pair weakens the curse.'
export const CASE_ALTAR_LINE = 'At dusk, give your answer at the chapel altar'
export const CASE_ALTAR_WHY = 'The case is ready. The altar listens at night. Ring its bell to call the dusk early.'
/** Altar prompt by day once the case is ready: ring for dusk now instead of waiting out the clock. */
export const EARLY_DUSK_VERB = 'Ring the bell, call the dusk now'
/** Score for calling the dusk early: daylight left unspent. */
export const EARLY_DUSK_SCORE = 150
/** Shown when the bell is rung for an early dusk. */
export const EARLY_DUSK_LINE = 'The bell carries over the graves. The light is going.'
export const CASE_ALTAR_MARKER = 'Altar'
/** A case answered by typing a name at the altar (Case 1): nothing to fill in first. */
export const CASE_NAME_ALTAR_LINE = 'At dusk, name who did it at the chapel altar'
export const CASE_NAME_ALTAR_WHY = 'The altar listens at night: type the name there. Ring its bell to call the dusk early.'

/** The story's one goal, shown above every objective in a story run (playtest story pass). */
export const STORY_GOAL_LINE = 'Find Elias Thorne (trail {n} of 3)'
/** The goal line once the Crane crypt is open and Elias is found (Stage 3, 3b). */
export const STORY_GOAL_FOUND_LINE = 'Elias Thorne: found'
/** Stage 3's journal step: the handwriting comparison on the Case tab. */
export const CASE_3_HAND_LINE = 'In your journal: compare the handwriting'

/**
 * Objectives that need the journal to piece things together show its key under them (11s). Any
 * objective whose line or why line names one of these words gets it automatically, so a new
 * objective only has to say "journal" or "Case tab" to get the key. The altar answer is filled in
 * the journal's Case tab without saying so, so it is listed by line.
 */
export const JOURNAL_OBJECTIVE_WORDS: readonly string[] = ['journal', 'case tab', 'case board']
export const JOURNAL_KEY_WORD = 'Open the journal'
export const JOURNAL_KEY_LINES: Readonly<Record<string, string>> = {
  [CASE_ALTAR_LINE]: 'Fill in the question in the journal first',
}

type Point = readonly [number, number, number]

/**
 * Where a stage day step points: one place, a search area (a circle drawn on the maps, centred near
 * but not on the thing), the nearest of several, or the nearest known relic.
 */
export type StageDayPlace =
  | { readonly kind: 'point'; readonly at: Point }
  | { readonly kind: 'area'; readonly at: Point; readonly radiusM: number }
  | { readonly kind: 'nearest'; readonly at: readonly Point[] }
  | { readonly kind: 'nearest-relic' }

/** Day rules 5-10 per stage: the first unsolved line wins. `target` is the progress denominator. */
export interface StageDayRule {
  readonly main: string
  readonly target: number
  /** Main line once the count reaches the target but the step still needs finishing. */
  readonly whenCounted?: string
  readonly marker: string
  readonly place: StageDayPlace
  /** The case minigame this step solves, when it is one (the keeper's hunch looks there). */
  readonly minigame?: MinigameId
  /** Why this step matters, shown under the objective: what it is for and where it leads. */
  readonly why: string
  /** Shown once as a reveal when the step is finished: what was learned and where it points. */
  readonly done: string
}

/** The Mausoleum Row gate across the avenue mouth on the north fence (Gates.tsx). */
export const ROW_GATE_POSITION: Point = [MAUSOLEUM_ROW.centerX, 0, MAUSOLEUM_ROW.entranceZ]

/** The three graves Elias named in Case 1: the stones that carry a ledger mismatch. */
const CASE_1_GRAVES = CASE_1_RIGHT_FLAGS.map((f) => CASE_1_STONES.find((s) => s.id === f.stoneId)!)

/** The parish register page beside the powder tin on the hut shelf (Hut.tsx). */
const LEDGER_PAGE: Point = [POWDER_TIN_HUT[0] + 0.35, POWDER_TIN_HUT[1], POWDER_TIN_HUT[2]]

export const STAGE_DAY_RULES: Readonly<Record<1 | 2 | 3, readonly StageDayRule[]>> = {
  1: [
    {
      main: 'Read the stones of Pell, Ames and Hale',
      target: CASE_1_GRAVES.length,
      marker: 'Stone',
      place: { kind: 'nearest', at: CASE_1_GRAVES.map((g) => g.position) },
      why: 'Elias wrote that the ledger was changed. The stones were carved at the burials: read them.',
      done: 'All three stones read. Now check them against the parish ledger on the hut shelf.',
    },
    {
      minigame: '1a',
      main: 'Check the ledger against the stones',
      target: CASE_1_GRAVES.length,
      marker: 'Ledger',
      place: { kind: 'point', at: LEDGER_PAGE },
      why: 'For each grave, mark whether the ledger agrees with its stone, and if not, what differs.',
      done: 'Three entries were changed, each initialled J.V.: Pell, Ames and Hale. Each grave has a safety bell.',
    },
    {
      minigame: '1b',
      main: 'Pull the bell cords at the three graves',
      target: 3,
      // All three pulled is not the end: the step closes when the journal question is answered.
      whenCounted: 'In your journal: which bell was cut?',
      why: 'If the buried woke, a cord from the coffin rang a bell above. See whether these three still ring.',
      done: 'John Pell’s cord was cut, and the tag is signed J. Vane, the undertaker. Name him at the altar tonight.',
      marker: 'Bell',
      place: { kind: 'nearest', at: CASE_1_BELLS.map((b) => b.position) },
    },
  ],
  2: [
    {
      main: 'Open the Mausoleum Row gate',
      target: 1,
      marker: 'Row gate',
      place: { kind: 'point', at: ROW_GATE_POSITION },
      why: 'The crypt key fits the Mausoleum Row gate on the north fence, by the lodge.',
      done: 'The Row is open. Elias wrote to watch the fresh graves: there are three by the lodge.',
    },
    {
      main: 'Look at the three fresh graves by the lodge',
      target: CASE_2_FRESH_GRAVES.length,
      marker: 'Fresh grave',
      place: { kind: 'nearest', at: CASE_2_FRESH_GRAVES.map((g) => g.position) },
      why: 'Elias thought bodies were being taken from new graves. See what each one shows.',
      done: 'All three seen. Now check them against the burial register on the lodge table.',
    },
    {
      minigame: '2a',
      main: 'Check the fresh graves against the register',
      target: CASE_2_FRESH_GRAVES.length,
      marker: 'Register',
      place: { kind: 'point', at: CASE_2_REGISTER_POSITION },
      why: 'For each grave, mark whether it agrees with the burial register.',
      done: 'Arthur Finch’s grave, buried the 14th, was dug up and emptied.',
    },
    {
      minigame: '2b',
      main: 'Read the watch log for the night of the 14th',
      target: 1,
      marker: 'Watch log',
      place: { kind: 'point', at: CASE_2_LOGBOOK_POSITION },
      why: 'The lodge keeper, Kerr, logs every round, and the porter, Dale, countersigns it.',
      done: 'Kerr walked the midnight and 2 am rounds alone. Dale never signed.',
    },
    {
      main: 'Take the boot print at Arthur Finch’s grave',
      target: 1,
      marker: 'Print',
      place: { kind: 'point', at: CASE_2_PRINT_POSITION },
      why: 'Whoever dug up the grave left a print in the mud at its foot.',
      done: 'The print is in your journal. Compare it with the boots by the lodge table.',
    },
    {
      minigame: '2c',
      main: 'Compare the boots by the lodge with the print',
      target: 1,
      marker: 'Boots',
      place: { kind: 'point', at: CASE_2_BOOTS_POSITION },
      why: 'Hold each pair of boots against the print from the robbed grave.',
      done: 'Kerr’s boots match the print. A locker key fell out of one.',
    },
    {
      minigame: '2d',
      main: 'Open Kerr’s locker',
      target: 1,
      marker: 'Locker',
      place: { kind: 'point', at: CASE_2_LOCKER_POSITION },
      why: 'A Vane & Sons crest lock: the key turns only with the right family crest.',
      done: 'A receipt: Vane & Sons paid Kerr for bodies. Name who paid at the altar tonight.',
    },
  ],
  3: [
    {
      minigame: '3a',
      main: 'Read the hymn board in the chapel',
      target: 1,
      marker: 'Hymn board',
      place: { kind: 'point', at: HYMN_BOARD_POSITION },
      why: 'Elias went below the chapel. The hymn board has been changed: the vestry psalter explains it.',
      done: 'The hymns spell BELOW. The stair behind the altar is open. Now follow the cart ruts.',
    },
    {
      main: 'Follow the cart ruts from the Row gate',
      target: 1,
      marker: 'Ruts',
      place: { kind: 'point', at: CASE_3_RUTS.start },
      why: 'Elias’s page named the Crane crypt. A heavy cart came down the Row. See where it went.',
      done: 'A hearse cart came down the Row. Its ruts run to the Crane crypt at the far end.',
    },
    {
      minigame: '3b',
      main: 'Open the Crane crypt door',
      target: 1,
      marker: 'Crane crypt',
      place: { kind: 'point', at: CASE_3_CRYPT_PROPS.pin },
      why: 'The ruts stop at the Crane crypt. Something holds its door shut from outside.',
      done: 'The door was pinned from outside with a Vane hearse pin. Elias is inside.',
    },
    {
      minigame: '3c',
      main: 'Search Elias',
      target: 1,
      marker: 'Elias',
      place: { kind: 'point', at: CASE_3_CRYPT_PROPS.body },
      why: 'Elias came to the crypt to meet someone. See what he carried.',
      done: 'His unsent letter, and the note that called him here. Compare the hands in your journal.',
    },
    {
      minigame: '3d',
      main: CASE_3_HAND_LINE,
      target: 4,
      marker: 'Elias',
      place: { kind: 'point', at: CASE_3_CRYPT_PROPS.body },
      why: 'Lay the note beside the ledger, the receipt and Josiah’s signature on the Case tab.',
      done: 'One hand wrote the ledger, the receipt and the note: Silas Vane. Name him at the altar tonight.',
    },
    {
      main: 'Gather the relics of the rite',
      target: 5,
      marker: 'Relic',
      place: { kind: 'nearest-relic' },
      why: 'Only the rite lifts the curse for good. Journal pages 4 and 5 give the order.',
      done: 'All five relics. At night, lay them on the altar in the order of the rite.',
    },
  ],
}

/** Shown once when a stage's first day begins (not on a load): where the new case starts. */
export const STAGE_OPENING: Readonly<Partial<Record<1 | 2 | 3, string>>> = {
  // The three answers are all Vanes by design; these say so, so it never reads as a bug (playtest, 2026-11-28).
  2: 'The altar gave up the Rusted Crypt Key. It opens the Mausoleum Row gate. Josiah Vane signed Pell into the ground; mind where else that name turns up.',
  3: 'Two cases closed, and both ended at a Vane. That is no accident. Elias’s last page says to look for the Crane crypt.',
}

/** Both tracker lines are cut to this many characters. */
export const OBJECTIVE_MAX_LINE = 60
/** The why line under them is longer prose, but never more than this. */
export const OBJECTIVE_WHY_MAX = 100
