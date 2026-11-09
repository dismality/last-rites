// One answer to "is a menu or overlay holding the cursor?". Input, the controller and the
// interaction raycast all ask it, so a new overlay only needs adding here.
// Pure zustand reads: no React / three.js imports.
import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { useOverlayStore } from './overlayStore'
import { useUiWorldStore } from './uiWorldStore'

/**
 * Hook point for the dawn upgrade pick. progressionStore does not exist yet; when it lands it
 * registers `() => state.pickPending` here so this module needs no import of it.
 */
let dawnPickProbe: () => boolean = () => false
export function setDawnPickProbe(probe: () => boolean): void {
  dawnPickProbe = probe
}
export function isDawnPickPending(): boolean {
  return dawnPickProbe()
}

/** The world is stopped: pause, examine, journal or the intro cutscene. One check for every system. */
export function isSimFrozen(): boolean {
  const g = useGameStore.getState()
  return g.paused || g.examining || g.journalOpen || useIntroStore.getState().playing
}

/** An 08 overlay (merchant, achievements, mode select, dawn pick) has freed the cursor on purpose. */
export function isOverlayOpen(): boolean {
  const o = useOverlayStore.getState()
  return o.merchantOpen || o.achievementsOpen || o.modeSelectOpen || isDawnPickPending()
}

export function isMenuOpen(): boolean {
  const g = useGameStore.getState()
  if (isSimFrozen() || g.taken || g.satchelOpen) return true
  const ui = useUiWorldStore.getState()
  return ui.workbenchOpen || ui.chapelRepairOpen || isOverlayOpen()
}

/** Leave pause; re-lock the pointer only if no overlay still needs the cursor. */
export function resumeGame(requestPointerLock: () => void): void {
  useGameStore.getState().setPaused(false)
  if (!isOverlayOpen()) requestPointerLock()
}
