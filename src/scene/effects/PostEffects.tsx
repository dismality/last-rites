// Post-processing stack: grain, soft bloom on bright flames, vignette for dread.

import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'

export function PostEffects() {
  return (
    <EffectComposer>
      {/* Full-strength noise buried the scene in static; keep it a subtle grain. */}
      <Noise premultiplied opacity={0.12} />
      <Bloom luminanceThreshold={0.9} intensity={0.4} mipmapBlur />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  )
}
