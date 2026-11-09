import { useEffect, useId, useState } from 'react'
import { bootAudioOnce } from '../../audio/audioBoot'
import { canContinue } from '../../game/state/gameSave'
import { continueGame, newGame } from '../../game/state/runFlow'
import { MenuDialog } from './MenuDialog'
import { Settings } from './Settings'

type Panel = 'none' | 'settings' | 'credits'

export function TitleScreen() {
  const titleId = useId()
  const creditsId = useId()
  const [panel, setPanel] = useState<Panel>('none')
  // Re-read each render: a missing or corrupt save hides Continue (Req 7.3).
  const saveExists = canContinue()

  // The first click (or key press, for keyboard-only players) is the gesture that unlocks audio.
  useEffect(() => {
    const unlock = (): void => {
      bootAudioOnce()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  if (panel === 'settings') return <Settings onClose={() => setPanel('none')} />
  if (panel === 'credits') {
    return (
      <MenuDialog titleId={creditsId} onEscape={() => setPanel('none')}>
        <h2 id={creditsId} className="menu__title">
          Credits
        </h2>
        <p className="menu__text">
          Built with React, three.js, Rapier and Kiro. Every third-party model, font and sound is
          listed with its source and license in docs/CREDITS.md.
        </p>
        <div className="menu__actions">
          <button type="button" className="menu__button" onClick={() => setPanel('none')}>
            Back
          </button>
        </div>
      </MenuDialog>
    )
  }

  return (
    <MenuDialog titleId={titleId} variant="screen">
      <h1 id={titleId} className="menu__title menu__title--hero">
        Last Rites
      </h1>
      <p className="menu__text" style={{ textAlign: 'center', fontStyle: 'italic' }}>
        Hollowmere Cemetery, 1891
      </p>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={newGame}>
          New Game
        </button>
        {saveExists && (
          <button type="button" className="menu__button" onClick={continueGame}>
            Continue
          </button>
        )}
        <button type="button" className="menu__button" onClick={() => setPanel('settings')}>
          Settings
        </button>
        <button type="button" className="menu__button" onClick={() => setPanel('credits')}>
          Credits
        </button>
      </div>
    </MenuDialog>
  )
}
