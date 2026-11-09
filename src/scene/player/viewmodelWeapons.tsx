// Component half of the held weapon meshes (Req 2.8, 23.8). Geometry, materials and ids live in viewmodelWeaponGeometry.ts so this file only exports a component.

import { useMemo } from 'react'
import { getWeaponGeometry, getWeaponMaterials, type HeldWeaponId } from './viewmodelWeaponGeometry'

/** Two meshes, two draw calls. The caller places and poses the surrounding group. */
export function WeaponMesh({ id }: { id: HeldWeaponId }) {
  const geo = useMemo(() => getWeaponGeometry(id), [id])
  const mat = useMemo(() => getWeaponMaterials(id), [id])
  return (
    <>
      <mesh geometry={geo.metal} material={mat.metal} />
      <mesh geometry={geo.wood} material={mat.wood} />
    </>
  )
}
