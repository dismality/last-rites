// Pure save/load logic for the persistent game save. No React / three.js.
// Storage is injected so tests run in Node and failures can be simulated.

import { SATCHEL_SLOTS_MAX as MAX_SATCHEL_SLOTS } from '../../data/items'
import type { TutorialStepId } from '../../data/tutorialSteps'
import type { Inventory, Phase, PlayerState, WorldState } from '../types'
import type { ChapelState } from './repairs'
import type { MysteryGateId, MysteryState } from './mystery'
import { sanitizeInventorySlots } from './combatSave'
import type { CombatSave } from './combatSave'
import type { ProgressionSave } from './progressionSave'
import { defaultProgressionSave } from './progressionSave'
import { parseTutorial, serializeTutorial } from './tutorial'
import type { ControlHintId } from '../../data/controlHints'
import { parseHintsUsed, serializeHintsUsed } from './controlHints'
import { MODES } from '../../data/modes'
import { STAGE_COUNT, type StageNumber } from '../../data/stages'
import { restorePins, serializePins, type Pin } from './mapPins'
import { freshStageSave, migrateSave, type StageSave } from './stageSave'
import { freshCaseSave, sanitizeCaseSave, type CaseSave } from './caseSave'

export const SAVE_KEY = 'lastrites:save'
export const SAVE_VERSION = 1

/** In-memory shape of everything a save captures. */
export interface SaveState {
  world: WorldState
  player: PlayerState
  inventory: Inventory
  mystery: MysteryState
  chapel: ChapelState
  /** Recipes unlocked by surviving nights / reading pages; the starting recipes are re-applied on load. */
  recipes: string[]
  /** First-day tutorial steps done. Optional on input (defaults empty) so older callers still compile; always set on read. */
  tutorial?: ReadonlySet<TutorialStepId>
  /** Intro cutscene already seen. Optional on input (derived from the world); always set on read. */
  introSeen?: boolean
  /** Controls hint lines already used (design bible §11). Optional on input; always set on read. */
  controlHints?: ReadonlySet<ControlHintId>
  /** Combat block (spec 07). Optional on input; on read it is the raw saved block, sanitised by the loader with sanitizeCombat. */
  combat?: CombatSave
  /** Progression block (spec 08). Optional on input and on read; the loader sanitises the raw block. */
  progression?: ProgressionSave
  /** Stage block (spec 10). Optional on input; the loader migrates old night-only saves. */
  stage?: StageSave
  /** Case block (spec 10 task 2.3). Optional on input; always written, and sanitised on read. */
  case?: CaseSave
  /** Map pins (spec 09 task 11l). Optional on input and on read; the loader sanitises them. */
  pins?: Pin[]
}

/** JSON shape: identical, except the mystery Sets become arrays. */
export interface SaveFile
  extends Omit<SaveState, 'mystery' | 'tutorial' | 'introSeen' | 'controlHints' | 'combat' | 'progression' | 'pins'> {
  pins: Pin[]
  controlHints: ControlHintId[]
  combat: CombatSave
  progression: ProgressionSave
  version: typeof SAVE_VERSION
  tutorial: number[]
  introSeen: boolean
  mystery: Omit<MysteryState, 'pages' | 'clues' | 'relics'> & {
    pages: number[]
    clues: string[]
    relics: string[]
  }
}

const PHASES: readonly Phase[] = ['day', 'dusk', 'night', 'dawn']
const GATES: readonly MysteryGateId[] = ['mausoleum-row', 'catacombs', 'ossuary']
const ENDINGS = ['rest', 'uneasy-peace', 'taken']

/** Saves from before the intro existed: past night 1 day means the player has seen it. */
export const hasPassedFirstDay = (world: Pick<WorldState, 'nightNumber' | 'phase'>): boolean =>
  world.nightNumber > 1 || world.phase !== 'day'

export function toSaveFile(state: SaveState): SaveFile {
  const { mystery } = state
  return {
    version: SAVE_VERSION,
    world: state.world,
    player: state.player,
    inventory: state.inventory,
    mystery: {
      ...mystery,
      pages: [...mystery.pages],
      clues: [...mystery.clues],
      relics: [...mystery.relics],
    },
    chapel: state.chapel,
    recipes: state.recipes,
    tutorial: serializeTutorial(state.tutorial ?? new Set()),
    introSeen: state.introSeen ?? hasPassedFirstDay(state.world),
    controlHints: serializeHintsUsed(state.controlHints ?? new Set()),
    combat: state.combat ?? {
      firearms: {},
      durability: {},
      upgrades: [],
      takenPickups: [],
      doors: { built: false, front: [], vestry: [] },
    },
    progression: state.progression ?? defaultProgressionSave(),
    pins: serializePins(state.pins ?? []),
    // Always written, so a reload never mistakes a stage number for an old night number.
    stage:
      state.stage ??
      freshStageSave(Math.min(Math.max(Math.floor(state.world.nightNumber) || 1, 1), STAGE_COUNT) as StageNumber),
    case: state.case ?? freshCaseSave(),
  }
}

// ── Shape guards ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)

