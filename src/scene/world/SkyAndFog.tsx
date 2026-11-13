// Sky, fog and light blending across day phases. Rendering only; palette lives in data/skyPalette.ts.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2, SRGBColorSpace } from 'three'
import type { AmbientLight, DirectionalLight, Scene } from 'three'
import { MOON_COLOR, MOON_POSITION, SKY_LOOKS } from '../../data/skyPalette'
import { useSettingsStore } from '../../game/state/settingsStore'
import { INTERIOR_FOG, easeInterior, interiorFogLook, isInterior } from '../../game/systems/interiorFog'
import { playerPositionRef } from './playerPositionRef'
import { useWorldStore } from '../../game/state'
import { stormRuntime } from '../../game/state/stormRuntime'
import {
  ambientFlashFactor,
  flashTint,
  moonFlashFactor,
  stormFogDensity,
} from '../../game/systems/stormLight'
import {
  lerpBlend,
  targetBlend,
  transitionProgress,
  type SkyBlend,
} from '../../game/systems/skyTransition'

// The scene's fog colour is linear; the tint is written in sRGB like every palette colour.
const INTERIOR_TINT_LINEAR = (() => {
  const c = new Color().setRGB(...INTERIOR_FOG.tint, SRGBColorSpace)
  return [c.r, c.g, c.b] as const
})()

/** Half the width of the moon's shadow box around the player, metres. */
const MOON_SHADOW_HALF_M = 14
const MOON_SHADOW_SNAP_M = 0.5

// Scene mutation lives in plain functions: three.js objects are mutable by design.
function installSkyAndFog(scene: Scene, density: number): void {
  scene.fog = new FogExp2(0x000000, density)
  scene.background = new Color()
}

function removeSkyAndFog(scene: Scene): void {
  scene.fog = null
  scene.background = null
}

// hexToRgb yields sRGB values; setRGB defaults to linear, which washes everything out pale.
function applySky(scene: Scene, blend: SkyBlend): void {
  if (scene.background instanceof Color) scene.background.setRGB(...blend.sky, SRGBColorSpace)
  if (scene.fog instanceof FogExp2) {
    scene.fog.color.setRGB(...blend.sky, SRGBColorSpace)
    scene.fog.density = blend.fogDensity
  }
}

/** Closes the fog in and warms it by `amount` (0 outside, 1 inside), on top of this frame's sky. */
function applyInterior(scene: Scene, amount: number): void {
  if (amount <= 0 || !(scene.fog instanceof FogExp2)) return
  const fog = scene.fog
  const look = interiorFogLook(fog.density, [fog.color.r, fog.color.g, fog.color.b], amount, INTERIOR_TINT_LINEAR)
  fog.density = look.density
  fog.color.setRGB(look.color[0], look.color[1], look.color[2])
}

export function SkyAndFog() {
  const scene = useThree((s) => s.scene)
  const phase = useWorldStore((s) => s.phase)
  const fogDensity = useWorldStore((s) => s.fogDensity)
  // Low graphics turns the moon's shadows off (a second shadow pass through the whole scene).
  const moonShadows = !useSettingsStore((s) => s.lowGraphics)
  const interior = useRef(0)

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

    // Lightning and storm fog are applied on top of the blend each frame; the stored blend and the
    // world store's fogDensity stay untouched, so nothing sticks when the storm ends.
    const level = stormRuntime.flashLevel
    applySky(scene, {
      ...blend,
      sky: flashTint(blend.sky, level),
      fogDensity: stormFogDensity(blend.fogDensity, stormRuntime.storm.active),
    })
    if (ambient.current) {
      ambient.current.color.setRGB(...blend.ambientColor, SRGBColorSpace)
      ambient.current.intensity = blend.ambientIntensity * ambientFlashFactor(level)
    }
    if (moon.current) {
      moon.current.intensity = blend.moonIntensity * moonFlashFactor(level)
      // A tight shadow box around the player, snapped to a half metre so the shadows never shimmer.
      const p = playerPositionRef.current
      const sx = Math.round(p.x / MOON_SHADOW_SNAP_M) * MOON_SHADOW_SNAP_M
      const sz = Math.round(p.z / MOON_SHADOW_SNAP_M) * MOON_SHADOW_SNAP_M
      moon.current.position.set(sx + MOON_POSITION[0], MOON_POSITION[1], sz + MOON_POSITION[2])
      moon.current.target.position.set(sx, 0, sz)
      moon.current.target.updateMatrixWorld()
    }

    // Inside the chapel the fog closes in and warms, so the far end of the room falls into darkness.
    interior.current = easeInterior(interior.current, isInterior(playerPositionRef.current.x, playerPositionRef.current.z) ? 1 : 0, delta)
    applyInterior(scene, interior.current)
  })

  const start = SKY_LOOKS[phase]
  return (
    <>
      <ambientLight ref={ambient} color={start.ambientColor} intensity={start.ambientIntensity} />
      {/* Shadow budget is 4 lights: the lantern and the moon. The moon's box is tight around the player. */}
      <directionalLight
        ref={moon}
        color={MOON_COLOR}
        position={[...MOON_POSITION]}
        intensity={start.moonIntensity}
        castShadow={moonShadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-MOON_SHADOW_HALF_M}
        shadow-camera-right={MOON_SHADOW_HALF_M}
        shadow-camera-top={MOON_SHADOW_HALF_M}
        shadow-camera-bottom={-MOON_SHADOW_HALF_M}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}
