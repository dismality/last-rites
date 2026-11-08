// Switches the game to an ending: clears the fight, locks in the ending and the stats,
// and hands the screen to the ending sequence. No React / three.js.

import { ENDING_MAP } from '../../data/endings'
import type { EndingId } from '../types'
import { useChapelStore } from './chapelStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { useMysteryStore } from './mysteryStore'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

export function startEnding(id: EndingId): void {
  useEndingStore.getState().beginEnding(id)
  useEnemyStore.getState().setEnemies([])
  useWaveStore.getState().reset()
  useChapelStore.getState().setFinalRiteActive(false)
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
