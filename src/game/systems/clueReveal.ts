// The clue reveal (spec 09 task 11q): a found clue's picture, title and text fade in a little
// below the crosshair, hold, then fade out. Pure timing and queue rules; the store and the HUD
// component drive them from the real clock.

/** One line waiting to be shown. A `plain` line (the ledger refusal) has no picture, title or journal line. */
export interface RevealItem {
  readonly key: string
  readonly kind: 'clue' | 'plain'
  readonly title?: string
  readonly text: string
  /** Picture URL, or undefined for clues with no picture (headstones, plaques, case clues). */
  readonly image?: string
  /** When it was queued, ms on the same clock as `tickReveal`'s `now`. */
  readonly queuedAt: number
}

export interface RevealState {
  readonly queue: readonly RevealItem[]
  readonly current: { readonly item: RevealItem; readonly startedAt: number } | null
}

export const REVEAL_FADE_IN_S = 0.5
export const REVEAL_FADE_OUT_S = 1.2
export const REVEAL_HOLD_BASE_S = 3.5
export const REVEAL_HOLD_PER_CHAR_S = 0.045
export const REVEAL_HOLD_MAX_S = 10
/** A clue that waited longer than this behind a menu is dropped: it is already in the journal. */
export const REVEAL_MAX_WAIT_S = 30
/** Rise during the fade-in, px (none with reduced motion). */
export const REVEAL_RISE_PX = 6

export const emptyReveal = (): RevealState => ({ queue: [], current: null })

/** Seconds the line stays fully shown: longer text holds longer, up to the cap. */
export function revealHoldSeconds(text: string): number {
  return Math.min(REVEAL_HOLD_BASE_S + REVEAL_HOLD_PER_CHAR_S * text.length, REVEAL_HOLD_MAX_S)
}

/** Whole time on screen, fade-in to the end of the fade-out. */
export function revealTotalSeconds(text: string): number {
  return REVEAL_FADE_IN_S + revealHoldSeconds(text) + REVEAL_FADE_OUT_S
}

export function enqueueReveal(state: RevealState, item: RevealItem): RevealState {
  // The same clue twice in the queue (or already showing) is shown once.
  if (state.current?.item.key === item.key || state.queue.some((q) => q.key === item.key)) return state
  return { ...state, queue: [...state.queue, item] }
}

/**
 * Advances the reveal to `now` (ms). A finished line is cleared. A new one starts only when
 * nothing is showing and no menu, journal, examine or cutscene is open (`blocked`). Lines that
 * waited too long are dropped. A line already showing keeps playing if a menu opens.
 */
export function tickReveal(state: RevealState, now: number, blocked: boolean): RevealState {
  let { queue, current } = state
  if (current && (now - current.startedAt) / 1000 >= revealTotalSeconds(current.item.text)) current = null
  const fresh = queue.filter((q) => (now - q.queuedAt) / 1000 <= REVEAL_MAX_WAIT_S)
  if (fresh.length !== queue.length) queue = fresh
  if (!current && !blocked && queue.length > 0) {
    current = { item: queue[0], startedAt: now }
    queue = queue.slice(1)
  }
  return current === state.current && queue === state.queue ? state : { queue, current }
}

export interface RevealLook {
  readonly opacity: number
  /** Downward offset in px (rises to 0 while fading in). */
  readonly offsetY: number
  /** Blur in px: the ink spreads and sharpens while fading in. */
  readonly blur: number
}

const smooth = (k: number) => k * k * (3 - 2 * k)

/** How the line looks `elapsed` seconds after it started. */
export function revealLook(elapsed: number, text: string, reducedMotion: boolean): RevealLook {
  const hold = revealHoldSeconds(text)
  if (elapsed <= 0) return { opacity: 0, offsetY: reducedMotion ? 0 : REVEAL_RISE_PX, blur: reducedMotion ? 0 : 2 }
  if (elapsed < REVEAL_FADE_IN_S) {
    const k = smooth(elapsed / REVEAL_FADE_IN_S)
    if (reducedMotion) return { opacity: k, offsetY: 0, blur: 0 }
    return { opacity: k, offsetY: REVEAL_RISE_PX * (1 - k), blur: 2 * (1 - k) }
  }
  const out = elapsed - REVEAL_FADE_IN_S - hold
  if (out <= 0) return { opacity: 1, offsetY: 0, blur: 0 }
  return { opacity: Math.max(0, 1 - smooth(Math.min(out / REVEAL_FADE_OUT_S, 1))), offsetY: 0, blur: 0 }
}
