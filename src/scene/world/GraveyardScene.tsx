// GraveyardScene -- the whole dressed graveyard (ground, stones, dead oaks, crypts, fences) as one
// Draco GLB in game coordinates, plus its collision boxes as one fixed rigid body.
//
// Wiring only: the hut, chapel, catacombs, gates, lamps, interactables and the readable
// tombstones are still built by their own components. Mount inside <Physics>.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { DRACO_PATH, GRAVEYARD_MODEL_URL } from '../../data/assets'
import { GRAVEYARD_COLLIDERS } from '../../data/graveyardColliders'

/** Materials in the GLB that throw shadows (the lantern is the only shadow-casting light that matters). */
const CASTING_MATERIALS = new Set(['lr-stone', 'lr-iron', 'lr-bark'])

/** Prepares the cached glTF once: vertex colours on, grass seen from both sides, shadow flags. */
function prepare(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    let casts = false
    for (const m of mats) {
      if (!m.name.startsWith('lr-')) continue
      const std = m as THREE.MeshStandardMaterial
      // GLTFLoader already sets this when COLOR_0 exists; forcing it covers a loader change.
      if (mesh.geometry.getAttribute('color') && !std.vertexColors) {
        std.vertexColors = true
        std.needsUpdate = true
      }
      if (m.name === 'lr-grass') m.side = THREE.DoubleSide
      if (CASTING_MATERIALS.has(m.name)) casts = true
    }
    mesh.castShadow = casts
    mesh.receiveShadow = true
  })
}

useGLTF.setDecoderPath(DRACO_PATH)

export function GraveyardScene() {
  const { scene } = useGLTF(GRAVEYARD_MODEL_URL, DRACO_PATH)
  useMemo(() => prepare(scene), [scene])
  return (
    <>
      <primitive object={scene} />
      <RigidBody type="fixed" colliders={false}>
        {GRAVEYARD_COLLIDERS.map((b, i) => (
          <CuboidCollider key={i} args={[...b.half]} position={[...b.center]} rotation={[0, b.rotY, 0]} />
        ))}
      </RigidBody>
    </>
  )
}
