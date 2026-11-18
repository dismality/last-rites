// Picks the creature's own model or, while the file is missing, the zombie model scaled and tinted
// (a marked placeholder). Spec 11 H2. The clone, tint and clip rig are in creatureRig.ts.
import type { ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { BRIDE_MODEL_URL, CRAWLER_MODEL_URL, HOUND_MODEL_URL, ZOMBIE_MODEL_URL } from '../../data/assets'
import type { CreatureId } from '../../data/creatures'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'
import type { LoadedModel } from './creatureRig'
import '../assets/preloadModels'

const MODEL_URL: Readonly<Record<CreatureId, string>> = {
  crawler: CRAWLER_MODEL_URL,
  bride: BRIDE_MODEL_URL,
  hound: HOUND_MODEL_URL,
}

function WithModel({
  url,
  placeholder,
  children,
}: {
  url: string
  placeholder: boolean
  children: (m: LoadedModel) => ReactNode
}) {
  const g = useGLTF(url)
  return <>{children({ scene: g.scene, clips: g.animations, placeholder })}</>
}

/**
 * Draws nothing until the file probe answers, then the creature's own model if it exists or the
 * zombie model if it does not (the probe registers the missing path in the Waiting_List).
 */
export function CreatureModel({ id, children }: { id: CreatureId; children: (m: LoadedModel) => ReactNode }) {
  const url = MODEL_URL[id]
  const status = useAssetOrPlaceholder(url)
  if (status === 'checking') return null
  // PLACEHOLDER: /assets/models/enemies/crawler.glb (also bride.glb and hound.glb): zombie.glb scaled and tinted
  return status === 'present' ? (
    <WithModel url={url} placeholder={false}>
      {children}
    </WithModel>
  ) : (
    <WithModel url={ZOMBIE_MODEL_URL} placeholder>
      {children}
    </WithModel>
  )
}
