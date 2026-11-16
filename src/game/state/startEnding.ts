// Switches the game to an ending: clears the fight, locks in the ending and the stats,
// and hands the screen to the ending sequence. No React / three.js.

import { ENDING_MAP } from '../../data/endings'
import type { EndingId } from '../types'
import { epilogueLines } from '../systems/accusation'
import { useAccusationStore } from './accusationStore'
import { useEndingStore } from './endingStore'
import { settleEndless } from './endlessBest'
import { useGameStore } from './gameStore'
import { useMysteryStore } from './mysteryStore'
import { clearNightState } from './nightState'
import { useProgressionStore } from './progressionStore'
import { useWorldStore } from './worldStore'

/**
 * Endless has no ending screen: death ends the run, so the best is settled here. settleEndless
 * keeps only the first call per run id, which makes a repeated death a no-op.
 */
export function settleEndlessDeath(): void {
  const p = useProgressionStore.getState()
  if (p.mode === 'endless') settleEndless(p.score)
}

export function startEnding(id: EndingId): void {
  // A right accusation adds the Justice for Elias epilogue before the walk-out (Req 18.3); only a won run has one.
  const epilogue = id === 'rest' && epilogueLines(useAccusationStore.getState().record).length > 0
  useEndingStore.getState().beginEnding(id, epilogue)
  clearNightState()
  settleEndlessDeath()
  useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, ending: id } }))
  // The sky blend follows the phase, so dawn endings break into morning.
  if (ENDING_MAP[id].sky === 'dawn') {
    useWorldStore.getState().applyWorldState({ phase: 'dawn', phaseTime: 0, wavesCleared: true })
  }
  const g = useGameStore.getState()
  g.setPaused(false)
  g.setScreen('ending')
  // The ending screen has buttons, so the cursor has to come back.
  if (typeof document !== 'undefined') document.exitPointerLock?.()
}
