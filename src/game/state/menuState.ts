// One answer to "is a menu or overlay holding the cursor?". Input, the controller and the
// interaction raycast all ask it, so a new overlay only needs adding here.
// Pure zustand reads: no React / three.js imports.

import { useGameStore } from './gameStore'
import { useUiWorldStore } from './uiWorldStore'

export function isMenuOpen(): boolean {
  const g = useGameStore.getState()
  if (g.paused || g.taken || g.examining || g.journalOpen || g.satchelOpen) return true
  const ui = useUiWorldStore.getState()
  return ui.workbenchOpen || ui.chapelRepairOpen
}
