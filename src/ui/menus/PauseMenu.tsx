import { useId, useState } from 'react'
import { requestLock } from '../../scene/player/input'
import { useGameStore } from '../../game/state/gameStore'
import { endingPausable, useEndingStore } from '../../game/state/endingStore'
import { resumeGame } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { closeAchievements, openAchievements } from '../../game/state/runFlow'
import { AchievementsMenu } from './AchievementsMenu'
import { MenuDialog } from './MenuDialog'
import { QuitConfirm } from './QuitConfirm'
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
  const [confirming, setConfirming] = useState(false)
  const achievementsOpen = useOverlayStore((s) => s.achievementsOpen)
  // Re-render when the ending moves on, so the pause check above sees the new stage.
  useEndingStore((s) => s.stage)

  // The ending screen pauses over the epilogue card and the win walk-out (Req 23.4).
  if (!paused || (screen !== 'game' && !(screen === 'ending' && endingPausable()))) return null
  if (achievementsOpen) return <AchievementsMenu onClose={closeAchievements} />

  function resume() {
    // Deferred: the window-level Esc listener in usePauseTriggers runs after this
    // handler and would otherwise immediately re-pause.
    setTimeout(() => {
      // The ending screen has buttons and no first-person view, so the cursor stays free there.
      if (useGameStore.getState().screen === 'ending') useGameStore.getState().setPaused(false)
      else resumeGame(() => requestLock(document.querySelector('canvas')))
    }, 0)
  }

  function quit() {
    setConfirming(false)
    setPaused(false)
    setScreen('title')
  }

  return (
    <MenuDialog
      titleId={titleId}
      onEscape={confirming ? () => setConfirming(false) : settingsOpen ? () => setSettingsOpen(false) : resume}
    >
      {confirming ? (
        <QuitConfirm
          titleId={titleId}
          detail="Progress since your last save is lost. Continue on the title screen resumes the latest dawn, dusk or altar save."
          onConfirm={quit}
          onCancel={() => setConfirming(false)}
        />
      ) : settingsOpen ? (
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
            <button type="button" className="menu__button" onClick={() => setConfirming(true)}>
              Quit to Title
            </button>
          </div>
        </>
      )}
    </MenuDialog>
  )
}
