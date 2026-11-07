// Journal map overlay. The Journal key (default J) toggles it; Esc closes it.
// Opening freezes the simulation (gameStore.journalOpen) so nothing scares the
// player while they read, and the pause menu stays out of the way.
import { useEffect, useRef } from 'react'
import { useGameStore, useMapStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { JournalMap } from './Map'
import './journal.css'

export function MapOverlay() {
  const open = useGameStore((s) => s.journalOpen)
  const screen = useGameStore((s) => s.screen)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (screen !== 'game') return
    const onKey = (e: KeyboardEvent) => {
      const gs = useGameStore.getState()
      if (e.code === useSettingsStore.getState().bindings.Journal && !e.repeat) {
        if (gs.paused || gs.examining) return
        e.preventDefault()
        if (gs.journalOpen) gs.setJournalOpen(false)
        else {
          // Ink the cell the player is standing in even if they haven't moved yet.
          useMapStore.getState().reveal(usePlayerStore.getState().position)
          gs.setJournalOpen(true)
        }
      } else if (e.code === 'Escape' && gs.journalOpen) {
        // Capture phase so the pause trigger never sees it.
        e.preventDefault()
        e.stopPropagation()
        gs.setJournalOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [screen])

  useEffect(() => {
    if (!open) return
    if (document.pointerLockElement) document.exitPointerLock()
    closeRef.current?.focus()
  }, [open])

  if (!open || screen !== 'game') return null
  return (
    <div className="journal" role="dialog" aria-modal="true" aria-label="Journal map">
      <div className="journal__page">
        <h2 className="journal__title">Hollowmere, as I have walked it</h2>
        <JournalMap />
        <button
          ref={closeRef}
          type="button"
          className="journal__close"
          onClick={() => useGameStore.getState().setJournalOpen(false)}
        >
          Close journal (J)
        </button>
      </div>
    </div>
  )
}
