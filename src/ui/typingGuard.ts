// While the player types into a text field (the altar's typed answer), letters must stay letters:
// J must not open the journal, E must not interact, digits must not change the hotbar. Every game
// key handler listens on the window in the capture phase, so this guard is installed first and
// stops a keydown from going further when it starts in a text field. Esc and Tab still pass, so
// the field's panel can close and focus can move. Typing itself is the browser's default action,
// which this never prevents.

const PASS = new Set(['Escape', 'Tab'])

/** True for a field the player types words into. */
export function isTextField(t: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(t instanceof HTMLElement)) return false
  if (t instanceof HTMLTextAreaElement) return true
  if (t instanceof HTMLInputElement) return ['text', 'search', ''].includes(t.type)
  return t.isContentEditable
}

/** Install once, before any other keydown listener. Returns the uninstall function. */
export function installTypingGuard(target: Window = window): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (PASS.has(e.code) || !isTextField(e.target)) return
    e.stopImmediatePropagation()
  }
  target.addEventListener('keydown', onKey, true)
  target.addEventListener('keyup', onKey, true)
  return () => {
    target.removeEventListener('keydown', onKey, true)
    target.removeEventListener('keyup', onKey, true)
  }
}
