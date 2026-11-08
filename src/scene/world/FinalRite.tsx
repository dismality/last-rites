// FinalRite: drives the night-5 rite. Hold Interact at the altar for 45 s while the dead
// attack; releasing pauses progress (Req 5.3). Rules live in game/systems/finalRite.ts.
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import {
  useChapelStore,
  useEnemyStore,
  useGameStore,
  useMysteryStore,
  useWaveStore,
} from '../../game/state'
import { useEndingStore } from '../../game/state/endingStore'
import { isMenuOpen } from '../../game/state/menuState'
import { readRiteStatus } from '../../game/state/riteStatus'
import { startEnding } from '../../game/state/startEnding'
import { isHoldingRite, RITE_ALTAR_RANGE, stepRite } from '../../game/systems/finalRite'
import { startRiteAssault } from '../../game/systems/waves'
import { input } from '../player/input'
import { playerPositionRef } from './playerPositionRef'

const MAX_DT = 0.1
/** Matches the altar trigger in Chapel.tsx (+Z apse end). */
const ALTAR_POS = new Vector3(CHAPEL_CENTER[0], CHAPEL_CENTER[1], CHAPEL_CENTER[2] + 4.5)

export function FinalRite() {
  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.screen !== 'game' || gs.taken || gs.examining) return
    const status = readRiteStatus()
    if (status.availability === 'unavailable') return

    // Night 5 is over and the satchel is short of relics (Req 5.5).
    if (status.availability === 'taken') {
      startEnding('taken')
      return
    }

    const holding = isHoldingRite({
      availability: status.availability,
      nearAltar: playerPositionRef.current.distanceTo(ALTAR_POS) <= RITE_ALTAR_RANGE,
      interactHeld: input.peek().interact,
      blocked: isMenuOpen(),
    })
    if (!holding) return

    const ending = useEndingStore.getState()
    if (!ending.riteStarted) {
      ending.setRiteStarted(true)
      // The door no longer holds during the rite (Req 6.4 of the chapel spec).
      useChapelStore.getState().setFinalRiteActive(true)
      // If the waves were already cleared, one more rises so the rite is always under attack.
      const wavePhase = useWaveStore.getState().waves.phase
      if (wavePhase === 'done' || wavePhase === 'idle') {
        useWaveStore.getState().setWaves(startRiteAssault())
        ending.setNightFiveCleared(false)
      }
    }

    const step = stepRite(
      useMysteryStore.getState().mystery,
      Math.min(rawDelta, MAX_DT),
      true,
      status.relicCount,
    )
    useMysteryStore.setState({ mystery: step.mystery })
    if (step.completed && step.mystery.ending) {
      useEnemyStore.getState().setEnemies([])
      startEnding(step.mystery.ending)
    }
  })

  return null
}
