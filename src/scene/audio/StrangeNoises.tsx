// Drives the strange distant noises from the phase each frame (rules: systems/strangeNoises.ts).
// Atmosphere only; menus and pause stop the clock. Rendering-free.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { playStrangeNoise } from '../../audio/strangeNoises'
import { useSettingsStore, useWorldStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import { createStrangeClock, stepStrangeNoises } from '../../game/systems/strangeNoises'
import { playerPositionRef } from '../world/playerPositionRef'

const MAX_DT_S = 0.1

export function StrangeNoises() {
  const clock = useRef(createStrangeClock())

  useFrame((_, rawDelta) => {
    if (isSimFrozen()) return
    const phase = useWorldStore.getState().phase
    const enabled = useSettingsStore.getState().strangeVolume > 0
    const r = stepStrangeNoises(clock.current, Math.min(rawDelta, MAX_DT_S), phase, enabled, Math.random)
    clock.current = r.clock
    if (!r.cue) return
    const p = playerPositionRef.current
    playStrangeNoise(r.cue.noise, p.x, p.z, r.cue.angle, r.cue.distanceM)
  })

  return null
}
