// Post-processing stack: grain, soft bloom on bright flames, vignette for dread.

import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'

export function PostEffects() {
  return (
    <EffectComposer>
      <Noise premultiplied />
      <Bloom luminanceThreshold={0.9} intensity={0.4} mipmapBlur />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  )
}
