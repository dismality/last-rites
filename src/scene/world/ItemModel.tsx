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
import { isPlaceholderPath } from '../../data/placeholders'
import { PlaceholderMesh } from '../assets/PlaceholderMesh'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'

/** The model as authored (its own axes, centred on its bounding box). */
export function ItemMesh({ item }: { item: ItemId }) {
  const path = ITEM_MAP[item].model
  if (!path) return null
  const url = assetUrl(path)
  // Spec 11 art that may not have landed yet is probed first, so a missing file never throws.
  return isPlaceholderPath(url) ? <ProbedItemMesh url={url} name={ITEM_MAP[item].name} /> : <LoadedItemMesh url={url} />
}

function ProbedItemMesh({ url, name }: { url: string; name: string }) {
  const status = useAssetOrPlaceholder(url)
  if (status === 'checking') return null
  if (status === 'present') return <LoadedItemMesh url={url} />
  // PLACEHOLDER: /assets/models/items/brisk-draught.glb (the only spec 11 item model)
  return <PlaceholderMesh path={url} shape="bottle" name={`${name} (placeholder)`} color="#3f6d4a" />
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
