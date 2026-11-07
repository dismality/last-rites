// Lantern: the player's light. Warm amber against the cold moonlight is the game's visual signature.
// Rendering only; fuel/flicker rules live in src/game/systems/lantern.ts.

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Object3D, PointLight, SpotLight } from 'three'
import { LANTERN_RADIUS_MAX_M } from '../../data/balance'
import { useGameStore, useLanternStore, useSettingsStore } from '../../game/state'
import { lanternIntensity, lanternRadius } from '../../game/systems/lantern'

const AMBER = '#e8913a'
/** Candela scale for three's physical lighting; tuned by eye against fog. */
const SPOT_PEAK = 40
const FILL_PEAK = 1.5
const EMBER_INTENSITY = 1.2
/** Flicker swings intensity between 50% and 100%. */
const FLICKER_DEPTH = 0.5
const EYE_FORWARD_OFFSET = 0.3

export function Lantern() {
  const rig = useRef<Group>(null)
  const spot = useRef<SpotLight>(null)
  const target = useRef<Object3D>(null)
  const fill = useRef<PointLight>(null)
  const ember = useRef<PointLight>(null)

  // Toggle on keydown only (ignore auto-repeat), and never while paused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || useGameStore.getState().paused || useGameStore.getState().examining) return
      if (e.code !== useSettingsStore.getState().bindings.Lantern) return
      const { on, setOn } = useLanternStore.getState()
      setOn(!on)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (spot.current && target.current) spot.current.target = target.current
  }, [])

  useFrame(({ camera }) => {
    // Follow the camera by copy so the lights need not be reparented into the camera.
    rig.current?.position.copy(camera.position)
    rig.current?.quaternion.copy(camera.quaternion)

    const { on, fuel, flicker } = useLanternStore.getState()
    const empty = fuel <= 0
    const level = on ? lanternIntensity(fuel) : 0
    // Wall-clock time: flicker is purely cosmetic, so it needn't follow the fixed-step sim.
    const wave = flicker ? 1 - FLICKER_DEPTH * (0.5 + 0.5 * Math.sin(Date.now() * 0.01)) : 1
    const k = level * wave

    if (spot.current) {
      spot.current.visible = on && !empty
      spot.current.intensity = SPOT_PEAK * k
      spot.current.distance = lanternRadius(fuel) * 2
    }
    if (fill.current) {
      fill.current.visible = on && !empty
      fill.current.intensity = FILL_PEAK * k
      fill.current.distance = lanternRadius(fuel)
    }
    if (ember.current) {
      // At empty the beam is swapped for a dim non-shadowing glow so the world is never fully black.
      ember.current.visible = on && empty
      ember.current.intensity = EMBER_INTENSITY * wave
      ember.current.distance = lanternRadius(0)
    }
  })

  return (
    <group ref={rig}>
      {/* Shadow budget: this SpotLight is slot 1 of 4 maximum */}
      <spotLight
        ref={spot}
        color={AMBER}
        angle={0.9}
        penumbra={0.6}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        distance={LANTERN_RADIUS_MAX_M * 2}
      />
      <object3D ref={target} position={[0, 0, -1]} />
      <pointLight ref={fill} color={AMBER} decay={2} position={[0, 0, -EYE_FORWARD_OFFSET]} />
      <pointLight ref={ember} color={AMBER} decay={2} />
    </group>
  )
}
