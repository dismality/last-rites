// MuzzleLight — one pooled point light that pops at the camera when a firearm goes off
// (Req 5.9, 21.2, 23.10). Never casts shadows (the lantern keeps the shadow budget) and is
// not rendered at all when Flashing lights is off. Viewmodel ages and prunes the events.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { useSettingsStore } from '../../game/state'
import { muzzleOpacity, muzzleProfile } from '../../game/systems/muzzleFlash'
import { weaponRuntime } from './weaponRuntime'

/** Peak light intensity and reach of the pop. */
const PEAK_INTENSITY = 6
const LIGHT_DISTANCE = 12
/** How far in front of the eye the light sits (m), so it washes the area ahead. */
const FORWARD_M = 0.8

export function MuzzleLight() {
  const flashing = useSettingsStore((s) => s.flashingLights)
  const ref = useRef<THREE.PointLight>(null)

  useFrame(() => {
    const light = ref.current
    if (!light) return
    const events = weaponRuntime.muzzleEvents
    const newest = events[events.length - 1]
    const a = newest ? muzzleOpacity(muzzleProfile(true), newest.ageS) : 0
    light.intensity = PEAK_INTENSITY * a
    const { position, direction } = weaponRuntime.camera
    light.position.set(
      position[0] + direction[0] * FORWARD_M,
      position[1] + direction[1] * FORWARD_M,
      position[2] + direction[2] * FORWARD_M,
    )
  })

  if (!flashing || !muzzleProfile(flashing).light) return null
  return (
    <pointLight
      ref={ref}
      color="#ffb860"
      intensity={0}
      distance={LIGHT_DISTANCE}
      decay={2}
      castShadow={false}
    />
  )
}
