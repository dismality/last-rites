import { useId, useState } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { useCraftingStore } from '../../game/state/craftingStore'
import { canContinue, loadGame } from '../../game/state/gameSave'
import { MenuDialog } from './MenuDialog'
import { Settings } from './Settings'

type Panel = 'none' | 'settings' | 'credits'

export function TitleScreen() {
  const titleId = useId()
  const creditsId = useId()
  const setScreen = useGameStore((s) => s.setScreen)
  const setPaused = useGameStore((s) => s.setPaused)
  const [panel, setPanel] = useState<Panel>('none')
  // Re-read each render: a missing or corrupt save hides Continue (Req 7.3).
  const saveExists = canContinue()

  function start() {
    setPaused(false)
    // Starting recipes (bone club, bandage, candle, refill). Without this the recipe book
    // shows only locked entries.
    useCraftingStore.getState().applyUnlockEvent({ type: 'gameStart' })
    setScreen('game')
  }

  function continueGame() {
    // Load first so the saved unlocks are in place before the starting recipes merge in.
    if (loadGame()) start()
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
