// Instanced dust puffs for melee hits: one draw call for the whole pool.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DUST_LIFETIME_S, tickDust, type DustParticle } from '../../game/systems/melee'
import { meleeRuntime } from '../player/meleeRuntime'

const POOL = 64
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export function DustBurst() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const live = useRef<DustParticle[]>([])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#8f8574', transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  )

  useFrame((_s2, rawDelta) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(rawDelta, 0.1)
    if (meleeRuntime.dustQueue.length > 0) {
      live.current.push(...meleeRuntime.dustQueue)
      meleeRuntime.dustQueue.length = 0
      // Oldest puffs drop first if a flurry overflows the pool.
      if (live.current.length > POOL) live.current.splice(0, live.current.length - POOL)
    }
    live.current = tickDust(live.current, dt)
    live.current.forEach((p, i) => {
      // Puffs swell then shrink away so they read as dust, not debris.
      const life = p.age / DUST_LIFETIME_S
      const size = 0.05 + 0.1 * Math.sin(Math.min(1, life) * Math.PI)
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.setScalar(size))
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
