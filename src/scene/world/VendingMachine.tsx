// The hut's vending machine, the "Hollowmere Automatic Dispenser" (spec 11 H6). Interact within
// 2.5 m opens the vending panel in every phase. A purchase pulls the row's handle out 5 cm and
// springs it back, then the goods drop into the tray; the handle and tray sounds play from the
// machine. The marquee glass is emissive in the model; one small warm shadowless light sits at
// `marquee-light` and is dimmed to 0 while the frame budget or the shadow-light cap does not hold
// (the light itself is always mounted: a changing light count recompiles every material).
// Colliders are in hut.json (Hut.tsx). Mount inside the hut group.

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, Light, PointLight } from 'three'
import { DRACO_PATH, VENDING_MACHINE_MODEL_URL } from '../../data/assets'
import { VENDING_MACHINE } from '../../data/hutScenery'
import {
  VENDING_ANCHORS,
  VENDING_BOX,
  VENDING_LIGHT_FRAME_BUDGET_MS,
  VENDING_LIGHT_SHADOW_CAP,
  VENDING_MARQUEE_LIGHT,
  VENDING_PURCHASE_S,
  VENDING_TRAY_DROP_S,
  VENDING_TRAY_SHOW_S,
  VENDING_ROWS,
} from '../../data/vending'
import { emitCombatSound } from '../../game/state/combatSounds'
import { isSimFrozen } from '../../game/state/menuState'
import { VENDING_SOUND_AT, openVending } from '../../game/state/vendingActions'
import { useVendingStore } from '../../game/state/vendingStore'
import { purchaseAnimation } from '../../game/systems/vending'
import { PlaceholderMesh } from '../assets/PlaceholderMesh'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'
import '../assets/preloadModels'
import { Interactable } from './Interactable'
import { ItemMesh } from './ItemModel'

const BRASS = '#b08a3e'
/** Smoothing of the frame-time average that gates the marquee light (per frame). */
const FRAME_EMA = 0.05
/** How often the scene's shadow-casting lights are counted (s). */
const SHADOW_CENSUS_S = 1

function VendingModel() {
  const scene = useGLTF(VENDING_MACHINE_MODEL_URL, DRACO_PATH).scene
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if ('isMesh' in o) o.receiveShadow = true
    })
  }, [scene])
  return <Clone ref={ref} object={scene} />
}

/** The cabinet: the real model, or a plain box with the real collider size while it is missing. */
function Cabinet() {
  const status = useAssetOrPlaceholder(VENDING_MACHINE_MODEL_URL)
  const [hx, hy, hz] = VENDING_BOX.half
  // PLACEHOLDER: /assets/models/props/vending-machine.glb (a plain cabinet with the real box and anchors)
  const placeholder = (
    <PlaceholderMesh path={VENDING_MACHINE_MODEL_URL} shape="cabinet" name="Vending machine (placeholder)" size={[hx * 2, hy * 2, hz * 2]} color="#3a2f28">
      <mesh position={[...VENDING_ANCHORS.marqueeLight]}>
        <boxGeometry args={[0.6, 0.16, 0.02]} />
        <meshStandardMaterial color="#2a1a0c" emissive="#da8a45" emissiveIntensity={1.2} />
      </mesh>
    </PlaceholderMesh>
  )
  if (status === 'missing') return placeholder
  if (status === 'checking') return null
  return (
    <Suspense fallback={null}>
      <VendingModel />
    </Suspense>
  )
}

