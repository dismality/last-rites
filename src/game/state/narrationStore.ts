// The keeper thinking aloud (playtest: clues were found but never explained). Each find queues a
// few plain lines that say what it is, what it means and what to check next; the HUD shows them one
// at a time. Every line said is also kept, newest last, so the journal can show them again.
// Pure zustand: no React or three.js imports. Timing is driven by the HUD component's clock.

import { create } from 'zustand'

/** Seconds a line stays up: long enough to read at an easy pace, never under 2.6 s. */
export function lineSeconds(text: string): number {
  return Math.max(2.6, 1.2 + text.length * 0.055)
}

/** How many said lines the journal keeps. */
const HEARD_MAX = 60

interface NarrationState {
  /** Lines waiting to be shown, the first one on screen. */
  queue: string[]
  /** Every line said this run, oldest first (capped). */
  heard: string[]
  /**
   * Say lines now. They replace what is still waiting, so the keeper always speaks to the latest
   * find (playtest: a backlog made feedback arrive late); every line is still kept in `heard`.
   */
  say: (lines: string | readonly string[]) => void
  /** The line on screen is done: show the next. */
  next: () => void
  clear: () => void
}

export const useNarrationStore = create<NarrationState>((set) => ({
  queue: [],
  heard: [],
  say: (lines) =>
    set((s) => {
      const add = [...new Set(typeof lines === 'string' ? [lines] : lines)].filter((l) => l !== '')
      if (add.length === 0) return s
      return { queue: add, heard: [...s.heard, ...add].slice(-HEARD_MAX) }
    }),
  next: () => set((s) => (s.queue.length === 0 ? s : { queue: s.queue.slice(1) })),
  clear: () => set({ queue: [], heard: [] }),
}))

/** Say lines as the keeper. */
export const narrate = (lines: string | readonly string[]): void => useNarrationStore.getState().say(lines)
