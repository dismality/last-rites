// Backquote toggles the Dev_Panel. Takes the event target as a parameter so it runs in Node tests.

import { useDevPanelStore } from './devPanelStore'

export const DEV_TOGGLE_CODE = 'Backquote'

/** Typing a backquote into a panel field must not close the panel. */
function isTextField(target: unknown): boolean {
  const tag = (target as { tagName?: string } | null)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Listens for the toggle key. Does nothing unless the panel store is enabled (the store itself
 * refuses to open otherwise). Returns the remover.
 */
export function installDevKeys(target: EventTarget): () => void {
  const onKeyDown = (e: Event) => {
    const key = e as KeyboardEvent
    if (key.code !== DEV_TOGGLE_CODE || isTextField(key.target)) return
    key.preventDefault?.()
    useDevPanelStore.getState().toggle()
  }
  target.addEventListener('keydown', onKeyDown)
  return () => target.removeEventListener('keydown', onKeyDown)
}
