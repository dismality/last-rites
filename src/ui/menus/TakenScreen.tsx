import { useId } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { retryNight } from '../../game/state/retryNight'
import { requestLock } from '../../scene/player/input'
import { MenuDialog } from './MenuDialog'

/**
 * Death screen. No Escape handler: the player must choose Retry Night or Quit,
 * so a stray key press cannot dismiss it. MenuDialog gives the focus trap.
 */
export function TakenScreen() {
  const titleId = useId()
  const taken = useGameStore((s) => s.taken)
  const screen = useGameStore((s) => s.screen)
  const setScreen = useGameStore((s) => s.setScreen)
  const setTaken = useGameStore((s) => s.setTaken)

  if (!taken || screen !== 'game') return null

  function retry() {
    retryNight()
    requestLock(document.querySelector('canvas'))
  }

  function quit() {
    setTaken(false)
    setScreen('title')
  }

  return (
    <MenuDialog titleId={titleId}>
      <h2 id={titleId} className="menu__title">
        You were taken
      </h2>
      <p className="menu__text">The dead have added your name to the ledger. Begin the dusk again?</p>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={retry}>
          Retry Night
        </button>
        <button type="button" className="menu__button" onClick={quit}>
          Quit to Title
        </button>
      </div>
    </MenuDialog>
  )
}
