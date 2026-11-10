// Lantern: the player's light. Warm amber against the cold moonlight is the game's visual signature.
// Rendering only; fuel/flicker rules live in src/game/systems/lantern.ts.

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Object3D, PointLight, SpotLight } from 'three'
import { Vector3 } from 'three'
import { useRapier } from '@react-three/rapier'
import { LANTERN_GLARE_FULL_M, LANTERN_RADIUS_MAX_M } from '../../data/balance'
import { useGameStore, useLanternStore, useSettingsStore } from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
import { lanternIntensity, lanternRadius, wallGlareScale } from '../../game/systems/lantern'
import { scareRuntime } from '../scares/scareRuntime'

const AMBER = '#e8913a'
/** Candela scale for three's physical lighting; tuned by eye against fog. */
const SPOT_PEAK = 40
const FILL_PEAK = 1.5
const EMBER_INTENSITY = 1.2
/** Flicker swings intensity between 50% and 100%. */
const FLICKER_DEPTH = 0.5
const EYE_FORWARD_OFFSET = 0.3
/** How fast the wall-glare dim follows the probe (per second); ~0.1 s to settle. */
const GLARE_EASE_PER_S = 10
/** Module scratch for the look direction, so the frame loop allocates nothing. */
const lookDir = new Vector3()

export function Lantern() {
  const rig = useRef<Group>(null)
  const spot = useRef<SpotLight>(null)
  const target = useRef<Object3D>(null)
  const fill = useRef<PointLight>(null)
  const ember = useRef<PointLight>(null)
  const { world, rapier } = useRapier()
  // One ray, reused every frame: no allocation in useFrame.
  const probe = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }))
  // Scare-zone sensors are not walls, and the kinematic player body must not dim its own lantern.
  const probeFlags = rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC
  const glare = useRef(1)

  // Toggle on keydown only (ignore auto-repeat), and never while paused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || useGameStore.getState().paused || useGameStore.getState().examining) return
      if (useIntroStore.getState().playing) return
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

  useFrame(({ camera }, delta) => {
    // Follow the camera by copy so the lights need not be reparented into the camera.
    rig.current?.position.copy(camera.position)
    rig.current?.quaternion.copy(camera.quaternion)

    const { on, fuel, flicker } = useLanternStore.getState()
    const empty = fuel <= 0
    const level = on ? lanternIntensity(fuel) : 0
    // Wall-clock time: flicker is purely cosmetic, so it needn't follow the fixed-step sim.
    let wave = flicker ? 1 - FLICKER_DEPTH * (0.5 + 0.5 * Math.sin(Date.now() * 0.01)) : 1
    // Breath-behind telegraph: a strobe, or a steady dip when flashing lights are off.
    if (scareRuntime.flickerLeft > 0) {
      scareRuntime.flickerLeft = Math.max(0, scareRuntime.flickerLeft - delta)
      wave *= scareRuntime.flickerStrobe ? (Math.sin(Date.now() * 0.05) > 0 ? 1 : 0.25) : 0.5
    }
    // Wall glare (spec 09, B8): one Rapier ray ahead finds the nearest surface. The dim eases in
    // over a few frames so walking past a doorframe does not pop the light.
    let wallM = Infinity
    if (on && !empty) {
      camera.getWorldDirection(lookDir)
      probe.current.origin = camera.position
      probe.current.dir = lookDir
      const hit = world.castRay(probe.current, LANTERN_GLARE_FULL_M, true, probeFlags)
      if (hit) wallM = hit.timeOfImpact
    }
    glare.current += (wallGlareScale(wallM) - glare.current) * Math.min(1, delta * GLARE_EASE_PER_S)
    const k = level * wave * glare.current

    // The three lights are never hidden: three.js builds its light state from visible lights, so
    // toggling `visible` changes the light count and recompiles every lit material (a hitch when
    // the lantern is switched or runs dry). Off and empty are intensity 0 instead.
    const beam = on && !empty
    if (spot.current) {
      spot.current.intensity = beam ? SPOT_PEAK * k : 0
      // A dark beam needs no shadow redraw; this skips the pass without touching the light count.
      spot.current.shadow.autoUpdate = beam
      spot.current.distance = lanternRadius(fuel) * 2
    }
    if (fill.current) {
      fill.current.intensity = beam ? FILL_PEAK * k : 0
      fill.current.distance = lanternRadius(fuel)
    }
    if (ember.current) {
      // At empty the beam gives way to a dim non-shadowing glow so the world is never fully black.
      ember.current.intensity = on && empty ? EMBER_INTENSITY * wave : 0
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
