// The one shared item-name label: which name is up and when it started.
// Uses the real clock (performance.now), not the sim clock, so it also works while paused or in menus.
import { create } from 'zustand'
import { ITEM_MAP } from '../../data/items'
import type { ItemId } from '../types'

export interface ItemNameState {
  name: string | null
  /** performance.now() when the current name was shown. */
  shownAt: number
  /** Bumps on every show, so showing the same name again restarts the timer. */
  ticket: number
  show: (id: ItemId | null | undefined, now?: number) => void
  clear: () => void
}

export const useItemNameStore = create<ItemNameState>((set) => ({
  name: null,
  shownAt: 0,
  ticket: 0,
  // An empty slot (null) shows nothing and leaves the current name running.
  show: (id, now = performance.now()) =>
    set((s) => {
      const def = id ? ITEM_MAP[id] : undefined
      return def ? { name: def.name, shownAt: now, ticket: s.ticket + 1 } : s
    }),
  clear: () => set({ name: null }),
}))

/** Shorthand for hover, focus and hotbar-switch call sites. */
export function showItemName(id: ItemId | null | undefined): void {
  useItemNameStore.getState().show(id)
}
