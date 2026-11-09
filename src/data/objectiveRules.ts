// Objective tracker rules (design bible §11). Order is priority: the selector returns
// the first rule whose condition matches, and rule 11 is the fallback.

export type ObjectiveRuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

/** Where an objective points, resolved by the selector against world data. */
export type PlaceRef =
  /** A `FIXED_SPAWNS` id in `zones.ts`. */
  | { kind: 'fixed-spawn'; id: string }
  /** The chapel altar. */
  | { kind: 'altar' }
  /** Nearest uncollected relic site in an already explored map cell (never reveals unexplored sites). */
  | { kind: 'nearest-relic' }

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
]

/** Both tracker lines are cut to this many characters. */
export const OBJECTIVE_MAX_LINE = 60
