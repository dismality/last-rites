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

import { Suspense, useRef, useMemo, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, useInventoryStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
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
import { isCracked, maxDurability } from '../../game/systems/durability'
import type { WeaponState } from '../../game/systems/durability'
import { FIREARMS } from '../../data/firearms'
import { useCombatStore } from '../../game/state/combatStore'
import { heavyStatsFor } from '../../game/systems/heavyAttack'
import { muzzleOpacity, muzzleProfile } from '../../game/systems/muzzleFlash'
import {
  POSE_REST,
  addPoses,
  aimPose,
  firingKickPose,
  heavyChargePose,
  reloadPose,
  type WeaponPose,
} from '../../game/systems/viewmodel'
import { weaponRuntime } from './weaponRuntime'
import { WeaponMesh } from './viewmodelWeapons'
import { isHeldWeaponId } from './viewmodelWeaponGeometry'
import { HELD_GRIPS, HELD_ORIGIN, type HeldGrip } from '../../data/itemModels'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewmodelProps {
  /**
   * Runtime weapon state for the currently equipped item.
   * Pass null when no weapon is equipped (should not happen in normal play —
   * the player always has the rusty-shovel).
   */
  weaponState?: WeaponState | null
}

/** Durability of the shown item from the combat store, or null when it does not wear out. */
function durableState(item: ItemId | null): WeaponState | null {
  if (item !== 'bone-club' && item !== 'sharpened-shovel' && item !== 'wood-axe') return null
  const state = useCombatStore.getState()
  const durability = state.durability[item]
  return durability === undefined ? null : { id: item, durability }
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

  const max = maxDurability(id, useCombatStore.getState().upgrades)
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
const HELD_POSITION: [number, number, number] = [...HELD_ORIGIN.position]
const HELD_ROTATION: [number, number, number] = [...HELD_ORIGIN.rotation]

/**
 * Additive flash sprite at the barrel tip. Opacity is driven per frame by Viewmodel
 * (muzzleOpacity), so it is always mounted and simply hidden between shots.
 */
function MuzzleQuad({
  tip,
  quadRef,
}: {
  tip: readonly [number, number, number]
  quadRef: React.RefObject<THREE.Mesh | null>
}) {
  return (
    <mesh ref={quadRef} position={[tip[0], tip[1], tip[2]]} visible={false}>
      <circleGeometry args={[0.07, 12]} />
      <meshBasicMaterial
        color="#ffcf7a"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function ViewmodelMesh({
  item,
  muzzleRef,
}: {
  item: ItemId | null
  muzzleRef: React.RefObject<THREE.Mesh | null>
}) {
  if (isHeldWeaponId(item)) {
    const grip: HeldGrip = HELD_GRIPS[item]
    return (
      <group position={HELD_POSITION} rotation={HELD_ROTATION}>
        {/* Preloaded, so this rarely suspends; nothing is drawn for the frame it does. */}
        <Suspense fallback={null}>
          <WeaponMesh id={item} />
        </Suspense>
        {grip.muzzle && <MuzzleQuad tip={grip.muzzle} quadRef={muzzleRef} />}
      </group>
    )
  }
  return (
    <mesh position={HELD_POSITION} rotation={HELD_ROTATION}>
      {/* Stand-in for items without a grip yet (flasks, bandages, ...). */}
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

/** Aim, firing kick, reload dip and heavy-charge pull-back for the item in hand (Req 5.7, 5.8). */
function weaponPose(item: ItemId | null): WeaponPose {
  const live = useCombatStore.getState().live
  if (item === 'revolver' || item === 'shotgun') {
    const newest = weaponRuntime.muzzleEvents[weaponRuntime.muzzleEvents.length - 1]
    const recoverS = FIREARMS.find((f) => f.id === item)?.recoilRecoverS ?? 0
    const kick = newest ? firingKickPose(newest.ageS, recoverS) : POSE_REST
    const reload =
      live.reload && live.reload.weapon === item && live.reload.totalS > 0
        ? reloadPose(1 - live.reload.leftS / live.reload.totalS)
        : POSE_REST
    return addPoses(aimPose(weaponRuntime.aimBlend), kick, reload)
  }
  if ((item === 'wood-axe' || item === 'silver-sabre') && live.charge) {
    const { chargeS } = heavyStatsFor(item, useCombatStore.getState().upgrades)
    return heavyChargePose(chargeS > 0 ? live.charge.heldS / chargeS : 0)
  }
  return POSE_REST
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
export function Viewmodel({ weaponState: weaponStateProp = null }: ViewmodelProps) {
  // Durability comes from the combat store; the prop only overrides it (tests, previews).
  const [storeState, setStoreState] = useState<WeaponState | null>(null)
  const weaponState = weaponStateProp ?? storeState
  const opacity = useMemo(() => (weaponState ? crackOpacity(weaponState) : 0), [weaponState])
  const cracked = weaponState ? isCracked(weaponState, useCombatStore.getState().upgrades) : false
  const muzzleRef = useRef<THREE.Mesh>(null)
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
    const frozen = gs.paused || gs.examining || gs.journalOpen || gs.mapOpen
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
      const wp = weaponPose(swap.current.shown)
      g.position.set(
        sway.current.x + b.x + sw.x + wp.x,
        sway.current.y + b.y + sw.y + wp.y - lowered * SWAP_LOWER_DISTANCE,
        sw.z + wp.z,
      )
      g.rotation.set(-lowered * SWAP_LOWER_TILT - sw.rotX - wp.rotX, 0, sw.rotZ + wp.rotZ)
    }

    // Muzzle flash: age the queued shots, drop spent ones, light the newest as a quad.
    const profile = muzzleProfile(settings.flashingLights)
    const events = weaponRuntime.muzzleEvents
    if (dt > 0) {
      for (const e of events) e.ageS += dt
      weaponRuntime.muzzleEvents = events.filter((e) => e.ageS < profile.durationS)
    }
    const newest = weaponRuntime.muzzleEvents[weaponRuntime.muzzleEvents.length - 1]
    const quad = muzzleRef.current
    if (quad) {
      const a =
        newest && newest.kind === swap.current.shown ? muzzleOpacity(profile, newest.ageS) : 0
      quad.visible = a > 0
      ;(quad.material as THREE.MeshBasicMaterial).opacity = a
    }

    // Feed durability from the combat store (Req 5.3); state only changes when the value does.
    const ds = durableState(swap.current.shown)
    setStoreState((cur) => (cur?.id === ds?.id && cur?.durability === ds?.durability ? cur : ds))
    // Nothing is drawn while the slot is empty or mid-swap-to-nothing.
    if (itemGroup.current) itemGroup.current.visible = swap.current.shown !== null
    setShownItem((cur) => (cur === swap.current?.shown ? cur : (swap.current?.shown ?? null)))
    // The ending camera is not the player's eyes, so no hands in shot.
    // Same for the intro cutscene: its camera is not the player's eyes either.
    if (gs.screen === 'ending' || useIntroStore.getState().playing) return

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
          <ViewmodelMesh item={shownItem} muzzleRef={muzzleRef} />
          {cracked && <CrackOverlay opacity={opacity} />}
        </group>
      </group>
    </>,
    scene,
  )
}
