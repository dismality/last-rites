// One answer to "is a menu or overlay holding the cursor?". Input, the controller and the
// interaction raycast all ask it, so a new overlay only needs adding here.
// Pure zustand reads: no React / three.js imports.
import { getDevCheats } from './devCheats'
import { useGameStore } from './gameStore'
import { pausesSim } from '../systems/journalPause'
import { useIntroStore } from './introStore'
import { useOverlayStore } from './overlayStore'
import { useUiWorldStore } from './uiWorldStore'
import { useWorldStore } from './worldStore'

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

/**
 * The world is stopped: pause, examine, the intro cutscene, or the journal / big map by day.
 * At dusk, night and dawn those two leave the world running (spec 10, Req 10.2).
 * One check for every system.
 */
export function isSimFrozen(): boolean {
  const g = useGameStore.getState()
  const phase = useWorldStore.getState().phase
  return (
    g.paused ||
    g.examining ||
    pausesSim(phase, g.journalOpen) ||
    pausesSim(phase, g.mapOpen) ||
    useIntroStore.getState().playing
  )
}

/** Camera hand-off flags owned by scene code (kept as arguments so this module stays scene-free). */
export interface CameraFlags {
  ending?: boolean
  intro?: boolean
}

function cinematicOf(screen: string, introPlaying: boolean, cam?: CameraFlags): boolean {
  return introPlaying || screen === 'ending' || cam?.ending === true || cam?.intro === true
}

/**
 * A scripted camera shot (intro cutscene or an ending) is showing. Every interactable cue
 * (rune, pulse, outline, hand crosshair, prompt, craftable glow) must be hidden then, so any
 * new cue component asks this one predicate.
 */
export function cinematicActive(cam?: CameraFlags): boolean {
  return cinematicOf(useGameStore.getState().screen, useIntroStore.getState().playing, cam)
}

/** Reactive form for HUD components; the camera flags are covered by the store flags they follow. */
export function useCinematic(): boolean {
  const screen = useGameStore((s) => s.screen)
  const playing = useIntroStore((s) => s.playing)
  return cinematicOf(screen, playing)
}

/**
 * An overlay has freed the cursor on purpose: an 08 overlay (merchant, achievements, mode select,
 * dawn pick) or the Dev_Panel (its flag is always false outside dev mode).
 */
export function isOverlayOpen(): boolean {
  const o = useOverlayStore.getState()
  return (
    o.merchantOpen ||
    o.achievementsOpen ||
    o.modeSelectOpen ||
    o.altarPanelOpen ||
    isDawnPickPending() ||
    getDevCheats().panelOpen
  )
}

export function isMenuOpen(): boolean {
  const g = useGameStore.getState()
  // The journal and big map hold the cursor and block scares even when the night keeps running.
  if (isSimFrozen() || g.journalOpen || g.mapOpen || g.taken || g.satchelOpen) return true
  const ui = useUiWorldStore.getState()
  return ui.workbenchOpen || ui.chapelRepairOpen || isOverlayOpen()
}

/** Leave pause; re-lock the pointer only if no overlay still needs the cursor. */
export function resumeGame(requestPointerLock: () => void): void {
  useGameStore.getState().setPaused(false)
  if (!isOverlayOpen()) requestPointerLock()
}
