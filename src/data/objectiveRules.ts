// Objective tracker rules (design bible §11). Order is priority: the selector returns
// the first rule whose condition matches, and rule 11 is the fallback.

import {
  CASE_1_BELLS,
  CASE_2_CASTS,
  CASE_2_CREST_LOCK,
  CASE_2_LOGBOOK_POSITION,
  CASE_3_BOOTS_CLUE,
  CASE_3_CRYPT_PROPS,
  CASE_3_EVIDENCE_SPOTS,
  type CrestTabletDef,
  type EvidenceCardId,
  type MinigameId,
} from './cases'
import { avenueCrypts, MAUSOLEUM_ROW, POWDER_TIN_HUT } from './cemeteryLayout'
import { CLUE_SPOTS } from './tombstones'
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
export const CASE_LINK_LINE = "Link the clues in the journal's Case tab ({n}/{m})"
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

/**
 * Stage 2 opens behind the Mausoleum Row gate, so the day starts with its key: Pell's grave gives
 * it up once case 1 is solved. The search circle sits a few metres off the grave so it says "around
 * here", not "exactly here".
 */
const CRYPT_KEY_SEARCH: StageDayPlace = { kind: 'area', at: [-11, 0, -19.5], radiusM: 7 }
/** The Mausoleum Row gate across the avenue mouth on the north fence (Gates.tsx). */
export const ROW_GATE_POSITION: Point = [MAUSOLEUM_ROW.centerX, 0, MAUSOLEUM_ROW.entranceZ]

/** Where a crypt tablet hangs: on the avenue railing in front of its crypt (CaseProps.tsx). */
export function crestTabletPosition(t: CrestTabletDef): Point {
  const crypt = avenueCrypts()[t.crypt]
  const z = crypt ? crypt.position[2] : MAUSOLEUM_ROW.entranceZ
  const west = crypt ? crypt.position[0] < MAUSOLEUM_ROW.centerX : true
  return [MAUSOLEUM_ROW.centerX + (west ? -1 : 1) * (MAUSOLEUM_ROW.width / 2), 0, z]
}

/**
 * Where each of Elias's evidence cards lies, as a search area centre: a little off the thing
 * itself, so the ring says "around here". The dry boots are the hut's boots clue.
 */
const EVIDENCE_AREA_OFFSET: Point = [1.2, 0, 1]
const offsetArea = (p: readonly [number, number, number]): Point => [p[0] + EVIDENCE_AREA_OFFSET[0], 0, p[2] + EVIDENCE_AREA_OFFSET[2]]
const BOOTS_AT = CLUE_SPOTS.find((c) => c.clueId === CASE_3_BOOTS_CLUE)?.position ?? POWDER_TIN_HUT
export const EVIDENCE_SEARCH: Readonly<Record<EvidenceCardId, Point>> = {
  'dry-boots': offsetArea(BOOTS_AT),
  'unsent-letter': offsetArea(CASE_3_EVIDENCE_SPOTS['unsent-letter'].position),
  'cart-ruts': offsetArea(CASE_3_EVIDENCE_SPOTS['cart-ruts'].position),
  'spilled-oil': offsetArea(CASE_3_EVIDENCE_SPOTS['spilled-oil'].position),
  'hearse-pin': offsetArea(CASE_3_EVIDENCE_SPOTS['hearse-pin'].position),
  'nail-marks': offsetArea(CASE_3_EVIDENCE_SPOTS['nail-marks'].position),
}
/** Radius of each evidence search ring (metres). */
export const EVIDENCE_RADIUS_M = 4

/** The parish register page beside the powder tin on the hut shelf (Hut.tsx). */
const LEDGER_PAGE: Point = [POWDER_TIN_HUT[0] + 0.35, POWDER_TIN_HUT[1], POWDER_TIN_HUT[2]]

