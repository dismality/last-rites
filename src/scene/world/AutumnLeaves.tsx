// Fallen leaves blowing across the grounds (design bible §15): one instanced mesh (one draw call)
// in a box that follows the camera. Rules are in systems/allHallows.ts; this only draws them.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LEAVES } from '../../data/allHallows'
import { isSimFrozen } from '../../game/state/menuState'
import { useSettingsStore } from '../../game/state/settingsStore'
import { stormRuntime } from '../../game/state/stormRuntime'
import { createLeafField, stepLeaves } from '../../game/systems/allHallows'
import { isInterior } from '../../game/systems/interiorFog'

const MAX_DT_S = 0.1
const dummy = new THREE.Object3D()
const COLORS = LEAVES.colors.map((c) => new THREE.Color(c))

/** A small leaf: a diamond with a slight fold, so it catches the light as it tumbles. */
function leafGeometry(): THREE.BufferGeometry {
  const s = LEAVES.sizeM
  const g = new THREE.BufferGeometry()
  const v = new Float32Array([
    0, 0, -s, s * 0.45, 0.01, 0, 0, 0, s * 0.8,
    0, 0, -s, 0, 0, s * 0.8, -s * 0.45, 0.01, 0,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

export function AutumnLeaves() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const lowGraphics = useSettingsStore((s) => s.lowGraphics)
  const count = lowGraphics ? Math.round(LEAVES.count / 2) : LEAVES.count
  const field = useMemo(() => createLeafField(count, 0, 0, Math.random), [count])
  const t = useRef(0)
  const geo = useMemo(() => leafGeometry(), [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), [])
  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    for (let i = 0; i < field.count; i++) m.setColorAt(i, COLORS[field.color[i]])
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [field])

  useFrame((state, rawDelta) => {
    const m = mesh.current
    if (!m) return
    const cam = state.camera.position
    if (!isSimFrozen()) {
      const dt = Math.min(rawDelta, MAX_DT_S)
      t.current += dt
      const wind = stormRuntime.storm.active ? LEAVES.stormWindScale : 1
      stepLeaves(field, dt, t.current, wind, cam.x, cam.z, Math.random)
    }
    const time = t.current
    for (let i = 0; i < field.count; i++) {
      const x = field.x[i]
      const z = field.z[i]
      dummy.position.set(x, field.y[i] + 0.01, z)
      if (field.ground[i] >= 0) {
        // Lying flat, turned a little.
        dummy.rotation.set(0, field.phase[i], 0)
      } else {
        const spin = time * field.flutterHz[i] * 4 + field.phase[i]
        dummy.rotation.set(Math.sin(spin) * 1.2, spin, Math.cos(spin * 0.7) * 0.9)
      }
      // No leaves inside the hut, the chapel or the crypts.
      dummy.scale.setScalar(isInterior(x, z) ? 0 : 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh key={count} ref={mesh} args={[geo, mat, count]} frustumCulled={false} receiveShadow />
}
