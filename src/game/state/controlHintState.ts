// Glue between the stores and the pure controls-hint rules. Called from GameLoop once per
// fixed step; the HUD panel only reads guidanceStore.

import { actionsForCode, advanceHints, freshHintProgress, markHintUsed, markPressed } from '../systems/controlHints'
import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { useGuidanceStore } from './guidanceStore'
import { usePlayerStore } from './playerStore'
import { useSettingsStore } from './settingsStore'

/** One fixed step: tallies distance moved and time sprinted, and clears lines that are done. */
export function tickControlHints(dt: number, sprinting: boolean): void {
  const [x, , z] = usePlayerStore.getState().position
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(dt)) return
  const g = useGuidanceStore.getState()
  const moved = g.hintLast === null ? 0 : Math.hypot(x - g.hintLast[0], z - g.hintLast[1])
  const next = advanceHints(g.hintProgress, g.hintsUsed, { moved, dt, sprinting })
  g.setHints({
    hintLast: [x, z],
    hintProgress: next.progress,
    ...(next.used !== g.hintsUsed ? { hintsUsed: next.used } : {}),
  })
}

/** A charged heavy swing was released: the charge line has done its job. */
export function markChargeUsed(): void {
  const g = useGuidanceStore.getState()
  const used = markHintUsed(g.hintsUsed, 'charge')
  if (used !== g.hintsUsed) g.setHints({ hintsUsed: used })
}

/** Only presses made while playing count (not on the title, in the intro or in an ending). */
const playing = (): boolean => useGameStore.getState().screen === 'game' && !useIntroStore.getState().playing

/** A key or mouse button went down: every line waiting for a bound action of that code clears. */
export function noteHintPress(code: string): void {
  if (!playing()) return
  const g = useGuidanceStore.getState()
  let used = g.hintsUsed
  for (const action of actionsForCode(useSettingsStore.getState().bindings, code)) used = markPressed(used, action)
  if (used !== g.hintsUsed) g.setHints({ hintsUsed: used })
}

/** The mouse turned the view by this many screen pixels. */
export function noteHintLook(pixels: number): void {
  if (!playing()) return
  const g = useGuidanceStore.getState()
  const next = advanceHints(g.hintProgress, g.hintsUsed, { moved: 0, dt: 0, sprinting: false, looked: pixels })
  g.setHints({ hintProgress: next.progress, ...(next.used !== g.hintsUsed ? { hintsUsed: next.used } : {}) })
}

const MOUSE_CODES = ['MouseLeft', 'MouseMiddle', 'MouseRight'] as const

/**
 * Turning "Show control hints" back on shows every line again, and real key presses, mouse
 * buttons and mouse turns clear the tutorial lines. Returns the unsubscribe.
 */
export function installControlHintWatchers(): () => void {
  const unsub = useSettingsStore.subscribe((s, prev) => {
    if (s.showControlHints && !prev.showControlHints) {
      useGuidanceStore.getState().setHints({ hintsUsed: new Set(), hintProgress: freshHintProgress() })
    }
  })
  if (typeof window === 'undefined') return unsub
  const onKey = (e: KeyboardEvent) => {
    if (!e.repeat) noteHintPress(e.code)
  }
  const onMouse = (e: MouseEvent) => {
    const code = MOUSE_CODES[e.button]
    if (code) noteHintPress(code)
  }
  const onMove = (e: MouseEvent) => {
    // Only a captured mouse turns the view; a free cursor over the menus does not.
    if (document.pointerLockElement) noteHintLook(Math.abs(e.movementX) + Math.abs(e.movementY))
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousedown', onMouse)
  window.addEventListener('mousemove', onMove)
  return () => {
    unsub()
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('mousedown', onMouse)
    window.removeEventListener('mousemove', onMove)
  }
}
