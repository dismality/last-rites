// Sky, fog and light blending across day phases. Rendering only; palette lives in data/skyPalette.ts.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2 } from 'three'
import type { AmbientLight, DirectionalLight, Scene } from 'three'
import { MOON_COLOR, MOON_POSITION, SKY_LOOKS } from '../../data/skyPalette'
import { useWorldStore } from '../../game/state'
import {
  lerpBlend,
  targetBlend,
  transitionProgress,
  type SkyBlend,
} from '../../game/systems/skyTransition'

// Scene mutation lives in plain functions: three.js objects are mutable by design.
function installSkyAndFog(scene: Scene, density: number): void {
  scene.fog = new FogExp2(0x000000, density)
  scene.background = new Color()
}

function removeSkyAndFog(scene: Scene): void {
  scene.fog = null
  scene.background = null
}

function applySky(scene: Scene, blend: SkyBlend): void {
  if (scene.background instanceof Color) scene.background.setRGB(...blend.sky)
  if (scene.fog instanceof FogExp2) {
    scene.fog.color.setRGB(...blend.sky)
    scene.fog.density = blend.fogDensity
  }
}

export function SkyAndFog() {
  const scene = useThree((s) => s.scene)
  const phase = useWorldStore((s) => s.phase)
  const fogDensity = useWorldStore((s) => s.fogDensity)

  const ambient = useRef<AmbientLight>(null)
  const moon = useRef<DirectionalLight>(null)

  const initial = targetBlend(phase, fogDensity)
  const from = useRef<SkyBlend>(initial)
  const to = useRef<SkyBlend>(initial)
  const current = useRef<SkyBlend>(initial)
  const elapsed = useRef(0)

  // Own the fog and background so the phase lerp is the only thing writing them.
  useEffect(() => {
    installSkyAndFog(scene, fogDensity)
    return () => removeSkyAndFog(scene)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; density is driven in useFrame
  }, [scene])

  // Restart the blend from wherever we currently are so mid-transition changes don't pop.
  useEffect(() => {
    from.current = current.current
    to.current = targetBlend(phase, fogDensity)
    elapsed.current = 0
  }, [phase, fogDensity])

  useFrame((_, delta) => {
    elapsed.current += delta
    const blend = lerpBlend(from.current, to.current, transitionProgress(elapsed.current))
    current.current = blend

    applySky(scene, blend)
    if (ambient.current) {
      ambient.current.color.setRGB(...blend.ambientColor)
      ambient.current.intensity = blend.ambientIntensity
    }
    if (moon.current) moon.current.intensity = blend.moonIntensity
  })

  const start = SKY_LOOKS[phase]
  return (
    <>
      <ambientLight ref={ambient} color={start.ambientColor} intensity={start.ambientIntensity} />
      {/* No castShadow: shadow budget is 4 lights and the lantern is one of them. */}
      <directionalLight
        ref={moon}
        color={MOON_COLOR}
        position={[...MOON_POSITION]}
        intensity={start.moonIntensity}
      />
    </>
  )
}
