// Pure save/load logic for the persistent game save. No React / three.js.
// Storage is injected so tests run in Node and failures can be simulated.

import { SATCHEL_SLOTS as MAX_SATCHEL_SLOTS } from '../../data/items'
import type { Inventory, Phase, PlayerState, WorldState } from '../types'
import type { ChapelState } from './repairs'
import type { MysteryGateId, MysteryState } from './mystery'

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
}

/** JSON shape: identical, except the mystery Sets become arrays. */
export interface SaveFile extends Omit<SaveState, 'mystery'> {
  version: typeof SAVE_VERSION
  mystery: Omit<MysteryState, 'pages' | 'clues' | 'relics'> & {
    pages: number[]
    clues: string[]
    relics: string[]
  }
}

const PHASES: readonly Phase[] = ['day', 'dusk', 'night', 'dawn']
const GATES: readonly MysteryGateId[] = ['mausoleum-row', 'catacombs', 'ossuary']
const ENDINGS = ['rest', 'uneasy-peace', 'taken']

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
    (v.ending === undefined || ENDINGS.includes(v.ending as string))
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
export function fromSaveFile(raw: unknown): SaveState | null {
  if (!isObj(raw) || raw.version !== SAVE_VERSION) return null
  const { world, player, inventory, mystery, chapel, recipes } = raw
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
  return {
    world,
    player,
    inventory,
    chapel,
    recipes,
    mystery: {
      ...m,
      pages: new Set(m.pages) as MysteryState['pages'],
      clues: new Set(m.clues),
      relics: new Set(m.relics) as MysteryState['relics'],
    } as MysteryState,
  }
}

// ── Storage ─────────────────────────────────────────────────────────────────

/** Returns false when storage is missing or throws (private mode, quota). */
export function writeSave(storage: Pick<Storage, 'setItem'> | undefined, state: SaveState): boolean {
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
