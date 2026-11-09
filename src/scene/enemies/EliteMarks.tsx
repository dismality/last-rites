// EliteMarks: the ember aura and floating Sigil_Ring that mark an elite (Req 15.6, 15.7).
// Two instanced pools of 4 keep this at two draw calls however many elites are alive.
// The ring is a shape cue, so elites never read by colour alone. Rendering only.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ENEMY_LOOKS, ENEMY_MODEL_HEIGHT } from '../../data/enemies'
import { ELITE } from '../../data/elites'
import { useEnemyStore, useSettingsStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'

/** Elites are capped at one per wave, so four slots are plenty. */
export const ELITE_MARK_POOL = 4
const EMBER = '#e8913a'
const AURA_OPACITY = 0.22
const RING_OPACITY = 0.9
const AURA_PULSE_HZ = 0.8
const RING_SPIN_RAD_S = 0.9
const RING_GAP_M = 0.35
const RING_BOB_M = 0.05

/** Open cone around the body; unit height, scaled to the zombie. */
function auraGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.3, 0.55, 1, 14, 1, true)
  g.translate(0, 0.5, 0)
  return g
}

/** A thin ring with four tick marks, so it reads as a sigil and not a plain halo. */
function ringGeometry(): THREE.BufferGeometry {
  const torus = new THREE.TorusGeometry(0.28, 0.025, 6, 24)
  torus.rotateX(Math.PI / 2)
  const parts: THREE.BufferGeometry[] = [torus]
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.BoxGeometry(0.05, 0.05, 0.14)
    const a = (i * Math.PI) / 2
    tick.translate(0, 0, 0.36)
    tick.rotateY(a)
    parts.push(tick)
  }
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

function markMaterial(opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: EMBER,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

const dummy = new THREE.Object3D()

export function EliteMarks() {
  const aura = useRef<THREE.InstancedMesh>(null)
  const ring = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => ({ aura: auraGeometry(), ring: ringGeometry() }), [])
  const mats = useMemo(
    () => ({ aura: markMaterial(AURA_OPACITY), ring: markMaterial(RING_OPACITY) }),
    [],
  )

  useEffect(
    () => () => {
      geo.aura.dispose()
      geo.ring.dispose()
      mats.aura.dispose()
      mats.ring.dispose()
    },
    [geo, mats],
  )

  useFrame((state) => {
    if (isSimFrozen()) return
    const a = aura.current
    const r = ring.current
    if (!a || !r) return
    const t = state.clock.elapsedTime

    // Flashing lights off: constant brightness, no pulse (Req 15.7).
    const pulse = useSettingsStore.getState().flashingLights
    // Written through the mesh, since the hook-owned material may not be mutated directly.
    ;(a.material as THREE.MeshBasicMaterial).opacity = pulse
      ? AURA_OPACITY * (0.75 + 0.25 * Math.sin(t * Math.PI * 2 * AURA_PULSE_HZ))
      : AURA_OPACITY

    let n = 0
    for (const e of useEnemyStore.getState().enemies) {
      if (!e.elite || n >= ELITE_MARK_POOL) continue
      if (e.state === 'dying' || e.state === 'dead') continue
      const look = ENEMY_LOOKS[e.type]
      const scale = typeof look.scale === 'number' ? look.scale : look.scale[1]
      const height = ENEMY_MODEL_HEIGHT[look.model] * scale * ELITE.scale

      dummy.position.set(e.pos.x, 0, e.pos.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(ELITE.scale, height, ELITE.scale)
      dummy.updateMatrix()
      a.setMatrixAt(n, dummy.matrix)

      dummy.position.set(e.pos.x, height + RING_GAP_M + Math.sin(t * 1.5 + n) * RING_BOB_M, e.pos.z)
      dummy.rotation.set(0, t * RING_SPIN_RAD_S + n, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      r.setMatrixAt(n, dummy.matrix)
      n++
    }
    a.count = n
    r.count = n
    a.instanceMatrix.needsUpdate = true
    r.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh
        ref={aura}
        args={[geo.aura, mats.aura, ELITE_MARK_POOL]}
        frustumCulled={false}
        renderOrder={2}
      />
      <instancedMesh
        ref={ring}
        args={[geo.ring, mats.ring, ELITE_MARK_POOL]}
        frustumCulled={false}
        renderOrder={2}
      />
    </>
  )
}
