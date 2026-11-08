// EndingCamera: flies the camera along the ending's Catmull-Rom paths (Req 6.1).
// Timeline maths is in game/systems/endingSequence.ts; this only turns it into a pose.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Vector3 } from 'three'
import { ENDING_MAP, type EndingDef } from '../../data/endings'
import { useEndingStore } from '../../game/state/endingStore'
import { useGameStore, useSettingsStore } from '../../game/state'
import { cameraProgress, isSequenceDone } from '../../game/systems/endingSequence'
import { endingCameraRuntime } from './endingCameraRuntime'

const MAX_DT = 0.1

function toCurve(points: EndingDef['camera']['position']): CatmullRomCurve3 {
  return new CatmullRomCurve3(points.map((p) => new Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.5)
}

export function EndingCamera() {
  const screen = useGameStore((s) => s.screen)
  const ending = useEndingStore((s) => s.ending)
  const def = screen === 'ending' && ending ? ENDING_MAP[ending] : null

  const curves = useMemo(
    () => (def ? { position: toCurve(def.camera.position), target: toCurve(def.camera.target) } : null),
    [def],
  )
  const pos = useRef(new Vector3())
  const look = useRef(new Vector3())

  // Each ending starts from zero and hands the camera back when it leaves.
  useEffect(() => {
    endingCameraRuntime.time = 0
    endingCameraRuntime.active = def !== null
    return () => {
      endingCameraRuntime.active = false
    }
  }, [def])

  useFrame((state, rawDelta) => {
    if (!def || !curves) return
    const rt = endingCameraRuntime
    const store = useEndingStore.getState()
    // After Skip (or the end) the camera holds its last pose behind the summary card.
    if (store.stage === 'sequence') {
      rt.time += Math.min(rawDelta, MAX_DT)
      if (isSequenceDone(def, rt.time)) store.showSummary()
    } else {
      rt.time = def.duration
    }

    const u = cameraProgress(def, rt.time)
    curves.position.getPoint(u, pos.current)
    curves.target.getPoint(u, look.current)

    // Shake only when the player allows it (reduced motion turns the setting off by default).
    const s = useSettingsStore.getState()
    if (def.shake > 0 && s.cameraShake && s.scareIntensity === 'full' && store.stage === 'sequence') {
      pos.current.x += (Math.random() - 0.5) * 2 * def.shake
      pos.current.y += (Math.random() - 0.5) * 2 * def.shake
    }
    state.camera.position.copy(pos.current)
    state.camera.lookAt(look.current)
  })

  return null
}
