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

/** Seconds the player must hold Interact at the altar (design bible §8). */
export const RITE_DURATION = 45

export interface MysteryState {
  pages: ReadonlySet<PageNumber>
  clues: ReadonlySet<string>
  relics: ReadonlySet<RelicId>
  gates: Readonly<Record<MysteryGateId, boolean>>
  /** Seconds of rite completed, 0..RITE_DURATION */
  riteProgress: number
  ending?: EndingId
}

export function createMysteryState(): MysteryState {
  return {
    pages: new Set(),
    clues: new Set(),
    relics: new Set(),
    gates: { 'mausoleum-row': false, catacombs: false, ossuary: false },
    riteProgress: 0,
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

/**
 * Advances the rite while holding. Releasing pauses (never resets) progress,
 * so a zombie interruption is recoverable. Clamped at RITE_DURATION.
 */
export function tickRite(state: MysteryState, dt: number, holding: boolean): MysteryState {
  if (!holding || dt <= 0 || state.riteProgress >= RITE_DURATION) return state
  return { ...state, riteProgress: Math.min(RITE_DURATION, state.riteProgress + dt) }
}

export function isRiteComplete(state: MysteryState): boolean {
  return state.riteProgress >= RITE_DURATION
}

/** Total over all non-negative integers: 5+ rest, 3-4 uneasy peace, otherwise taken. */
export function chooseEnding(relicCount: number): EndingId {
  if (relicCount >= 5) return 'rest'
  if (relicCount >= 3) return 'uneasy-peace'
  return 'taken'
}
