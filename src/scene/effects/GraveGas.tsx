// Grave gas where a Bloater bursts: 96 instanced quads, 1.2 s life, grey-green dust only (no gore).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAS_LIFE_S, GAS_POOL, gasRuntime, spawnGas, tickGas, type GasPuff } from './gasRuntime'

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function GraveGas() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const live = useRef<GasPuff[]>([])

  useFrame(({ camera }, rawDelta) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(rawDelta, 0.1)
    while (gasRuntime.queue.length > 0) {
      live.current.push(...spawnGas(gasRuntime.queue.shift()!, Math.random))
    }
    live.current = tickGas(live.current, dt)
    live.current.forEach((p, i) => {
      // Swell as it drifts, so the cloud reads as dust rather than a solid.
      _m.compose(
        _p.set(p.x, p.y, p.z),
        camera.quaternion,
        _s.setScalar(0.5 + (0.9 * p.age) / GAS_LIFE_S),
      )
      im.setMatrixAt(i, _m)
    })
    im.count = live.current.length
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, GAS_POOL]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#7d8a6c"
        transparent
        opacity={0.4}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
