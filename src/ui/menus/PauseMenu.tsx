import { useId, useState } from 'react'
import { requestLock } from '../../scene/player/input'
import { useGameStore } from '../../game/state/gameStore'
import { resumeGame } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { closeAchievements, openAchievements } from '../../game/state/runFlow'
import { AchievementsMenu } from './AchievementsMenu'
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
  const achievementsOpen = useOverlayStore((s) => s.achievementsOpen)

  if (!paused || screen !== 'game') return null
  if (achievementsOpen) return <AchievementsMenu onClose={closeAchievements} />

  function resume() {
    // Deferred: the window-level Esc listener in usePauseTriggers runs after this
    // handler and would otherwise immediately re-pause.
    setTimeout(() => {
      resumeGame(() => requestLock(document.querySelector('canvas')))
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
            <button type="button" className="menu__button" onClick={openAchievements}>
              Achievements
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
