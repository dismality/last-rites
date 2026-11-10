// Entry points into a run from the title and ending screens. Kept out of the React
// components so the intro rule (New Game plays it, Continue never does) is testable in Node.

import { useCraftingStore } from './craftingStore'
import { useGameStore } from './gameStore'
import { loadGame } from './gameSave'
import { useIntroStore } from './introStore'
import { resetRun } from './resetRun'
import { useOverlayStore } from './overlayStore'
import { startRun } from './progressionActions'
import { clearMorningSnapshot, saveMorningSnapshot } from './retryNight'
import { useWorldStore } from './worldStore'
import { MODES } from '../../data/modes'
import type { ModeId } from '../types'

function start(): void {
  const game = useGameStore.getState()
  game.setPaused(false)
  // Starting recipes (bone club, bandage, candle, refill). Without this the recipe book
  // shows only locked entries.
  useCraftingStore.getState().applyUnlockEvent({ type: 'gameStart' })
  // Day 1 has no phase change into day, so its morning is captured here. A run that resumes
  // at dusk or night has no morning to go back to, and an older run's snapshot must not leak in.
  if (useWorldStore.getState().phase === 'day') saveMorningSnapshot()
  else clearMorningSnapshot()
  game.setScreen('game')
}

/** Fresh run. Always plays the intro, even if a previous run had already seen it. */
export function newGame(): void {
  resetRun()
  useIntroStore.getState().begin()
  start()
}

/** New Game button: opens the mode select instead of starting at once. */
export function openModeSelect(): void {
  useOverlayStore.getState().setModeSelectOpen(true)
}

export function closeModeSelect(): void {
  useOverlayStore.getState().setModeSelectOpen(false)
}

/** Mode chosen: startRun resets and seeds the run; story modes then play the intro, Endless skips it. */
export function beginMode(mode: ModeId): void {
  startRun(mode)
  closeModeSelect()
  if (MODES[mode].story) useIntroStore.getState().begin()
  start()
}

export function openAchievements(): void {
  useOverlayStore.getState().setAchievementsOpen(true)
}

export function closeAchievements(): void {
  useOverlayStore.getState().setAchievementsOpen(false)
}

/** Resumes a save. Never begins the intro. Returns false if there was nothing to load. */
export function continueGame(): boolean {
  // Load first so the saved unlocks are in place before the starting recipes merge in.
  if (!loadGame()) return false
  start()
  return true
}
