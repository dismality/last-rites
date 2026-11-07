import { useId, useState } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { MenuDialog } from './MenuDialog'
import { Settings } from './Settings'

/**
 * Overlays the Game screen while `paused`. Esc and pointer-lock loss set
 * `paused` (usePauseTriggers); this menu only reads it and offers Resume.
 */
export function PauseMenu() {
  const titleId = useId()
  const paused = useGameStore((s) => s.paused)
  const screen = useGameStore((s) => s.screen)
  const setPaused = useGameStore((s) => s.setPaused)
  const setScreen = useGameStore((s) => s.setScreen)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!paused || screen !== 'game') return null

  function resume() {
    // Deferred: the window-level Esc listener in usePauseTriggers runs after this
    // handler and would otherwise immediately re-pause.
    setTimeout(() => {
      setPaused(false)
      document.querySelector('canvas')?.requestPointerLock?.()
    }, 0)
  }

  function quit() {
    setPaused(false)
    setScreen('title')
  }

  return (
    <MenuDialog titleId={titleId} onEscape={settingsOpen ? () => setSettingsOpen(false) : resume}>
      {settingsOpen ? (
        <Settings inline titleId={titleId} onClose={() => setSettingsOpen(false)} />
      ) : (
        <>
          <h2 id={titleId} className="menu__title">
            Paused
          </h2>
          <div className="menu__actions">
            <button type="button" className="menu__button" onClick={resume}>
              Resume
            </button>
            <button type="button" className="menu__button" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button type="button" className="menu__button" onClick={quit}>
              Quit to Title
            </button>
          </div>
        </>
      )}
    </MenuDialog>
  )
}
