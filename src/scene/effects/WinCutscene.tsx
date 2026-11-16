// WinCutscene (spec 10 task 6.2, Req 23): after the Rest sunrise the keeper walks down the middle of
// the grounds and out of the south gate while the sun rises and the fog lifts. Timing, path, bob and
// sky are pure (game/systems/winSequence.ts); this turns them into the camera pose, swings the gate
// and tolls the bell. The captions and the Skip button are in EndingScreen's WalkOut.
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh, Vector3 } from 'three'
import { playCombatSound } from '../../audio/AudioManager'
import { useEndingStore } from '../../game/state/endingStore'
import { useGameStore } from '../../game/state'
import { advanceSequence } from '../../game/systems/endingSequence'
import { WIN_GATE, WIN_SUN } from '../../data/winCutscene'
import {
  gateOpenAngle,
  gateTime,
  sunHeight,
  sunProgress,
  winPose,
} from '../../game/systems/winSequence'
import { currentWinSequence, resetWinRuntime, setGateCut, winRuntime } from './winRuntime'

const IRON = '#1d1b19'
const STONE = '#6f6b64'
const BARS = 7
const LEAF_W = WIN_GATE.halfWidth
const LEAF_H = 2.1

/** One iron gate leaf, hinged at its own origin, reaching `dir` (+1 east, -1 west) along x. */
function Leaf({ dir }: { dir: 1 | -1 }) {
  return (
    <group>
      {[0.12, LEAF_H - 0.1, LEAF_H * 0.55].map((y) => (
        <mesh key={y} position={[(dir * LEAF_W) / 2, y, 0]} castShadow>
          <boxGeometry args={[LEAF_W, 0.05, 0.05]} />
          <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.55} />
        </mesh>
      ))}
      {Array.from({ length: BARS }, (_, i) => {
        const x = dir * (0.08 + (i * (LEAF_W - 0.16)) / (BARS - 1))
        const h = LEAF_H + 0.18 - Math.abs(i - (BARS - 1)) * 0.02
        return (
          <mesh key={i} position={[x, h / 2, 0]} castShadow>
            <boxGeometry args={[0.035, h, 0.035]} />
            <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.55} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Two stone posts with caps and the two leaves, standing in the cut in the south fence. */
function Gate({ west, east }: { west: RefObject<Group | null>; east: RefObject<Group | null> }) {
  const { x, z, halfWidth, postHalf, postHeight } = WIN_GATE
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (halfWidth + postHalf), 0, 0]}>
          <mesh position={[0, postHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[postHalf * 2, postHeight, postHalf * 2]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
          <mesh position={[0, postHeight + 0.12, 0]} castShadow>
            <boxGeometry args={[postHalf * 2 + 0.14, 0.24, postHalf * 2 + 0.14]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
          <mesh position={[0, postHeight + 0.42, 0]} castShadow>
            <sphereGeometry args={[0.17, 12, 8]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
        </group>
      ))}
      <group ref={west} position={[-halfWidth, 0, 0]}>
        <Leaf dir={1} />
      </group>
      <group ref={east} position={[halfWidth, 0, 0]}>
        <Leaf dir={-1} />
      </group>
    </group>
  )
}

export function WinCutscene() {
  const screen = useGameStore((s) => s.screen)
  const ending = useEndingStore((s) => s.ending)
  const stage = useEndingStore((s) => s.stage)
  const runId = useEndingStore((s) => s.runId)
  const showing = screen === 'ending' && ending === 'rest' && (stage === 'walkout' || stage === 'summary')

  const def = useMemo(() => (showing ? currentWinSequence() : null), [showing])
  const atGate = useMemo(() => (def ? gateTime(def) : 0), [def])
  const sun = useRef<Mesh>(null)
  const west = useRef<Group>(null)
  const east = useRef<Group>(null)
  const look = useRef(new Vector3())
  const tolled = useRef(false)
  const lastStage = useRef<string | null>(null)

  // A new ending (or a new run) starts the walk from the hut door with the fence whole.
  useEffect(() => {
    resetWinRuntime()
    tolled.current = false
  }, [ending, runId])

  useEffect(() => {
    if (!showing) return
    winRuntime.active = true
    setGateCut(true)
    return () => resetWinRuntime()
  }, [showing])

  useFrame((state, rawDelta) => {
    if (!def) return
    const rt = winRuntime
    const store = useEndingStore.getState()
    // Every walk starts at the hut door, even when the same ending begins again.
    if (store.stage === 'walkout' && lastStage.current !== 'walkout') {
      rt.time = 0
      tolled.current = false
    }
    lastStage.current = store.stage
    if (store.stage === 'walkout' && rt.holdAt !== null) {
      rt.time = Math.min(Math.max(rt.holdAt, 0), def.duration - 0.01)
    } else if (store.stage === 'walkout') {
      const step = advanceSequence(def, rt.time, rawDelta, useGameStore.getState().paused)
      rt.time = step.time
      if (!tolled.current && rt.time >= def.tollAt) {
        tolled.current = true
        playCombatSound('toll', undefined, 0.35)
      }
      if (step.done) store.showSummary()
    } else {
      // Skipped (or finished): the card sits over the last pose, the sun up and the gate open.
      rt.time = def.duration
    }
    rt.sun = sunProgress(def, rt.time)

    if (sun.current) sun.current.position.y = sunHeight(rt.sun)

    const angle = gateOpenAngle(def, rt.time, atGate)
    if (west.current) west.current.rotation.y = -angle
    if (east.current) east.current.rotation.y = angle

    const pose = winPose(def, rt.time)
    state.camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    look.current.set(pose.target[0], pose.target[1], pose.target[2])
    state.camera.lookAt(look.current)
  })

  if (!showing) return null
  return (
    <>
      <Gate west={west} east={east} />
      {/* The rising sun: unlit and unfogged so it glows through the thinning mist. */}
      <mesh ref={sun} position={[WIN_SUN.x, WIN_SUN.fromY, WIN_SUN.z]}>
        <sphereGeometry args={[WIN_SUN.radius, 24, 16]} />
        <meshBasicMaterial color={WIN_SUN.color} fog={false} toneMapped={false} />
      </mesh>
    </>
  )
}
