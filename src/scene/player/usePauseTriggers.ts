import { useEffect } from 'react'
import { useGameStore } from '../../game/state'
import { isOverlayOpen } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { useWorldStore } from '../../game/state/worldStore'
import { escClosesOverlay } from '../../game/systems/journalPause'
import { endingPausable } from '../../game/state/endingStore'

/** True when an overlay that owns Esc (it closes itself on Esc) is open. */
function escOwnedByOverlay(): boolean {
  const { examining, journalOpen, mapOpen, satchelOpen } = useGameStore.getState()
  const { workbenchOpen, chapelRepairOpen } = useUiWorldStore.getState()
  return (
    examining ||
    journalOpen ||
    mapOpen ||
    satchelOpen ||
    workbenchOpen ||
    chapelRepairOpen ||
    useOverlayStore.getState().altarPanelOpen
  )
}

/**
 * Esc key path. The dawn picker, merchant, achievements and mode select do not own Esc, so
 * Esc always pauses over them. The journal and big map own Esc only while they pause the world
 * (by day); once the world runs, Esc pauses at once and the page stays open (Req 10.6).
 */
export function handlePauseKey(code: string): void {
  if (code !== 'Escape') return
  // On the ending screen only the epilogue card and the win walk-out pause; Esc skips the sequence.
  if (useGameStore.getState().screen === 'ending' && !endingPausable()) return
  const { examining, journalOpen, mapOpen, satchelOpen } = useGameStore.getState()
  const { workbenchOpen, chapelRepairOpen } = useUiWorldStore.getState()
  const readerOwns = escClosesOverlay(useWorldStore.getState().phase, journalOpen || mapOpen)
  const owned =
    examining ||
    satchelOpen ||
    workbenchOpen ||
    chapelRepairOpen ||
    useOverlayStore.getState().altarPanelOpen ||
    readerOwns
  if (!owned) useGameStore.getState().setPaused(true)
}

/** A lock lost this soon after an Esc that closed a screen belongs to that Esc, not to a pause. */
export const ESC_CLOSE_GRACE_MS = 1500

let escClosedAt = -Infinity

/** Esc closed a screen (a puzzle, the journal, an examine view) instead of pausing. */
export function noteEscClosed(now: number): void {
  escClosedAt = now
}

/** True while a lock loss should be read as part of the Esc that closed a screen. */
export function inEscCloseGrace(now: number): boolean {
  return now - escClosedAt < ESC_CLOSE_GRACE_MS
}

/**
 * Pointer-lock-loss path. An 08 overlay releases the cursor deliberately, so that loss is not a
 * pause request (Esc still is, via the key path). Nor is the loss that follows an Esc which
 * closed a puzzle or another screen: that Esc was spent on closing it.
 */
export function handlePointerLockLost(now = performance.now()): void {
  if (escOwnedByOverlay() || isOverlayOpen()) return
  if (inEscCloseGrace(now)) return
  // startEnding frees the cursor itself (the ending has buttons), and the lock-loss event lands
  // after the screen has switched. Pausing then froze the ending sequence's clock at 0.
  if (useGameStore.getState().screen !== 'game') return
  useGameStore.getState().setPaused(true)
}

/**
 * A lock change pauses only when a lock the canvas held is gone. A refused lock request can also
 * fire a change with no lock, and pausing on that undid Resume at once.
 */
export function lockChangeLosesLock(wasLocked: boolean, nowLocked: boolean): boolean {
  return wasLocked && !nowLocked
}

/**
 * Pauses on Esc and on pointer-lock loss. Browsers swallow Esc keydown while
 * locked and just release the lock, so both paths are needed.
 */
export function usePauseTriggers(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlePauseKey(e.code)
    // Capture phase, before any screen closes itself: if a screen is open, this Esc closes it.
    const onEscCapture = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      if (escOwnedByOverlay() || isOverlayOpen()) noteEscClosed(performance.now())
    }
    let locked = document.pointerLockElement !== null
    const onLockChange = () => {
      const now = document.pointerLockElement !== null
      const lost = lockChangeLosesLock(locked, now)
      locked = now
      if (lost) handlePointerLockLost()
    }
    window.addEventListener('keydown', onEscCapture, true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onEscCapture, true)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])
}
