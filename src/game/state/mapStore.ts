// Journal map store: explored cells plus the cells the player hasn't seen inked yet.
// Explored cells persist to localStorage (Requirement 6.4); a full save slot arrives
// with the save system, which can reuse serializeMap / deserializeMap.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import {
  EMPTY_MAP,
  deserializeMap,
  revealAt,
  serializeMap,
  type Cell,
  type MapState,
} from '../systems/mapReveal'

export const MAP_STORAGE_KEY = 'last-rites-map'

function load(): MapState {
  try {
    const raw = globalThis.localStorage?.getItem(MAP_STORAGE_KEY)
    return raw ? deserializeMap(JSON.parse(raw)) : EMPTY_MAP
  } catch {
    return EMPTY_MAP
  }
}

function save(map: MapState): void {
  try {
    globalThis.localStorage?.setItem(MAP_STORAGE_KEY, JSON.stringify(serializeMap(map)))
  } catch {
    // Storage full or blocked: the map still works for this session.
  }
}

interface MapStoreState {
  map: MapState
  /** Cells explored since the journal was last opened; they ink in on next view. */
  unseen: Cell[]
  /** Mark the cell under a world position as explored. */
  reveal: (position: readonly [number, number, number]) => void
  /** Called when the map has played its draw animation. */
  markSeen: () => void
  /** Forget everything (new game). */
  reset: () => void
}

export const useMapStore = create<MapStoreState>((set, get) => ({
  map: load(),
  unseen: [],
  reveal: (position) => {
    const res = revealAt(get().map, position)
    if (res.newlyRevealed.length === 0) return
    save(res.map)
    set((s) => ({ map: res.map, unseen: [...s.unseen, ...res.newlyRevealed] }))
  },
  markSeen: () => {
    if (get().unseen.length > 0) set({ unseen: [] })
  },
  reset: () => {
    save(EMPTY_MAP)
    set({ map: EMPTY_MAP, unseen: [] })
  },
}))
