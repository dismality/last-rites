// CraneProps: Father Crane's censer on its swinging chain and his stole (Req 17.16, 21.8).
// Built from primitives merged into two meshes (one per moving part), no new model files.
// Mounted inside Crane's body group, so it inherits his scale, rise and position.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { isSimFrozen } from '../../game/state/menuState'

const SWING_AMPLITUDE_RAD = 0.35
const SWING_HZ = 0.55
const CHAIN_LENGTH_M = 0.55
/** Right hand, a little forward of the hip (brute.glb is 1.95 m tall, facing +Z). */
const HAND = new THREE.Vector3(0.5, 1.0, 0.1)

/** Paints a whole geometry one colour so merged parts keep their own look. */
function colored(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color)
  const count = g.getAttribute('position').count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) c.toArray(arr, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

/** Pivot at the hand: a chain hangs down to a bowl with a lid. */
function censerGeometry(): THREE.BufferGeometry {
  const chain = new THREE.CylinderGeometry(0.012, 0.012, CHAIN_LENGTH_M, 5)
  chain.translate(0, -CHAIN_LENGTH_M / 2, 0)
  const bowl = new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  bowl.translate(0, -CHAIN_LENGTH_M - 0.02, 0)
  const lid = new THREE.ConeGeometry(0.1, 0.09, 10)
  lid.translate(0, -CHAIN_LENGTH_M + 0.05, 0)
  return merge([colored(chain, '#6b6f7a'), colored(bowl, '#8a7a4a'), colored(lid, '#8a7a4a')])
}

/** Two cloth strips hanging from the shoulders down the chest. */
function stoleGeometry(): THREE.BufferGeometry {
  const strip = (x: number, tilt: number) => {
    const g = new THREE.PlaneGeometry(0.12, 0.8)
    g.rotateZ(tilt)
    g.translate(x, 1.25, 0.24)
    return colored(g, '#6a5a78')
  }
  const trim = new THREE.PlaneGeometry(0.34, 0.05)
  trim.translate(0, 1.66, 0.2)
  return merge([strip(-0.12, 0.08), strip(0.12, -0.08), colored(trim, '#8a7a4a')])
}

interface CranePropsProps {
  /** 1 = solid, 0 = gone. Crane's body fades after death; the props follow it. */
  fade: MutableRefObject<number>
}

export function CraneProps({ fade }: CranePropsProps) {
  const pendulum = useRef<THREE.Group>(null)
  const stole = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => ({ censer: censerGeometry(), stole: stoleGeometry() }), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    [],
  )

  useEffect(
    () => () => {
      geo.censer.dispose()
      geo.stole.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  useFrame((state) => {
    if (isSimFrozen()) return
    const p = pendulum.current
    if (p)
      p.rotation.x =
        Math.sin(state.clock.elapsedTime * Math.PI * 2 * SWING_HZ) * SWING_AMPLITUDE_RAD
    const stoleMesh = stole.current
    if (stoleMesh) (stoleMesh.material as THREE.MeshStandardMaterial).opacity = fade.current
  })

  return (
    <>
      <group ref={pendulum} position={HAND}>
        <mesh geometry={geo.censer} material={mat} frustumCulled={false} />
      </group>
      <mesh ref={stole} geometry={geo.stole} material={mat} frustumCulled={false} />
    </>
  )
}
