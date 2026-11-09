// IntroCamera: plays the intro cutscene camera (docs/game-design.md §11).
// Timeline maths is in game/systems/introTimeline.ts; this only applies the pose.
// No shake, head bob or audio, at any setting.
import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { INTRO_END_POSE, INTRO_SHOTS } from '../../data/introCutscene'
import { useGameStore } from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
import { advanceIntro, introStateAt } from '../../game/systems/introTimeline'
import { graveBurstRuntime } from './graveBurstRuntime'
import { introCameraRuntime } from './introCameraRuntime'

const MAX_DT = 0.1

/** Global time of the shot 4 burst; null if no shot defines one. */
function burstTime(): { x: number; z: number; time: number } | null {
  let start = 0
  for (const s of INTRO_SHOTS) {
    if (s.burst) return { x: s.burst.x, z: s.burst.z, time: start + s.burst.at }
    start += s.duration
  }
  return null
}

export function IntroCamera() {
  const playing = useIntroStore((s) => s.playing)

  // Each playthrough starts from zero. Hand-back happens in the frame loop so a skip
  // can still place the camera on the end pose before the controller takes over.
  useEffect(() => {
    if (!playing) return
    introCameraRuntime.time = 0
    introCameraRuntime.burstFired = false
    introCameraRuntime.active = true
  }, [playing])

  useEffect(
    () => () => {
      introCameraRuntime.active = false
    },
    [],
  )

  useFrame((state, rawDelta) => {
    const rt = introCameraRuntime
    if (!rt.active) return
    const store = useIntroStore.getState()
    const cam = state.camera

    // skip() cleared `playing`: snap to the end pose and give the camera back.
    if (!store.playing) {
      cam.position.set(...INTRO_END_POSE.position)
      cam.lookAt(...INTRO_END_POSE.target)
      rt.active = false
      return
    }

    rt.time = advanceIntro(rt.time, Math.min(rawDelta, MAX_DT), useGameStore.getState().paused)
    const st = introStateAt(rt.time)

    const burst = burstTime()
    if (burst && !rt.burstFired && rt.time >= burst.time) {
      rt.burstFired = true
      graveBurstRuntime.queue.push({ x: burst.x, z: burst.z })
    }

    cam.position.set(...st.position)
    cam.lookAt(...st.target)

    if (st.done) {
      rt.active = false
      store.finish()
    }
  })

  return null
}
