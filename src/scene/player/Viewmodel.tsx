// Viewmodel — first-person hands and equipped weapon rendered in the lower
// portion of the screen.
//
// Crack visual (Req 5.3): when the active weapon's durability drops below 20%
// of its maximum, a crack overlay is composited over the viewmodel mesh.
// The overlay's opacity scales with how far below the 20% threshold the player
// is — subtle at 19%, obvious at 0 durability.
//
// Architecture: this component reads durability from the player store (to be
// wired in a later task) and is pure rendering — no game logic lives here.

import { useRef, useMemo, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, useInventoryStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { tickHeadBob, type BobState } from '../../game/systems/movement'
import { hotbarItem } from '../../game/systems/satchel'
import {
  SWAP_LOWER_DISTANCE,
  SWAP_LOWER_TILT,
  SWAY_REST,
  createSwapState,
  swapEase,
  tickSway,
  tickSwap,
  viewmodelBob,
  type SwapState,
  type SwayState,
} from '../../game/systems/viewmodel'
import type { ItemId } from '../../game/types'
import { input } from './input'
import { meleeRuntime } from './meleeRuntime'
import { isCracked } from '../../game/systems/durability'
import type { WeaponState } from '../../game/systems/durability'
import { WEAPON_MAP } from '../../data/weapons'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewmodelProps {
  /**
   * Runtime weapon state for the currently equipped item.
   * Pass null when no weapon is equipped (should not happen in normal play —
   * the player always has the rusty-shovel).
   */
  weaponState: WeaponState | null
}

// ---------------------------------------------------------------------------
// Crack opacity helper
// ---------------------------------------------------------------------------

/**
 * Map the weapon's durability to a crack overlay opacity.
 *
 * - At or above 20% durability → 0 (no cracks).
 * - Exactly 0 durability      → 1 (full-intensity cracks).
 * - Between 1% and 20%        → linear interpolation.
 */
function crackOpacity(weaponState: WeaponState): number {
  const { durability, id } = weaponState
  if (durability === null) return 0

  const def = WEAPON_MAP[id]
  const max = def.durability
  if (max === null || max === 0) return 0

  const fraction = durability / max
  if (fraction >= 0.2) return 0

  // Linear ramp: 0 at 20%, 1 at 0%.
  return 1 - fraction / 0.2
}

// ---------------------------------------------------------------------------
// ViewmodelMesh
// ---------------------------------------------------------------------------

/**
 * The physical mesh representing the player's hands and weapon.
 * Currently a placeholder low-poly box; this will be replaced with a proper
 * GLTF viewmodel in a later art pass.
 */
const HELD_POSITION: [number, number, number] = [0.22, -0.18, -0.4]
const HELD_ROTATION: [number, number, number] = [0.1, -0.15, 0]
/** Cylinders stand along Y; this lays them along the view axis (-Z is away from the player). */
const ALONG_Z: [number, number, number] = [Math.PI / 2, 0, 0]

/** Wooden shaft with a flat blade at the far end. Sharpened: paler steel and a pointed tip. */
function ShovelMesh({ sharpened }: { sharpened: boolean }) {
  const steel = sharpened ? '#9aa3ab' : '#6b5a4a'
  return (
    <group position={HELD_POSITION} rotation={HELD_ROTATION}>
      <mesh rotation={ALONG_Z}>
        <cylinderGeometry args={[0.014, 0.016, 0.5, 8]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} />
      </mesh>
      {/* D-grip at the near end */}
      <mesh position={[0, 0, 0.25]}>
        <boxGeometry args={[0.08, 0.018, 0.018]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[0.11, 0.012, 0.13]} />
        <meshStandardMaterial color={steel} roughness={0.55} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, -0.385]} rotation={[-Math.PI / 2, Math.PI / 4, 0]} scale={[1, 1, sharpened ? 1.4 : 0.6]}>
        <coneGeometry args={[0.078, 0.07, 4]} />
        <meshStandardMaterial color={steel} roughness={0.55} metalness={0.6} />
      </mesh>
    </group>
  )
}