/** Five handle knobs the purchase animation moves along +Z (model space). */
function Handles({ offsets }: { offsets: React.RefObject<(Group | null)[]> }) {
  return (
    <>
      {VENDING_ANCHORS.handles.map((p, i) => (
        // PLACEHOLDER: /assets/models/props/vending-machine.glb (its handles are merged into the brass mesh, so these knobs stand in until they are separate)
        <group key={i} position={[...p]} ref={(g) => void (offsets.current[i] = g)} name={`handle-${i}`}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.015]}>
            <cylinderGeometry args={[0.012, 0.012, 0.03, 8]} />
            <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function VendingMachine() {
  const lastPurchase = useVendingStore((s) => s.lastPurchase)
  const handles = useRef<(Group | null)[]>([])
  // The goods in the tray are mounted only while they show (a dev label would outlive `visible`).
  const [trayShown, setTrayShown] = useState(false)
  const light = useRef<PointLight>(null)
  const anim = useRef({ seq: 0, t: Number.POSITIVE_INFINITY, handle: 0, trayPlayed: true })
  const frameMs = useRef(0)
  const shadowLights = useRef(0)
  const census = useRef(0)
  const scene = useThree((s) => s.scene)

  // A new purchase restarts the animation (the store's seq goes up even for the same row).
  useEffect(() => {
    if (!lastPurchase || lastPurchase.seq === anim.current.seq) return
    anim.current = { seq: lastPurchase.seq, t: 0, handle: lastPurchase.handle, trayPlayed: false }
    emitCombatSound('vending-handle', VENDING_SOUND_AT)
  }, [lastPurchase])

  useFrame((_, delta) => {
    // Marquee light gate: mean frame time and the live shadow-light count.
    frameMs.current += (delta * 1000 - frameMs.current) * FRAME_EMA
    census.current -= delta
    if (census.current <= 0) {
      census.current = SHADOW_CENSUS_S
      let n = 0
      scene.traverse((o) => {
        if ((o as Light).isLight && o.visible && (o as Light).castShadow) n++
      })
      shadowLights.current = n
    }
    if (light.current) {
      const ok = frameMs.current <= VENDING_LIGHT_FRAME_BUDGET_MS && shadowLights.current <= VENDING_LIGHT_SHADOW_CAP
      light.current.intensity = ok ? VENDING_MARQUEE_LIGHT.intensity : 0
    }

    // Purchase: the handle and the tray follow sim time, so pause holds them.
    const a = anim.current
    if (a.t === Number.POSITIVE_INFINITY) return
    if (!isSimFrozen()) a.t += delta
    handles.current.forEach((g, i) => {
      if (g) g.position.z = VENDING_ANCHORS.handles[i][2] + (i === a.handle ? purchaseAnimation(a.t) : 0)
    })
    if (!a.trayPlayed && a.t >= VENDING_TRAY_DROP_S) {
      a.trayPlayed = true
      emitCombatSound('vending-tray', VENDING_SOUND_AT)
    }
    const shown = a.t >= VENDING_TRAY_DROP_S && a.t < VENDING_TRAY_DROP_S + VENDING_TRAY_SHOW_S
    if (shown !== trayShown) setTrayShown(shown)
    if (a.t > Math.max(VENDING_PURCHASE_S, VENDING_TRAY_DROP_S + VENDING_TRAY_SHOW_S)) {
      a.t = Number.POSITIVE_INFINITY
      if (trayShown) setTrayShown(false)
    }
  })

  const bought = lastPurchase ? VENDING_ROWS.find((r) => r.id === lastPurchase.row) : undefined
  const hy = VENDING_BOX.half[1]

  return (
    <group position={[...VENDING_MACHINE.position]} rotation={[0, VENDING_MACHINE.rotationY, 0]} name="vending-machine">
      <Interactable kind="vending" id="vending" runeHeight={hy * 2 + 0.3} onInteract={openVending}>
        <Cabinet />
      </Interactable>
      <Handles offsets={handles} />
      <group position={[...VENDING_ANCHORS.tray]} name="vending-tray-goods">
        {bought && trayShown && (
          <Suspense fallback={null}>
            <ItemMesh item={bought.item} />
          </Suspense>
        )}
      </group>
      <pointLight
        ref={light}
        position={[...VENDING_ANCHORS.marqueeLight]}
        color={VENDING_MARQUEE_LIGHT.color}
        intensity={VENDING_MARQUEE_LIGHT.intensity}
        distance={VENDING_MARQUEE_LIGHT.distance}
        decay={2}
      />
    </group>
  )
}
