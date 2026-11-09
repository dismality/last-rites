// Compiles every material in the scene once, a few frames after mount, so culled or not-yet-seen
// props do not trigger a shader compile (a frame hitch) the first time they come into view.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/** Wait for the first frames so lazily mounted children are in the scene graph. */
const WARMUP_FRAMES = 3

export function ShaderPrecompile() {
  const frames = useRef(0)
  useFrame(({ gl, scene, camera }) => {
    if (frames.current > WARMUP_FRAMES) return
    frames.current += 1
    if (frames.current === WARMUP_FRAMES) gl.compile(scene, camera)
  })
  return null
}