/** A thigh bone: tapered shaft, a heavy knob at the striking end, a small knob at the grip. */
function BoneClubMesh() {
  const bone = '#d8d2c0'
  return (
    <group position={HELD_POSITION} rotation={HELD_ROTATION}>
      <mesh rotation={ALONG_Z}>
        <cylinderGeometry args={[0.03, 0.017, 0.42, 8]} />
        <meshStandardMaterial color={bone} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.22]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color={bone} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.21]}>
        <sphereGeometry args={[0.026, 8, 6]} />
        <meshStandardMaterial color={bone} roughness={0.9} />
      </mesh>
      {/* Cloth wrap on the grip */}
      <mesh position={[0, 0, 0.12]} rotation={ALONG_Z}>
        <cylinderGeometry args={[0.024, 0.024, 0.12, 8]} />
        <meshStandardMaterial color="#6e6048" roughness={1} />
      </mesh>
    </group>
  )
}

function ViewmodelMesh({ item }: { item: ItemId | null }) {
  if (item === 'rusty-shovel') return <ShovelMesh sharpened={false} />
  if (item === 'sharpened-shovel') return <ShovelMesh sharpened />
  if (item === 'bone-club') return <BoneClubMesh />
  return (
    <mesh position={HELD_POSITION} rotation={HELD_ROTATION}>
      {/* Stand-in for items without their own held model (flasks, bandages, ...). */}
      <boxGeometry args={[0.06, 0.06, 0.45]} />
      <meshStandardMaterial color="#5c3d1e" roughness={0.9} metalness={0} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// CrackOverlay
// ---------------------------------------------------------------------------

interface CrackOverlayProps {
  opacity: number
}

/**
 * A transparent plane composited over the viewmodel mesh that shows procedural
 * crack detail using a line-based pattern when opacity > 0.
 *
 * The cracks are built from a few diagonal planes so no texture asset is needed.
 * Bloom in the post-processing chain will pick up the emissive crack lines
 * and give them a subtle glow.
 */
function CrackOverlay({ opacity }: CrackOverlayProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  // Animate a slight flicker to make the cracks feel organic.
  const flickerRef = useRef(0)
  useFrame((_, delta) => {
    flickerRef.current += delta
    if (matRef.current) {
      const flicker = 0.85 + Math.sin(flickerRef.current * 7.3) * 0.1
      matRef.current.opacity = opacity * flicker
    }
  })

  if (opacity <= 0) return null

  return (
    <group position={[0.22, -0.18, -0.395]}>
      {/* Main crack plane — sits just in front of the weapon mesh. */}
      <mesh rotation={[0.1, -0.15, 0]}>
        <planeGeometry args={[0.08, 0.48]} />
        <meshStandardMaterial
          ref={matRef}
          color="#c0392b"
          emissive="#7a1f1f"
          emissiveIntensity={0.4}
          transparent
          opacity={opacity}
          depthWrite={false}
          wireframe
        />
      </mesh>
    </group>
  )
}

function syncCamera(camera: THREE.PerspectiveCamera, fov: number, aspect: number): void {
  if (camera.fov === fov && camera.aspect === aspect) return
  camera.fov = fov
  camera.aspect = aspect
  camera.updateProjectionMatrix()
}

// ---------------------------------------------------------------------------
// Viewmodel (main export)
// ---------------------------------------------------------------------------

/**
 * Mount anywhere inside the R3F <Canvas>.
 *
 * The item lives in its own scene with its own camera, drawn after the world
 * with the depth buffer cleared. That way it can never clip into walls or
 * headstones (Req 1.1) and the world camera's near plane stays generous.
 *
 * Runs at useFrame priority 2, after the EffectComposer (priority 1) has drawn
 * the world. Mount it together with <PostEffects />; on its own nothing draws
 * the world. The viewmodel therefore skips bloom/vignette, which is fine for a held prop.
 */
export function Viewmodel({ weaponState }: ViewmodelProps) {
  const opacity = useMemo(
    () => (weaponState ? crackOpacity(weaponState) : 0),
    [weaponState],
  )
  const cracked = weaponState ? isCracked(weaponState) : false

  const size = useThree((s) => s.size)

  const scene = useMemo(() => new THREE.Scene(), [])
  const camera = useMemo(() => new THREE.PerspectiveCamera(75, 1, 0.01, 5), [])
  const rig = useRef<THREE.Group>(null)
  const itemGroup = useRef<THREE.Group>(null)
  // What is drawn follows the swap (not the hotbar), so the old item lowers before the new one rises.
  const [shownItem, setShownItem] = useState<ItemId | null>(null)

  const swap = useRef<SwapState | null>(null)
  const sway = useRef<SwayState>(SWAY_REST)
  const bob = useRef<BobState>({ phase: 0, amplitude: 0 })
  const lastLook = useRef<{ yaw: number; pitch: number } | null>(null)

  useFrame((state, rawDelta) => {
    const settings = useSettingsStore.getState()
    const inv = useInventoryStore.getState()
    const target: ItemId | null =
      inv.equippedSlot === null ? null : hotbarItem(inv.inventory, inv.equippedSlot)
    // Start with whatever is in hand so the first frame doesn't play a swap.
    swap.current ??= createSwapState(target)

    // Keep the viewmodel FOV in step with the setting and window size.
    const aspect = size.width / size.height
    syncCamera(camera, settings.fov, aspect)

    const gs = useGameStore.getState()
    const frozen = gs.paused || gs.examining || gs.journalOpen
    const dt = frozen ? 0 : Math.min(rawDelta, 0.1)

    if (dt > 0) {
      const player = usePlayerStore.getState()
      const snap = input.peek()
      const moving = snap.forward !== 0 || snap.strafe !== 0

      const prev = lastLook.current
      // First frame has no previous angle; treat it as no movement.
      const dYaw = prev ? player.yaw - prev.yaw : 0
      const dPitch = prev ? player.pitch - prev.pitch : 0
      lastLook.current = { yaw: player.yaw, pitch: player.pitch }

      swap.current = tickSwap(swap.current, target, dt)
      sway.current = tickSway(sway.current, dYaw, dPitch, dt)
      bob.current = tickHeadBob(bob.current, dt, moving, settings.headBob)
    }

    const g = rig.current
    if (g) {
      const lowered = swapEase(swap.current.progress)
      const b = viewmodelBob(bob.current)
      const sw = meleeRuntime.pose
      g.position.set(
        sway.current.x + b.x + sw.x,
        sway.current.y + b.y + sw.y - lowered * SWAP_LOWER_DISTANCE,
        sw.z,
      )
      g.rotation.set(-lowered * SWAP_LOWER_TILT - sw.rotX, 0, sw.rotZ)
    }
    // Nothing is drawn while the slot is empty or mid-swap-to-nothing.
    if (itemGroup.current) itemGroup.current.visible = swap.current.shown !== null
    setShownItem((cur) => (cur === swap.current?.shown ? cur : (swap.current?.shown ?? null)))
    // The ending camera is not the player's eyes, so no hands in shot.
    if (gs.screen === 'ending') return

    // The EffectComposer (priority 1) has already drawn the world to the screen.
    // Draw the viewmodel over it with a cleared depth buffer so it never clips into walls.
    const { gl } = state
    gl.autoClear = false
    gl.clearDepth()
    gl.render(scene, camera)
    gl.autoClear = true
  }, 2)

  return createPortal(
    <>
      {/* The portal scene gets none of the world's lights, so give it a faint warm key. */}
      <ambientLight intensity={0.6} color="#9fb3c8" />
      <directionalLight position={[0.5, 1, 1]} intensity={1.2} color="#e8913a" />
      <group ref={rig} name="viewmodel">
        <group ref={itemGroup}>
          <ViewmodelMesh item={shownItem} />
          {cracked && <CrackOverlay opacity={opacity} />}
        </group>
      </group>
    </>,
    scene
  )
}
