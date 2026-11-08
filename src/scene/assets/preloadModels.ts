// One place that configures glTF loading and warms the cache.
// Importing this module points drei's Draco loader at the self-hosted decoder,
// so every useGLTF call in the app (world, hero items, examine) stays off CDNs.

import { useGLTF } from '@react-three/drei'
import { DRACO_PATH, allModelUrls } from '../../data/assets'

useGLTF.setDecoderPath(DRACO_PATH)

let started = false

/**
 * Starts loading every model. Calls go through three's default loading manager,
 * which is what drei's useProgress (the loading screen bar) listens to.
 * Safe to call repeatedly.
 */
export function preloadAllModels(): void {
  if (started) return
  started = true
  for (const url of allModelUrls()) useGLTF.preload(url, DRACO_PATH)
}
