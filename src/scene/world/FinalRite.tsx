// FinalRite: watches the rite on the last stage's night (spec 10 task 4.5). The 45 s hold is gone;
// relics are placed at the altar (RitePanel). Father Crane may fall after the last relic is laid,
// so each frame asks the rite store whether it can finish now. The rules are in game/systems/rite.ts.
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../../game/state'
import { useRiteStore } from '../../game/state/riteStore'

export function FinalRite() {
  useFrame(() => {
    const gs = useGameStore.getState()
    if (gs.screen !== 'game' || gs.taken) return
    useRiteStore.getState().tryComplete()
  })

  return null
}
