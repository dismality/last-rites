// Which info dot tooltip is open, and the one Escape listener that closes it (spec 11 H5, Req 5.6).
// The pause key listener (usePauseTriggers) and the overlays (journal, satchel, map) listen on
// window; the overlays in the capture phase. This listener is installed when the module loads,
// so it is registered before any of them and stopImmediatePropagation keeps Esc from reaching
// them. With no tooltip open it does nothing and Esc reaches pause as before.

let closeOpen: (() => void) | null = null

/** True while a tooltip is open. */
export function isInfoTipOpen(): boolean {
  return closeOpen !== null
}

/** Registers the open tooltip's closer. Returns a function that clears it (if still current). */
export function registerOpenTip(close: () => void): () => void {
  closeOpen?.()
  closeOpen = close
  return () => {
    if (closeOpen === close) closeOpen = null
  }
}

/** Closes the open tooltip, if any. Returns whether one was open. */
export function closeOpenTip(): boolean {
  const close = closeOpen
  if (!close) return false
  closeOpen = null
  close()
  return true
}

/** The Escape rule: closes the tooltip and swallows the key; otherwise lets it pass. */
export function handleInfoTipKey(e: Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopImmediatePropagation'>): boolean {
  if (e.key !== 'Escape' || !closeOpenTip()) return false
  e.preventDefault()
  e.stopImmediatePropagation()
  return true
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleInfoTipKey, true)
}
