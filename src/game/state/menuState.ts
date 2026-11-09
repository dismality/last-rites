// One answer to "is a menu or overlay holding the cursor?". Input, the controller and the
// interaction raycast all ask it, so a new overlay only needs adding here.
// Pure zustand reads: no React / three.js imports.

import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { useUiWorldStore } from './uiWorldStore'

/** The world is stopped: pause, examine, journal or the intro cutscene. One check for every system. */
export function isSimFrozen(): boolean {
  const g = useGameStore.getState()
  return g.paused || g.examining || g.journalOpen || useIntroStore.getState().playing
}

export function isMenuOpen(): boolean {
  const g = useGameStore.getState()
  if (isSimFrozen() || g.taken || g.satchelOpen) return true
  const ui = useUiWorldStore.getState()
  return ui.workbenchOpen || ui.chapelRepairOpen
}
