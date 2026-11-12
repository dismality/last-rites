// The one place that frees the mouse when a screen needs it and takes it back afterwards.
// Every menu and overlay already counts in isMenuOpen() (menuState.ts), so a new screen only
// needs adding there; none of them call exitPointerLock themselves.
import { useEffect } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { isMenuOpen } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { requestLock } from './input'

/** A close this soon after a click or key press still counts as part of that gesture. */
export const GESTURE_WINDOW_MS = 1000

/** Anything that needs the cursor. The tombstone rubbing counts too: it sets `examining`. */
export function cursorWanted(): boolean {
  return isMenuOpen()
}

export type CursorAction = 'release' | 'relock-now' | 'relock-on-gesture' | 'none'

export interface CursorStep {
  wanted: boolean
  wasWanted: boolean
  inGame: boolean
  /** ms since the last click or key press */
  sinceGestureMs: number
}

/** Pure decision: what to do when the "cursor wanted" answer may have changed. */
export function cursorAction(s: CursorStep): CursorAction {
  if (s.wanted && !s.wasWanted) return 'release'
  if (!s.wanted && s.wasWanted && s.inGame) {
    // The browser refuses a lock request outside a user gesture, so wait for the next one.
    return s.sinceGestureMs <= GESTURE_WINDOW_MS ? 'relock-now' : 'relock-on-gesture'
  }
  return 'none'
}

const canvasEl = (): HTMLElement | null => document.querySelector('canvas')

/** Mount once, in the game tick driver. */
export function useCursorRelease(): void {
  useEffect(() => {
    let wasWanted = cursorWanted()
    let pendingRelock = false
    let lastGesture = -Infinity

    const relock = () => {
      pendingRelock = false
      if (document.pointerLockElement || cursorWanted()) return
      if (useGameStore.getState().screen !== 'game') return
      requestLock(canvasEl())
    }

    const onGesture = () => {
      lastGesture = performance.now()
      if (pendingRelock) relock()
    }

    const check = () => {
      const wanted = cursorWanted()
      const action = cursorAction({
        wanted,
        wasWanted,
        inGame: useGameStore.getState().screen === 'game',
        sinceGestureMs: performance.now() - lastGesture,
      })
      wasWanted = wanted
      if (action === 'release') {
        pendingRelock = false
        if (document.pointerLockElement) document.exitPointerLock()
      } else if (action === 'relock-now') relock()
      else if (action === 'relock-on-gesture') pendingRelock = true
    }

    const unsubs = [
      useGameStore.subscribe(check),
      useUiWorldStore.subscribe(check),
      useOverlayStore.subscribe(check),
      useProgressionStore.subscribe(check),
    ]
    // Capture phase, so a handler that stops propagation still counts as a gesture.
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    window.addEventListener('keyup', onGesture, true)
    check()
    return () => {
      unsubs.forEach((u) => u())
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      window.removeEventListener('keyup', onGesture, true)
    }
  }, [])
}
