// The grab kill-cam's red edge (spec 10 task 8, Req 25.5-25.6): it pulses, or holds steady when
// Flashing lights is off. The words "[something seizes you]" are the subtitle, so colour is never
// the only cue.

import { useEffect, useRef, useState } from 'react'
import { useKillCamStore } from '../../game/state/killCamStore'
import { simClock } from '../../game/state/simClock'
import { edgeOpacity } from '../../game/systems/killCam'

export function GrabEdge() {
  const edge = useKillCamStore((s) => s.edge)
  const [opacity, setOpacity] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (edge === null) return
    const step = () => {
      const o = edgeOpacity(simClock.now - edge.startS, edge.kind)
      setOpacity(Math.round(o * 100) / 100)
      if (o > 0) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [edge])

  if (edge === null || opacity <= 0) return null
  return <div className="hud-grab-edge" data-testid="grab-edge" data-edge={edge.kind} style={{ opacity }} />
}
