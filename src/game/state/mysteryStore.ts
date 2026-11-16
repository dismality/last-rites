// Mystery state store: which gates are open. Pure zustand, no React / three.js imports.
// The scene calls `interactGate`; the pure rules live in systems/gates.ts.
import { create } from 'zustand'
import type { GateUseSite } from '../../data/gateHints'
import { emit } from '../events'
import { tryOpenGate, type GateUseResult } from '../systems/gates'
import { CLUE_MAP } from '../../data/clues'
import type { PageNumber } from '../types'
import {
  collectPage,
  createMysteryState,
  discoverClue,
  type MysteryGateId,
  type MysteryState,
} from '../systems/mystery'
import { canDiscoverClue } from '../systems/tombstones'
import { useInventoryStore } from './inventoryStore'
import { useToastStore } from './toastStore'
import { useClueRevealStore } from './clueRevealStore'

/** Seconds a gate caption stays up. */
const GATE_SUBTITLE_S = 3

interface MysteryStoreState {
  mystery: MysteryState
  /** Tries `gate` from `site` with the player's key items; toasts the hint or unlock text. */
  interactGate: (gate: MysteryGateId, site: GateUseSite) => GateUseResult
  /** Records a clue; the first time, the clue reveal shows it. Returns false if the clue needs a missing item. */
  discoverClue: (clueId: string) => boolean
  /** The journal's Clues tab has been read: no clue is new any more. */
  markCluesRead: () => void
  /** Records a journal page as collected. */
  collectPage: (page: PageNumber) => void
  /** Records that Father Crane was put to rest (Req 17.15). */
  recordCraneRested: () => void
  reset: () => void
}

export const useMysteryStore = create<MysteryStoreState>((set, get) => ({
  mystery: createMysteryState(),
  interactGate: (gate, site) => {
    const result = tryOpenGate(get().mystery, gate, site, useInventoryStore.getState().inventory)
    if (result.kind === 'opened') {
      set({ mystery: result.state })
      useToastStore.getState().push(result.text)
      // Always captioned: the unlock sound is the only cue that something moved.
      emit({ type: 'subtitleShown', text: result.sound, duration: GATE_SUBTITLE_S, force: true })
    } else if (result.kind === 'hint') {
      useToastStore.getState().push(result.text)
    }
    return result
  },
  discoverClue: (clueId) => {
    if (!canDiscoverClue(clueId, useInventoryStore.getState().inventory)) return false
    const before = get().mystery
    const next = discoverClue(before, clueId)
    if (next !== before) {
      set({ mystery: next })
      // The reveal replaces the old "Clue noted" toast (spec 09 task 11q).
      if (CLUE_MAP[clueId]) useClueRevealStore.getState().revealClue(clueId)
    }
    return true
  },
  markCluesRead: () => {
    const m = get().mystery
    if (m.cluesRead !== m.clues.size) set({ mystery: { ...m, cluesRead: m.clues.size } })
  },
  collectPage: (page) => set({ mystery: collectPage(get().mystery, page) }),
  recordCraneRested: () => set({ mystery: { ...get().mystery, craneRested: true } }),
  reset: () => set({ mystery: createMysteryState() }),
}))
