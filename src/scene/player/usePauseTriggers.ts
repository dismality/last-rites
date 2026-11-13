import { useEffect } from 'react'
import { useGameStore } from '../../game/state'
import { isOverlayOpen } from '../../game/state/menuState'
import { useUiWorldStore } from '../../game/state/uiWorldStore'

/** True when an overlay that owns Esc (it closes itself on Esc) is open. */
function escOwnedByOverlay(): boolean {
  const { examining, journalOpen, mapOpen, satchelOpen } = useGameStore.getState()
  const { workbenchOpen, chapelRepairOpen } = useUiWorldStore.getState()
  return examining || journalOpen || mapOpen || satchelOpen || workbenchOpen || chapelRepairOpen
}

/**
 * Esc key path. The dawn picker, merchant, achievements and mode select do not own Esc, so
 * Esc always pauses over them.
 */
export function handlePauseKey(code: string): void {
  if (code === 'Escape' && !escOwnedByOverlay()) useGameStore.getState().setPaused(true)
}

/**
 * Pointer-lock-loss path. An 08 overlay releases the cursor deliberately, so that loss is not a
 * pause request (Esc still is, via the key path).
 */
export function handlePointerLockLost(): void {
  if (escOwnedByOverlay() || isOverlayOpen()) return
  useGameStore.getState().setPaused(true)
}

/**
 * Pauses on Esc and on pointer-lock loss. Browsers swallow Esc keydown while
 * locked and just release the lock, so both paths are needed.
 */
export function usePauseTriggers(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlePauseKey(e.code)
    const onLockChange = () => {
      if (!document.pointerLockElement) handlePointerLockLost()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])
}
