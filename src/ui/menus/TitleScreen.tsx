import { useId, useState } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { MenuDialog } from './MenuDialog'
import { Settings } from './Settings'

/** Full game saves arrive in a later spec; until then this key is never written. */
const SAVE_KEY = 'last-rites-save'

function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null
  } catch {
    return false
  }
}

type Panel = 'none' | 'settings' | 'credits'

export function TitleScreen() {
  const titleId = useId()
  const creditsId = useId()
  const setScreen = useGameStore((s) => s.setScreen)
  const setPaused = useGameStore((s) => s.setPaused)
  const [panel, setPanel] = useState<Panel>('none')
  const saveExists = hasSave()

  function start() {
    setPaused(false)
    setScreen('game')
  }

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
        <button type="button" className="menu__button" onClick={start}>
          New Game
        </button>
        <button
          type="button"
          className="menu__button"
          aria-disabled={!saveExists}
          onClick={() => saveExists && start()}
        >
          Continue
        </button>
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
