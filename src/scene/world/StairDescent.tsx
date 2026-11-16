// Walking down the chapel stair to the catacombs (spec 09 task 11n-f). Once the whistle has
// opened the stair, going about three steps down fades the screen to black, puts the player in the
// catacomb corridor just past its gate, and fades back in. Input is held only while the screen is
// black. Zone, music and guidance follow the player's position, so nothing else is fired here.
// Rules and numbers: systems/stairDescent.ts. Mount inside <GameLoop>.

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { playStairFootsteps } from '../../audio/AudioManager'
import { emit } from '../../game/events'
import { useDescentStore } from '../../game/state/descentStore'
import { isMenuOpen } from '../../game/state/menuState'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { queueTeleport } from '../../game/state/playerTeleport'
import { DESCENT_ARRIVAL, descentFrame, inDescentTrigger } from '../../game/systems/stairDescent'
import { playerPositionRef } from './playerPositionRef'

const CAPTION = '[footsteps descend into the dark]'
const CAPTION_S = 3
/** A frame hitch must not skip the fade. */
const MAX_DT = 0.1

export function StairDescent() {
  const t = useRef<number | null>(null)
  const moved = useRef(false)

  // Leaving the game mid-descent must not leave the screen black or input held.
  useEffect(() => () => useDescentStore.getState().set(0, false), [])

  useFrame((_, rawDt) => {
    const ui = useDescentStore.getState()
    if (t.current === null) {
      if (!useMysteryStore.getState().mystery.gates.catacombs || isMenuOpen()) return
      const p = playerPositionRef.current
      if (!inDescentTrigger([p.x, p.y, p.z])) return
      t.current = 0
      moved.current = false
      playStairFootsteps()
      emit({ type: 'subtitleShown', text: CAPTION, duration: CAPTION_S })
    } else {
      t.current += Math.min(rawDt, MAX_DT)
    }
    const f = descentFrame(t.current)
    if (f.moved && !moved.current) {
      moved.current = true
      // The store follows the body, as teleportTo in the dev panel does, so nothing reads the old spot.
      const player = usePlayerStore.getState()
      player.setPosition([...DESCENT_ARRIVAL.position])
      player.setYaw(DESCENT_ARRIVAL.yaw)
      player.setPitch(0)
      queueTeleport({ position: [...DESCENT_ARRIVAL.position], yaw: DESCENT_ARRIVAL.yaw, pitch: 0 })
    }
    if (f.done) {
      t.current = null
      ui.set(0, false)
    } else if (ui.opacity !== f.opacity || ui.locked !== f.black) {
      ui.set(f.opacity, f.black)
    }
  })

  return null
}
