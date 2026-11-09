/*
  Pure focus rules for MenuDialog. They take structural types so they run in
  Node tests (the project has no DOM test environment).
*/

export const AUTOFOCUS_SELECTOR = '[data-autofocus]'

export interface FocusLike {
  focus(): void
}

export interface PanelLike<T extends FocusLike> {
  querySelector(selector: string): T | null
}

/** The control to focus on open: first data-autofocus match, else the first focusable, else the panel. */
export function pickInitialFocus<T extends FocusLike>(
  panel: PanelLike<T> & FocusLike,
  focusableSelector: string,
): FocusLike {
  return (
    panel.querySelector(AUTOFOCUS_SELECTOR) ?? panel.querySelector(focusableSelector) ?? panel
  )
}

/** Where Tab should wrap to, or null when the browser may move focus normally. */
export function tabWrapTarget<T>(
  items: readonly T[],
  active: unknown,
  panel: unknown,
  shift: boolean,
): T | null {
  if (items.length === 0) return null
  const first = items[0]
  const last = items[items.length - 1]
  if (shift && (active === first || active === panel)) return last
  if (!shift && active === last) return first
  return null
}
