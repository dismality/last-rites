// Drives the autumn ambience (design bible §15) from the phase each frame: the wind bed, crows by
// day and the All Souls bell at night. Rendering-free; timing rules are in systems/allHallows.ts.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { playAllSoulsBell, playCrow, setWindBed } from '../../audio/autumnAmbience'
import { AUTUMN_AMBIENCE } from '../../data/allHallows'
import { useWorldStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import { stormRuntime } from '../../game/state/stormRuntime'
import { createAmbienceClock, stepAmbience, windLevel } from '../../game/systems/allHallows'
import { isInterior } from '../../game/systems/interiorFog'
import { playerPositionRef } from '../world/playerPositionRef'

/** Indoors the wind is a muffled share of the bed outside. */
const INDOOR_WIND = 0.35
/** A storm pushes the wind up by this much. */
const STORM_WIND = 1.4
const MAX_DT_S = 0.1

export function AutumnAmbience() {
  const clock = useMemo(() => createAmbienceClock(Math.random), [])
  const t = useRef(0)

  useEffect(() => () => setWindBed(0, 0, true), [])

  useFrame((_, rawDelta) => {
    const frozen = isSimFrozen()
    const dt = Math.min(rawDelta, MAX_DT_S)
    const phase = useWorldStore.getState().phase
    const p = playerPositionRef.current
    const indoor = isInterior(p.x, p.z) ? INDOOR_WIND : 1
    const storm = stormRuntime.storm.active ? STORM_WIND : 1
    if (!frozen) t.current += dt
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * AUTUMN_AMBIENCE.windNoise.swellHz * t.current)
    setWindBed(windLevel(phase) * indoor * storm, swell, frozen)
    if (frozen) return
    for (const cue of stepAmbience(clock, dt, phase, Math.random)) {
      if (cue.kind === 'crow') playCrow(p.x, p.z, cue.angle, cue.distanceM)
      else playAllSoulsBell()
    }
  })

  return null
}
