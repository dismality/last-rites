// A held item's Blender model, placed by its grip transform from data/itemModels.ts. The caller
// places and poses the surrounding group. The GLB is shared with the world copies (one load).

import { HELD_GRIPS, type HeldGrip } from '../../data/itemModels'
import { ItemMesh } from '../world/ItemModel'
import type { HeldWeaponId } from './viewmodelWeaponGeometry'

export function WeaponMesh({ id }: { id: HeldWeaponId }) {
  const grip: HeldGrip = HELD_GRIPS[id]
  return (
    <group position={[...grip.position]} rotation={[...grip.rotation]} scale={grip.scale}>
      <ItemMesh item={id} />
    </group>
  )
}