function validWorld(v: unknown): v is WorldState {
  return (
    isObj(v) &&
    PHASES.includes(v.phase as Phase) &&
    isNum(v.phaseTime) &&
    isNum(v.nightNumber) &&
    isNum(v.fogDensity) &&
    typeof v.wavesCleared === 'boolean'
  )
}

function validPlayer(v: unknown): v is PlayerState {
  return (
    isObj(v) &&
    Array.isArray(v.position) &&
    v.position.length === 3 &&
    v.position.every(isNum) &&
    isNum(v.yaw) &&
    isNum(v.pitch) &&
    isNum(v.health) &&
    isNum(v.stamina) &&
    (v.interactTarget === null || isStr(v.interactTarget))
  )
}

function validInventory(v: unknown): v is Inventory {
  return (
    isObj(v) &&
    Array.isArray(v.slots) &&
    v.slots.length <= MAX_SATCHEL_SLOTS &&
    v.slots.every((s) => isObj(s) && isStr(s.item) && isNum(s.qty) && s.qty > 0) &&
    isStrArray(v.keyItems) &&
    isStrArray(v.relics) &&
    Array.isArray(v.hotbar) &&
    v.hotbar.length === 4 &&
    v.hotbar.every((h) => h === null || isStr(h))
  )
}

function validMystery(v: unknown): boolean {
  return (
    isObj(v) &&
    Array.isArray(v.pages) &&
    v.pages.every(isNum) &&
    isStrArray(v.clues) &&
    isStrArray(v.relics) &&
    isObj(v.gates) &&
    GATES.every((g) => typeof (v.gates as Obj)[g] === 'boolean') &&
    isNum(v.riteProgress) &&
    (v.ending === undefined || ENDINGS.includes(v.ending as string)) &&
    (v.craneRested === undefined || typeof v.craneRested === 'boolean')
  )
}

function validChapel(v: unknown): v is ChapelState {
  return (
    isObj(v) &&
    isStrArray(v.completedStages) &&
    typeof v.altarHealedToday === 'boolean' &&
    typeof v.finalRiteActive === 'boolean'
  )
}

/** Returns the restored state, or null if the version or any part of the shape is wrong. */
export function fromSaveFile(
  raw: unknown,
): (SaveState & { tutorial: ReadonlySet<TutorialStepId>; introSeen: boolean }) | null {
  if (!isObj(raw) || raw.version !== SAVE_VERSION) return null
  const { world, player, mystery, chapel, recipes } = raw
  // Bad slot entries are dropped one by one (Req 19.4); a wrong overall shape still fails below.
  const inventory = sanitizeInventorySlots(raw.inventory)
  if (
    !validWorld(world) ||
    !validPlayer(player) ||
    !validInventory(inventory) ||
    !validMystery(mystery) ||
    !validChapel(chapel) ||
    !isStrArray(recipes)
  ) {
    return null
  }
  const m = mystery as unknown as SaveFile['mystery']
  // Saves from before stages carry night 1..5: story saves are mapped onto the three stages.
  const modeId = isObj(raw.progression) ? (raw.progression as Obj).mode : undefined
  const story = typeof modeId === 'string' && modeId in MODES ? MODES[modeId as keyof typeof MODES].story : true
  const migrated = migrateSave(world, raw.stage, story)
  return {
    world: { ...world, nightNumber: migrated.nightNumber },
    stage: migrated.stage,
    // Old saves have no block: a fresh Stage-1 case state (Req 4.7). Stale ids are dropped.
    case: sanitizeCaseSave(raw.case),
    player,
    inventory,
    chapel,
    recipes,
    tutorial: parseTutorial(raw.tutorial),
    introSeen: typeof raw.introSeen === 'boolean' ? raw.introSeen : hasPassedFirstDay(world),
    // Older saves have none: every line shows again until used.
    controlHints: parseHintsUsed(raw.controlHints),
    combat: raw.combat as CombatSave | undefined,
    // Raw block; the loader runs sanitizeProgression so a bad field never fails the whole save.
    progression: raw.progression as ProgressionSave | undefined,
    // Older saves have none; bad entries are dropped one by one.
    pins: restorePins(raw.pins),
    mystery: {
      ...m,
      craneRested: m.craneRested ?? false,
      pages: new Set(m.pages) as MysteryState['pages'],
      clues: new Set(m.clues),
      relics: new Set(m.relics) as MysteryState['relics'],
    } as MysteryState,
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

/** Returns false when storage is missing or throws (private mode, quota). */
export function writeSave(
  storage: Pick<Storage, 'setItem'> | undefined,
  state: SaveState,
): boolean {
  try {
    if (!storage) return false
    storage.setItem(SAVE_KEY, JSON.stringify(toSaveFile(state)))
    return true
  } catch {
    return false
  }
}

/** Returns null when the save is missing, unparsable, or fails validation. Never throws. */
export function readSave(storage: Pick<Storage, 'getItem'> | undefined): SaveState | null {
  try {
    const raw = storage?.getItem(SAVE_KEY)
    if (!raw) return null
    return fromSaveFile(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Continue is shown only for a save that would actually load. */
export function hasValidSave(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  return readSave(storage) !== null
}
