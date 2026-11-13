// Post-processing stack (spec 09 task 11n-a): ambient occlusion, bloom on emissives only, AgX tone
// mapping, vignette for dread and a subtle grain. Order matters: the occlusion and the bloom work on
// the raw HDR image, tone mapping then brings it to the screen, and the vignette and grain go on top.
// Low graphics drops the occlusion (it re-renders the scene's depth); the rest is cheap.

import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useSettingsStore } from '../../game/state/settingsStore'

export function PostEffects() {
  const low = useSettingsStore((s) => s.lowGraphics)
  // Same child count either way would not help: a different composer is simpler, so key it.
  return (
    <EffectComposer key={low ? 'low' : 'high'}>
      {[
        // Low-intensity occlusion: pews, niches and bone walls read with depth without going muddy.
        ...(low
          ? []
          : [
              <N8AO
                key="ao"
                aoRadius={1.1}
                distanceFalloff={1}
                intensity={2}
                quality="low"
                halfRes
                color="black"
              />,
            ]),
        // Threshold 1: only emissive parts (flames, lantern glass, window glass) pass it, so the
        // scene itself is never washed out.
        <Bloom key="bloom" luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.5} mipmapBlur />,
        <ToneMapping key="tone" mode={ToneMappingMode.AGX} />,
        <Vignette key="vignette" offset={0.3} darkness={0.6} />,
        // Full-strength noise buried the scene in static; keep it a subtle grain.
        <Noise key="noise" premultiplied opacity={0.12} />,
      ]}
    </EffectComposer>
  )
}
