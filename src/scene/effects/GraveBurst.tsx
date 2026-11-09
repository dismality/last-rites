// Soil and dust thrown up when a grave bursts open: one instanced mesh for the whole pool.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { graveBurstRuntime } from './graveBurstRuntime'

const POOL = 160
const PER_BURST = 24
const LIFETIME_S = 1.1
const GRAVITY = 9
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

interface Clod {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
}

export function GraveBurst() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const live = useRef<Clod[]>([])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#3b2f25',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    [],
  )

  useFrame((_state, rawDelta) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(rawDelta, 0.1)
    for (const b of graveBurstRuntime.queue) {
      for (let i = 0; i < PER_BURST; i++) {
        const a = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 2.5
        live.current.push({
          x: b.x,
          y: 0.2,
          z: b.z,
          vx: Math.cos(a) * speed,
          vy: 3 + Math.random() * 3,
          vz: Math.sin(a) * speed,
          age: 0,
        })
      }
    }
    graveBurstRuntime.queue.length = 0
    // Oldest clods drop first if several graves burst together.
    if (live.current.length > POOL) live.current.splice(0, live.current.length - POOL)

    live.current = live.current
      .map((c) => ({
        ...c,
        x: c.x + c.vx * dt,
        y: Math.max(0, c.y + c.vy * dt),
        z: c.z + c.vz * dt,
        vy: c.vy - GRAVITY * dt,
        age: c.age + dt,
      }))
      .filter((c) => c.age < LIFETIME_S)
    live.current.forEach((c, i) => {
      _m.compose(_p.set(c.x, c.y, c.z), _q, _s.setScalar(0.07 * (1 - c.age / LIFETIME_S) + 0.02))
      im.setMatrixAt(i, _m)
    })
    im.count = live.current.length
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, material, POOL]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}
