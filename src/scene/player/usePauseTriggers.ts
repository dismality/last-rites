import { useEffect } from 'react'
import { useGameStore } from '../../game/state'

/**
 * Pauses on Esc and on pointer-lock loss. Browsers swallow Esc keydown while
 * locked and just release the lock, so both paths are needed.
 * The full input module (task 6) builds on this.
 */
export function usePauseTriggers(): void {
  useEffect(() => {
    // Examine mode releases the pointer on purpose and owns Esc; don't pause over it.
    const pause = () => {
      // The satchel frees the cursor too, but it owns Esc and never pauses.
      const { examining, journalOpen, satchelOpen } = useGameStore.getState()
      if (!examining && !journalOpen && !satchelOpen) useGameStore.getState().setPaused(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') pause()
    }
    const onLockChange = () => {
      if (!document.pointerLockElement) pause()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])
}
