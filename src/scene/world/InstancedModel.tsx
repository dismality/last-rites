// Draws many copies of one .glb with a single draw call per mesh in the file.
// The world kit's files hold one mesh each, so a model costs one call however
// many placements it has (draw-call budget: < 150).

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { worldModelUrl, type WorldModelId } from '../../data/assets'
import type { Placement } from '../../data/cemeteryLayout'
import '../assets/preloadModels'

interface Props {
  model: WorldModelId
  placements: readonly Placement[]
  /** Re-centre the model on x/z. Fence and wall kit pieces sit off-centre on their pivot. */
  centerXZ?: boolean
  /** Added to every placement's height (e.g. a crypt roof lifted 2.4 m). */
  lift?: number
  castShadow?: boolean
  receiveShadow?: boolean
}

const _m = new THREE.Matrix4()
const _p = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Vector3()

export function InstancedModel({
  model,
  placements,
  centerXZ = false,
  lift = 0,
  castShadow = true,
  receiveShadow = true,
}: Props) {
  const { scene } = useGLTF(worldModelUrl(model))

  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true)
    const found: THREE.Mesh[] = []
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh)
    })
    if (found.length === 0) return []
    // Offset from the pivot to the model's footprint centre, shared by all parts.
    const box = new THREE.Box3().setFromObject(scene)
    box.getCenter(_c)
    const offset = centerXZ ? new THREE.Vector3(-_c.x, 0, -_c.z) : new THREE.Vector3()

    return found.map((src) => {
      // Bake the mesh's own transform inside the file so nodes with offsets still line up.
      const local = new THREE.Matrix4().makeTranslation(offset).multiply(src.matrixWorld)
      const inst = new THREE.InstancedMesh(src.geometry, src.material, placements.length)
      placements.forEach((pl, i) => {
        _q.setFromEuler(_e.set(0, pl.rotationY, 0))
        _v.set(pl.position[0], pl.position[1] + lift, pl.position[2])
        _s.set(pl.scale[0], pl.scale[1], pl.scale[2])
        _p.compose(_v, _q, _s)
        _m.multiplyMatrices(_p, local)
        inst.setMatrixAt(i, _m)
      })
      inst.instanceMatrix.needsUpdate = true
      // Cull against the real extents of all instances, not the single source mesh.
      inst.computeBoundingSphere()
      inst.castShadow = castShadow
      inst.receiveShadow = receiveShadow
      return inst
    })
  }, [scene, placements, centerXZ, lift, castShadow, receiveShadow])

  // The instanced meshes borrow geometry and material from the cached glTF, so
  // only the per-instance buffers are ours to free.
  useEffect(
    () => () => {
      meshes.forEach((m) => m.dispose())
    },
    [meshes],
  )

  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  )
}
