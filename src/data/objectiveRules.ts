// Objective tracker rules (design bible §11). Order is priority: the selector returns
// the first rule whose condition matches, and rule 11 is the fallback.

import { CASE_1_BELLS, CASE_2_CASTS, CASE_2_CREST_LOCK, CASE_2_LOGBOOK_POSITION, CASE_3_CRYPT_PROPS } from './cases'
import { POWDER_TIN_HUT } from './cemeteryLayout'
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

type Point = readonly [number, number, number]

/** Where a stage day step points: one place, the nearest of several, or the nearest known relic. */
export type StageDayPlace =
  | { readonly kind: 'point'; readonly at: Point }
  | { readonly kind: 'nearest'; readonly at: readonly Point[] }
  | { readonly kind: 'nearest-relic' }

/** Day rules 5-10 per stage: the first unsolved line wins. `target` is the progress denominator. */
export interface StageDayRule {
  readonly main: string
  readonly target: number
  readonly marker: string
  readonly place: StageDayPlace
}

/** The parish register page beside the powder tin on the hut shelf (Hut.tsx). */
const LEDGER_PAGE: Point = [POWDER_TIN_HUT[0] + 0.35, POWDER_TIN_HUT[1], POWDER_TIN_HUT[2]]

export const STAGE_DAY_RULES: Readonly<Record<1 | 2 | 3, readonly StageDayRule[]>> = {
  1: [
    { main: 'Cross-check the ledger against the stones', target: 1, marker: 'Ledger', place: { kind: 'point', at: LEDGER_PAGE } },
    {
      main: 'Examine the three bells',
      target: 3,
      marker: 'Bells',
      place: { kind: 'nearest', at: CASE_1_BELLS.map((b) => b.position) },
    },
  ],
  2: [
    { main: "Open the sexton's crest lock", target: 1, marker: 'Crest lock', place: { kind: 'point', at: CASE_2_CREST_LOCK.niche } },
    { main: 'Put the watch log in order', target: 1, marker: 'Watch log', place: { kind: 'point', at: CASE_2_LOGBOOK_POSITION } },
    { main: 'Compare the boot prints', target: 1, marker: 'Casts', place: { kind: 'point', at: CASE_2_CASTS[1].position } },
  ],
  3: [
    { main: 'Set the hymn tiles at the altar', target: 1, marker: 'Hymn board', place: { kind: 'point', at: HYMN_BOARD_POSITION } },
    { main: "Reconstruct Elias's last night", target: 1, marker: 'Slate', place: { kind: 'point', at: CASE_3_CRYPT_PROPS.slate } },
    { main: 'Gather the relics of the rite', target: 5, marker: 'Relic', place: { kind: 'nearest-relic' } },
  ],
}

/** Both tracker lines are cut to this many characters. */
export const OBJECTIVE_MAX_LINE = 60
