// Entry points into a run from the title and ending screens. Kept out of the React
// components so the intro rule (New Game plays it, Continue never does) is testable in Node.

import { useCraftingStore } from './craftingStore'
import { useGameStore } from './gameStore'
import { loadGame } from './gameSave'
import { useIntroStore } from './introStore'
import { resetRun } from './resetRun'

function start(): void {
  const game = useGameStore.getState()
  game.setPaused(false)
  // Starting recipes (bone club, bandage, candle, refill). Without this the recipe book
  // shows only locked entries.
  useCraftingStore.getState().applyUnlockEvent({ type: 'gameStart' })
  game.setScreen('game')
}

/** Fresh run. Always plays the intro, even if a previous run had already seen it. */
export function newGame(): void {
  resetRun()
  useIntroStore.getState().begin()
  start()
}

/** Resumes a save. Never begins the intro. Returns false if there was nothing to load. */
export function continueGame(): boolean {
  // Load first so the saved unlocks are in place before the starting recipes merge in.
  if (!loadGame()) return false
  start()
  return true
}
