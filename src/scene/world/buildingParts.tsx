// Shared pieces for the hut and the chapel: shared materials, a solid slab and a gabled roof.
// Primitives on purpose: the Kenney kit has no hut, and its brick wall panels read as a striped
// shed when stretched to chapel height. A few plain boxes share one material per surface.

import { useEffect, useMemo } from 'react'
import { CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { PART_MATERIALS, type PartMaterial } from './partMaterials'
import type { Vec3 } from '../../data/cemeteryLayout'

/** A box that is visible and, unless `solid` is false, also blocks the player. Inside a fixed RigidBody. */
export function Slab({
  position,
  size,
  material,
  solid = true,
  visible = true,
}: {
  position: Vec3
  size: Vec3
  material: PartMaterial
  solid?: boolean
  visible?: boolean
}) {
  return (
    <>
      {visible && (
        <mesh position={[...position]} material={PART_MATERIALS[material]} castShadow receiveShadow>
          <boxGeometry args={[...size]} />
        </mesh>
      )}
      {solid && (
        <CuboidCollider
          args={[size[0] / 2, size[1] / 2, size[2] / 2]}
          position={[...position]}
        />
      )}
    </>
  )
}

/** Triangular prism roof; the ridge runs along Z and the base sits at `position`. */
export function GableRoof({
  position,
  width,
  length,
  rise,
  material,
}: {
  position: Vec3
  width: number
  length: number
  rise: number
  material: PartMaterial
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, 0)
    shape.lineTo(width / 2, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false })
    g.translate(0, 0, -length / 2)
    return g
  }, [width, length, rise])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      geometry={geometry}
      material={PART_MATERIALS[material]}
      position={[...position]}
      castShadow
      receiveShadow
    />
  )
}
