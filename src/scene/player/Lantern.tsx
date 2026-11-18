// Lantern: the player's light. Warm amber against the cold moonlight is the game's visual signature.
// Rendering only; fuel rules live in src/game/systems/lantern.ts and the flicker in lanternFlicker.ts.
// One shadow-casting spot (cage cookie) plus one shadowless fill, a flame and a glass that read the
// same flicker value in the same frame, and HDR colours so the global bloom picks up those two meshes.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SpotLight,
  Texture,
} from 'three'
import { Color as ThreeColor, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { useRapier } from '@react-three/rapier'
import { LANTERN_COOKIE_URL } from '../../data/assets'
import { LANTERN_GLARE_FULL_M, LANTERN_RADIUS_MAX_M, LANTERN_RADIUS_MIN_M } from '../../data/balance'
import { LANTERN_FLICKER, LANTERN_LIGHT } from '../../data/lanternLight'
import { useGameStore, useLanternStore, useSettingsStore } from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
import { lanternIntensity, lanternRadius, wallGlareScale } from '../../game/systems/lantern'
import { COOKIE_PLACEHOLDER_SIZE, softRoundCookie } from '../../game/systems/lanternCookie'
import { registerMissingArt } from '../../game/state/waitingList'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'
import { lanternAnchor } from '../../game/systems/lanternHand'
import {
  flickerIntensity,
  flickerParams,
  signalToFlame,
  signalToGlass,
  type FlickerParams,
} from '../../game/systems/lanternFlicker'
import { input } from './input'
import { LANTERN_ANCHORS, lanternHandRuntime, lanternLightRuntime } from './lanternRig'
import { scareRuntime } from '../scares/scareRuntime'

/** Candela scale for three's physical lighting; tuned by eye against fog. */
const SPOT_PEAK = 40
const FILL_PEAK = 1.5
const EMBER_INTENSITY = 1.2
/** The fill sits a little ahead of the glass so it lights the ground in front, not the hand. */
const FILL_AHEAD_M = 0.3
/** How fast the wall-glare dim follows the probe (per second); ~0.1 s to settle. */
const GLARE_EASE_PER_S = 10
const FLAME_RADIUS = 0.025
// Bloom is the scene's global threshold-1 pass (cheap). The flame and glass are pushed above 1 in HDR so they
// glow; a selective bloom pass cost about 4 ms a frame at 1080p (spec 11 task 6.7).
const FLAME_HDR = new ThreeColor(LANTERN_LIGHT.color).multiplyScalar(4)
const GLASS_BLOOM_BOOST = 4
const FLICKER_SEED = 7
/** Module scratch for the look direction, so the frame loop allocates nothing. */
const lookDir = new Vector3()

export function Lantern() {
  const rig = useRef<Group>(null)
  const spot = useRef<SpotLight>(null)
  const target = useRef<Object3D>(null)
  const fill = useRef<PointLight>(null)
  const ember = useRef<PointLight>(null)
  const flame = useRef<Mesh>(null)
  const glass = useRef<Mesh>(null)
  const { world, rapier } = useRapier()
  // One ray, reused every frame: no allocation in useFrame.
  const probe = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }))
  // Scare-zone sensors are not walls, and the kinematic player body must not dim its own lantern.
  const probeFlags =
    rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC
  const glare = useRef(1)
  const lowGraphics = useSettingsStore((s) => s.lowGraphics)
  const cookie = useRef<Texture | null>(null)
  const params = useRef<{ key: string; p: FlickerParams } | null>(null)
  const zeroAt = useRef<number | null>(null)
  const colorScratch = useMemo(() => new ThreeColor(), [])

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

  // The cage cookie. A missing or undecodable file is listed in the Waiting_List and a generated
  // soft round cookie stands in (Req 7.10). Low graphics drops the cookie but keeps the spot's
  // shadow (Req 7.15).
  const cookieStatus = useAssetOrPlaceholder(LANTERN_COOKIE_URL)
  useEffect(() => {
    if (cookieStatus === 'checking') return
    let alive = true
    const apply = (tex: Texture) => {
      cookie.current = tex
      if (spot.current) spot.current.map = lowGraphics ? null : tex
    }
    const placeholder = () => {
      // PLACEHOLDER: /assets/textures/lantern-cookie.png (a generated soft round falloff until the cage cookie lands)
      registerMissingArt(LANTERN_COOKIE_URL)
      const size = COOKIE_PLACEHOLDER_SIZE
      const tex = new DataTexture(softRoundCookie(size), size, size, RGBAFormat)
      tex.magFilter = tex.minFilter = LinearFilter
      tex.needsUpdate = true
      apply(tex)
    }
    if (cookie.current) {
      apply(cookie.current)
    } else if (cookieStatus === 'missing') {
      placeholder()
    } else {
      new TextureLoader().load(
        LANTERN_COOKIE_URL,
        (tex) => {
          if (!alive) return
          tex.colorSpace = SRGBColorSpace
          apply(tex)
        },
        undefined,
        () => alive && placeholder(),
      )
    }
    return () => {
      alive = false
    }
  }, [lowGraphics, cookieStatus])
  useFrame(({ camera }, delta) => {
    // Follow the camera by copy so the lights need not be reparented into the camera.
    rig.current?.position.copy(camera.position)
    rig.current?.quaternion.copy(camera.quaternion)

    const { on, fuel } = useLanternStore.getState()
    const empty = fuel <= 0
    // At exactly 0 oil the radius rule drops to the 1.5 m ember; the flare (or the Flashing-off
    // fade) carries on from the 2 m floor so it never starts with a 25% step.
    const level = on ? (empty ? LANTERN_RADIUS_MIN_M / LANTERN_RADIUS_MAX_M : lanternIntensity(fuel)) : 0
    const flashing = useSettingsStore.getState().flashingLights
    const sprinting = input.peek().sprint

    // One flicker value drives the spot, the fill, the flame and the glass (Req 7.11). Wall-clock
    // time: flicker is cosmetic, so it needn't follow the fixed-step sim.
    const nowS = performance.now() / 1000
    const key = `${Math.floor(fuel)}|${sprinting}|${flashing}`
    if (!params.current || params.current.key !== key) {
      params.current = {
        key,
        p: flickerParams({
          oil: fuel,
          sprinting,
          gust: false,
          flashingLights: flashing,
          seed: FLICKER_SEED,
        }),
      }
    }
    if (on && empty) zeroAt.current ??= nowS
    else zeroAt.current = null
    const zeroAge = zeroAt.current === null ? null : nowS - zeroAt.current
    let m = flickerIntensity(nowS, params.current.p, zeroAge)
    // Breath-behind telegraph: a strobe, or a steady dip when flashing lights are off.
    if (scareRuntime.flickerLeft > 0) {
      scareRuntime.flickerLeft = Math.max(0, scareRuntime.flickerLeft - delta)
      m *= scareRuntime.flickerStrobe ? (Math.sin(Date.now() * 0.05) > 0 ? 1 : 0.25) : 0.5
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

    // The light starts at the glass, or at the belt hook while the lantern is hooked (Req 7.8).
    const [ax, ay, az] = LANTERN_ANCHORS[lanternAnchor(lanternHandRuntime.hand.mode)]
    colorScratch.set(params.current.p.color)

    // Lights are never hidden: three.js builds its light state from visible lights, so toggling
    // `visible` changes the light count and recompiles every lit material. Off is intensity 0.
    // At oil 0 the beam lives on only for the single flare.
    // With Flashing lights off the flare is a slow fade (lanternFlicker), so the beam must live as
    // long as the fade or the light would drop in one frame when the 0.3 s flare window ends.
    const flareWindowS = params.current.p.lowPass ? LANTERN_FLICKER.fadeOutS : LANTERN_LIGHT.flareS
    const flaring = on && zeroAge !== null && zeroAge < flareWindowS
    const beam = on && (!empty || flaring)
    const k = level * m * glare.current
    if (spot.current) {
      spot.current.position.set(ax, ay, az)
      spot.current.color.copy(colorScratch)
      spot.current.intensity = beam ? SPOT_PEAK * k : 0
      // A dark beam needs no shadow redraw; this skips the pass without touching the light count.
      spot.current.shadow.autoUpdate = beam
      spot.current.distance = lanternRadius(fuel) * 2
    }
    if (fill.current) {
      fill.current.position.set(ax, ay, az - FILL_AHEAD_M)
      fill.current.color.copy(colorScratch)
      fill.current.intensity = beam ? FILL_PEAK * k : 0
      fill.current.distance = Math.min(lanternRadius(fuel), LANTERN_LIGHT.fillRadius)
    }
    if (ember.current) {
      // Once the flare is over the beam gives way to a dim non-shadowing glow so the world is never
      // fully black.
      ember.current.position.set(ax, ay, az)
      ember.current.intensity = on && empty && !beam ? EMBER_INTENSITY : 0
      ember.current.distance = lanternRadius(0)
    }

    // Flame and glass from the same value in the same frame (Req 7.11).
    if (flame.current) {
      flame.current.position.set(ax, ay, az)
      flame.current.scale.setScalar(beam ? signalToFlame(m) : 0)
    }
    if (glass.current) {
      glass.current.position.set(ax, ay, az)
      const mat = glass.current.material as MeshStandardMaterial
      mat.emissiveIntensity = beam ? signalToGlass(m) : 0
      mat.emissive.copy(colorScratch).multiplyScalar(GLASS_BLOOM_BOOST)
    }

    // Mirror of this frame for the Debug_Hook (read-only outside this file).
    const rt = lanternLightRuntime
    rt.signal = m
    rt.gutterAmp = params.current.p.gutterAmp
    rt.color = params.current.p.color
    rt.lowPass = params.current.p.lowPass
    rt.beam = beam
    rt.zeroAge = zeroAge
    rt.spotIntensity = spot.current?.intensity ?? 0
    rt.fillIntensity = fill.current?.intensity ?? 0
    rt.emberIntensity = ember.current?.intensity ?? 0
    rt.flameScale = flame.current?.scale.x ?? 0
    rt.glassEmissive = glass.current ? (glass.current.material as MeshStandardMaterial).emissiveIntensity : 0
    rt.anchor = lanternAnchor(lanternHandRuntime.hand.mode)
    rt.spotPosition = [ax, ay, az]
    rt.hasCookie = spot.current?.map != null
    rt.castsShadow = spot.current?.castShadow ?? false
    rt.shadowMapSize = spot.current?.shadow.mapSize.x ?? 0
    rt.shadowAutoUpdate = spot.current?.shadow.autoUpdate ?? false
  })

  return (
    <group ref={rig}>
      {/* Shadow budget: this SpotLight is slot 1 of 4 maximum */}
      <spotLight
        ref={spot}
        color={LANTERN_LIGHT.color}
        angle={0.9}
        penumbra={0.6}
        decay={2}
        castShadow
        shadow-mapSize={[LANTERN_LIGHT.shadowMap, LANTERN_LIGHT.shadowMap]}
        distance={LANTERN_RADIUS_MAX_M * 2}
      />
      <object3D ref={target} position={[0, 0, -1]} />
      <pointLight ref={fill} color={LANTERN_LIGHT.color} decay={2} />
      <pointLight ref={ember} color={LANTERN_LIGHT.color} decay={2} />
      {/* Flame and glass are the lantern's HDR emissives (Req 7.16, see FLAME_HDR). */}
        <mesh ref={flame}>
          <sphereGeometry args={[FLAME_RADIUS, 12, 8]} />
          {/* toneMapped off so the flame stays bright enough to bloom. */}
          <meshBasicMaterial color={FLAME_HDR} toneMapped={false} />
        </mesh>
        <mesh ref={glass}>
          <sphereGeometry args={[FLAME_RADIUS * 2.2, 12, 8]} />
          <meshStandardMaterial
            color="#2a1d10"
            emissive={LANTERN_LIGHT.color}
            emissiveIntensity={0}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
    </group>
  )
}