export const STAGE_DAY_RULES: Readonly<Record<1 | 2 | 3, readonly StageDayRule[]>> = {
  1: [
    {
      minigame: '1a',
      main: 'Cross-check the ledger against the stones',
      target: 1,
      marker: 'Ledger',
      place: { kind: 'point', at: LEDGER_PAGE },
      why: 'Elias wrote that the ledger and the stones disagree. Find the graves that do not match.',
      done: 'Three burials do not add up: Pell, Ames and Hale. Each of those graves has a safety bell.',
    },
    {
      minigame: '1b',
      main: 'Examine the three bells',
      target: 3,
      // All three looked at is not the end: the step closes when the cut bell is named.
      whenCounted: 'Name the cut bell at a bell post',
      why: 'Someone was buried alive. A safety bell lets the buried ring for help: one was silenced.',
      done: 'The silenced bell is named. Its clues are pinned to your case board (J).',
      marker: 'Bells',
      place: { kind: 'nearest', at: CASE_1_BELLS.map((b) => b.position) },
    },
  ],
  2: [
    {
      main: 'Find the key to the Mausoleum Row gate',
      target: 1,
      marker: 'Search here',
      place: CRYPT_KEY_SEARCH,
      why: 'With the curse lifted, Pell’s grave gave something up. The next case lies past that gate.',
      done: 'The Rusted Crypt Key. It fits the Mausoleum Row gate on the north fence.',
    },
    {
      main: 'Open the Mausoleum Row gate',
      target: 1,
      marker: 'Row gate',
      place: { kind: 'point', at: ROW_GATE_POSITION },
      why: 'The crypt key fits the Mausoleum Row gate on the north fence.',
      done: 'The gate lifts. Six crypt tablets hang on the avenue railings.',
    },
    {
      main: 'Read the crypt tablets',
      target: CASE_2_CREST_LOCK.tablets.length,
      marker: 'Tablet',
      place: { kind: 'nearest', at: CASE_2_CREST_LOCK.tablets.map(crestTabletPosition) },
      why: 'Graves were robbed in 1849, and the sexton locked his records away. The tablets hold the key.',
      done: 'Each tablet gives a family, a crest and a year. The sexton’s crest lock is in the west niche.',
    },
    {
      minigame: '2a',
      main: "Open the sexton's crest lock",
      target: 1,
      marker: 'Crest lock',
      place: { kind: 'point', at: CASE_2_CREST_LOCK.niche },
      why: 'Turn the founders’ crests in the order they were laid down, from the tablets’ years.',
      done: 'Inside: the sexton’s bone whistle and his watch ledger. Its torn pages lie in the lodge.',
    },
    {
      minigame: '2b',
      main: 'Put the watch log in order',
      target: 1,
      marker: 'Watch log',
      place: { kind: 'point', at: CASE_2_LOGBOOK_POSITION },
      why: 'The watch ledger is torn. Its pages lie in the gatekeeper’s lodge: put that night in order.',
      done: 'The log falls silent for two hours, the night the Ames grave was robbed.',
    },
    {
      minigame: '2c',
      main: 'Compare the boot prints',
      target: 1,
      marker: 'Casts',
      place: { kind: 'point', at: CASE_2_CASTS[1].position },
      why: 'The log falls silent the night the Ames grave was robbed. Its boot prints will say who.',
      done: 'One cast matches a pair of boots. The case board can name the body snatcher now.',
    },
  ],
  3: [
    {
      minigame: '3a',
      main: 'Set the hymn tiles at the altar',
      target: 1,
      marker: 'Hymn board',
      place: { kind: 'point', at: HYMN_BOARD_POSITION },
      why: 'Crane hid something "beneath the Word". The hymn board and the vestry psalter spell it out.',
      done: 'The tiles spell BELOW. With the sexton’s whistle, the stair behind the altar opens.',
    },
    {
      main: 'Find what happened to Elias',
      target: 6,
      marker: 'Search here',
      place: { kind: 'area', at: EVIDENCE_SEARCH['cart-ruts'], radiusM: EVIDENCE_RADIUS_M },
      why: 'Elias went to the Crane crypt and never came back. Six things he left tell his last night.',
      done: 'Six pieces of his last night. Lay them in order on the slate by the Crane crypt.',
    },
    {
      minigame: '3b',
      main: "Reconstruct Elias's last night",
      target: 1,
      marker: 'Slate',
      place: { kind: 'point', at: CASE_3_CRYPT_PROPS.slate },
      why: 'Set the six pieces in the order they happened, from midnight to dawn.',
      done: 'He was sealed in alive. The crypt is open: Elias, and the Iron Ossuary Key.',
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
  2: 'Something glints in Pell’s grave.',
  3: 'Two cases closed. Elias’s own story is the last.',
}

/** Both tracker lines are cut to this many characters. */
export const OBJECTIVE_MAX_LINE = 60
/** The why line under them is longer prose, but never more than this. */
export const OBJECTIVE_WHY_MAX = 100
