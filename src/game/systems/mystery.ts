// Mystery state: journal pages, clues, relics, locked gates, final rite, ending.
// Pure and immutable; every function returns a new state.

import type { EndingId, KeyItemId, PageNumber, RelicId } from '../types'

/** Gates the mystery controls. 'ossuary' is the deepest catacomb chamber door. */
export type MysteryGateId = 'mausoleum-row' | 'catacombs' | 'ossuary'

export const MYSTERY_GATE_KEYS: Readonly<Record<MysteryGateId, KeyItemId>> = {
  'mausoleum-row': 'rusted-crypt-key',
  catacombs: 'bone-whistle',
  ossuary: 'iron-ossuary-key',
}

export interface MysteryState {
  pages: ReadonlySet<PageNumber>
  clues: ReadonlySet<string>
  relics: ReadonlySet<RelicId>
  gates: Readonly<Record<MysteryGateId, boolean>>
  /**
   * Retired with the 45 s hold (spec 10 task 4.5): always 0 now. The field stays so older saves
   * and Retry snapshots still load; relic placement lives in `riteStore`.
   */
  riteProgress: number
  ending?: EndingId
  /** Father Crane was put to rest. Optional so older saves load; endings still depend only on relics. */
  craneRested?: boolean
  /**
   * How many of `clues` (in found order) the player has seen in the journal's Clues tab; the rest
   * are new (spec 09 task 11q). Optional so older saves load: missing means all read.
   */
  cluesRead?: number
}

export function createMysteryState(): MysteryState {
  return {
    pages: new Set(),
    clues: new Set(),
    relics: new Set(),
    gates: { 'mausoleum-row': false, catacombs: false, ossuary: false },
    riteProgress: 0,
    cluesRead: 0,
  }
}

function withAdded<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  return set.has(value) ? set : new Set([...set, value])
}

export function collectPage(state: MysteryState, page: PageNumber): MysteryState {
  return state.pages.has(page) ? state : { ...state, pages: withAdded(state.pages, page) }
}

export function discoverClue(state: MysteryState, clueId: string): MysteryState {
  return state.clues.has(clueId) ? state : { ...state, clues: withAdded(state.clues, clueId) }
}

export function collectRelic(state: MysteryState, relic: RelicId): MysteryState {
  return state.relics.has(relic) ? state : { ...state, relics: withAdded(state.relics, relic) }
}

/** Opens a gate only if the matching key is held; otherwise returns state unchanged. */
export function openGate(
  state: MysteryState,
  gate: MysteryGateId,
  inventory: { readonly keyItems: readonly KeyItemId[] },
): MysteryState {
  if (state.gates[gate]) return state
  if (!inventory.keyItems.includes(MYSTERY_GATE_KEYS[gate])) return state
  return { ...state, gates: { ...state.gates, [gate]: true } }
}

/** Total over all non-negative integers: all five relics is Rest, anything less is Taken. Uneasy Peace is retired (spec 10, Req 17.8). */
export function chooseEnding(relicCount: number): EndingId {
  if (relicCount >= 5) return 'rest'
  return 'taken'
}

/** A stored ending from any build: the retired Uneasy Peace becomes Rest or Taken by relic count (spec 10 design decision 12). */
export function migrateEnding(stored: string | undefined, relicCount: number): EndingId | undefined {
  if (stored === undefined) return undefined
  if (stored === 'rest' || stored === 'taken') return stored
  return chooseEnding(relicCount)
}

/** Clues found since the Clues tab was last read (found order is the set's order). */
export function unreadClueCount(state: Pick<MysteryState, 'clues' | 'cluesRead'>): number {
  return Math.max(0, state.clues.size - (state.cluesRead ?? state.clues.size))
}
