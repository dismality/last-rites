// Stand-in first-person hands and lantern, drawn from primitives until viewmodel/hands.glb and
// viewmodel/lantern.glb are made in Blender (spec 11 H7). The right fist closes round the held
// item's grip (the held group's origin, where every weapon's handle sits); the left fist holds the
// lantern by its ring. Rendering only.
// PLACEHOLDER: /assets/models/viewmodel/hands.glb
// PLACEHOLDER: /assets/models/viewmodel/lantern.glb

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HELD_ORIGIN } from '../../data/itemModels'
import { LANTERN_LIGHT } from '../../data/lanternLight'
import { signalToFlame } from '../../game/systems/lanternFlicker'
import { lanternHandRuntime, lanternLightRuntime } from './lanternRig'

const SKIN = '#c4977a'
const SLEEVE = '#2e2620'
const CUFF = '#3d3128'
const IRON = '#2a2622'
const BRASS = '#8a6a32'

const skin = <meshStandardMaterial color={SKIN} roughness={0.75} />
const sleeve = <meshStandardMaterial color={SLEEVE} roughness={1} />
const cuff = <meshStandardMaterial color={CUFF} roughness={1} />

/**
 * A fist closed round an axis along local Z: knuckle band, palm, curled fingers and a thumb, with
 * the wrist and sleeve running back along `armDir` out of the bottom of the screen.
 */
function Fist({ armRotation }: { armRotation: [number, number, number] }) {
  return (
    <group>
      {/* Palm and back of the hand, wrapped round the grip */}
      <mesh position={[0.012, 0, 0]}>
        <boxGeometry args={[0.03, 0.045, 0.075]} />
        {skin}
      </mesh>
      {/* Curled fingers: a part torus round the grip axis */}
      <mesh rotation={[0, 0, Math.PI * 0.35]}>
        <torusGeometry args={[0.022, 0.012, 8, 14, Math.PI * 1.35]} />
        {skin}
      </mesh>
      <mesh position={[0, 0, -0.024]} rotation={[0, 0, Math.PI * 0.35]}>
        <torusGeometry args={[0.021, 0.011, 8, 14, Math.PI * 1.3]} />
        {skin}
      </mesh>
      <mesh position={[0, 0, 0.024]} rotation={[0, 0, Math.PI * 0.35]}>
        <torusGeometry args={[0.021, 0.011, 8, 14, Math.PI * 1.3]} />
        {skin}
      </mesh>
      {/* Thumb over the top */}
      <mesh position={[-0.006, 0.024, 0.028]} rotation={[0.9, 0, 0.3]}>
        <capsuleGeometry args={[0.009, 0.03, 4, 8]} />
        {skin}
      </mesh>
      {/* Wrist, cuff and sleeve */}
      <group rotation={armRotation}>
        <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.024, 0.05, 10]} />
          {skin}
        </mesh>
        <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.036, 0.034, 0.05, 12]} />
          {cuff}
        </mesh>
        <mesh position={[0, 0, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.044, 0.036, 0.28, 12]} />
          {sleeve}
        </mesh>
      </group>
    </group>
  )
}

/** The right hand on the held item's grip. Mount inside the viewmodel rig (it sways and swings with it). */
export function PlaceholderRightHand() {
  return (
    <group position={[...HELD_ORIGIN.position]} rotation={[...HELD_ORIGIN.rotation]} name="placeholder-right-hand">
      {/* The arm comes up from the bottom right of the screen to the grip. */}
      <Fist armRotation={[0.6, 0.4, 0]} />
    </group>
  )
}

/**
 * A keeper's cage lantern held by its ring, with the left fist round the ring. The group origin is
 * the glass centre (the light's anchor). The flame follows the light rig's flicker signal.
 */
export function PlaceholderLantern() {
  const flame = useRef<THREE.Mesh>(null)
  const glass = useRef<THREE.Mesh>(null)
  const hand = useRef<THREE.Group>(null)

  useFrame(() => {
    const rt = lanternLightRuntime
    const s = rt.beam ? signalToFlame(rt.signal) : 0
    if (flame.current) flame.current.scale.set(s, s * 1.6, s)
    if (glass.current) {
      const m = glass.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = rt.beam ? 0.35 + 0.5 * rt.signal : 0.05
    }
    // On the belt the left hand is busy elsewhere (the shotgun fore-end), so it is not drawn here.
    if (hand.current) hand.current.visible = lanternHandRuntime.hand.mode !== 'belt'
  })

  const bars = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    return (
      <mesh key={i} position={[Math.cos(a) * 0.036, 0, Math.sin(a) * 0.036]}>
        <cylinderGeometry args={[0.003, 0.003, 0.08, 6]} />
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.6} />
      </mesh>
    )
  })

  return (
    <group name="placeholder-lantern">
      {/* Glass chimney */}
      <mesh ref={glass}>
        <cylinderGeometry args={[0.032, 0.032, 0.075, 16, 1, true]} />
        <meshStandardMaterial
          color="#5a3c18"
          emissive={LANTERN_LIGHT.color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Flame */}
      <mesh ref={flame} position={[0, -0.008, 0]}>
        <sphereGeometry args={[0.009, 10, 8]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
      {/* Wick holder */}
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[0.008, 0.01, 0.012, 8]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.4} />
      </mesh>
      {bars}
      {/* Base (the oil fount) */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.042, 0.046, 0.028, 16]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Cap and chimney top */}
      <mesh position={[0, 0.046, 0]}>
        <cylinderGeometry args={[0.02, 0.042, 0.022, 16]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.064, 0]}>
        <cylinderGeometry args={[0.01, 0.014, 0.016, 10]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Carrying ring */}
      <mesh position={[0, 0.092, 0]}>
        <torusGeometry args={[0.022, 0.0035, 6, 20]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Left fist round the top of the ring; the arm comes in from the bottom left. */}
      <group ref={hand} position={[0, 0.112, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Fist armRotation={[0.89, 0.89, 0]} />
      </group>
    </group>
  )
}
