// An item's Blender model, drawn wherever the item lies in the world. Each GLB is loaded once
// (useGLTF, warmed by preloadModels) and every copy is a drei <Clone>, which shares the geometry
// and materials, so a hundred pickups cost no extra memory. Placement (scale, lying rotation, lift)
// comes from data/itemModels.ts; the files themselves are never rotated or scaled.

import { Suspense } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { DRACO_PATH, assetUrl } from '../../data/assets'
import { ITEM_MAP } from '../../data/items'
import { groundPose } from '../../data/itemModels'
import type { ItemId } from '../../game/types'
import '../assets/preloadModels'
import { MaterialShape } from './MaterialShape'

/** The model as authored (its own axes, centred on its bounding box). */
export function ItemMesh({ item }: { item: ItemId }) {
  const path = ITEM_MAP[item].model
  if (!path) return null
  return <LoadedItemMesh url={assetUrl(path)} />
}

function LoadedItemMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  return <Clone object={scene} />
}

interface GroundItemProps {
  item: ItemId
  /** Replaces the item's ground scale. */
  scale?: number
  /** Turn about the vertical axis, so a row of the same item does not look stamped. */
  yaw?: number
}

/**
 * The item resting on whatever is below the origin. MaterialShape is only the stand-in while the
 * GLB loads (it is normally preloaded, so it is rarely seen).
 */
export function GroundItem({ item, scale, yaw = 0 }: GroundItemProps) {
  const pose = groundPose(item, scale)
  return (
    <group rotation={[0, yaw, 0]}>
      <Suspense fallback={<MaterialShape item={item} />}>
        <group position={[0, pose.lift, 0]} rotation={[...pose.rotation]} scale={pose.scale}>
          <ItemMesh item={item} />
        </group>
      </Suspense>
    </group>
  )
}
