// Chapel -- R3F scene component.
//
// Geometry: a cross-shaped footprint built from three overlapping box meshes
// (nave + transept). This is a placeholder while full model assets are pending.
//
// Interaction triggers:
//  - "Repair point" near the door: E within 2.5 m -> openChapelRepair()
//  - "Altar" near the apse end: E within 2.5 m, stage 2 active, not healed today
//    -> heal 25 HP and mark altarHealedToday = true
//
// Door mesh: barred (dark plank colour) when stage 1 is complete and the
// final rite is not active. Enemy AI can call isDoorBarred() from chapelStore.
//
// Architecture note: this is a rendering/interaction component.
// All game logic lives in chapelStore and the repairs system.

import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPositionRef } from './playerPositionRef'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { useChapelStore } from '../../game/state/chapelStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** World position of the chapel's geometric centre. */
const CHAPEL_POS = new THREE.Vector3(...CHAPEL_CENTER)

/** Interact range in metres (matches design-bible default of 2.5 m). */
const INTERACT_RANGE = 2.5

/**
 * Offset from chapel centre to the repair-point trigger near the door.
 * The door is at the -Z face of the nave.
 */
const DOOR_OFFSET = new THREE.Vector3(0, 0, -4.5)

/**
 * Offset from chapel centre to the altar trigger near the +Z apse.
 */
const ALTAR_OFFSET = new THREE.Vector3(0, 0, 4.5)

/** Colour when the door is open / unbarred. */
const DOOR_COLOR_OPEN = '#3a2412'

/** Colour when the door is barred (stage 1 complete). */
const DOOR_COLOR_BARRED = '#5c3d1e'
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Cross-shaped chapel footprint: a central nave + a shorter transept.
 * Dimensions chosen to look plausible as a small Victorian chapel.
 *
 *      [transept]
 *  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  y = 0 floor
 *       [nave]
 */
function ChapelGeometry() {
  return (
    <group>
      {/* Nave â€” long axis along Z */}
      {/* Walls and roof now live in Cemetery.tsx as a hollow shell with colliders. */}

      {/* Transept â€” crosses the nave near the altar end */}


      {/* Floor slab */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[4.8, 0.1, 11.8]} />
        <meshStandardMaterial color="#3c3530" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

/**
 * The chapel door mesh.  Its colour changes when the door is barred.
 */
function DoorMesh({ barred }: { barred: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const target = barred ? DOOR_COLOR_BARRED : DOOR_COLOR_OPEN
    mat.color.lerp(new THREE.Color(target), 0.05)
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, 1.0, -5.55]}
      castShadow
    >
      <boxGeometry args={[1.4, 2.0, 0.15]} />
      <meshStandardMaterial color={DOOR_COLOR_OPEN} roughness={0.85} metalness={0.1} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Chapel (main export)
// ---------------------------------------------------------------------------

/**
 * Drop inside the R3F `<Canvas>`.  Position is offset by CHAPEL_POS so the
 * rest of the scene can treat `[0,0,0]` as the hut/grounds start.
 */
export function Chapel() {
  const doorBarred = useChapelStore((s) => s.isDoorBarred())
  const altarActive = useChapelStore((s) => s.isAltarActive())
  const altarHealedToday = useChapelStore((s) => s.chapel.altarHealedToday)
  const setAltarHealedToday = useChapelStore((s) => s.setAltarHealedToday)
  const openChapelRepair = useUiWorldStore((s) => s.openChapelRepair)
  const chapelRepairOpen = useUiWorldStore((s) => s.chapelRepairOpen)
  const healPlayer = useUiWorldStore((s) => s.healPlayer)

  // Track whether E was already handled this "interaction window" to avoid
  // double-firing. Resets when the player moves away.
  const doorInteractedRef = useRef(false)
  const altarInteractedRef = useRef(false)

  // Scratch vectors â€” avoid allocations inside useFrame.
  const playerPos = useRef(new THREE.Vector3())
  const doorPos = useRef(new THREE.Vector3().copy(CHAPEL_POS).add(DOOR_OFFSET))
  const altarPos = useRef(new THREE.Vector3().copy(CHAPEL_POS).add(ALTAR_OFFSET))

  // ----- Keydown listener for E key ----------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'KeyE') return
      // Don't fire if any overlay is already open.
      if (chapelRepairOpen) return

      playerPos.current.copy(playerPositionRef.current)

      // Door/repair-point check
      const distToDoor = playerPos.current.distanceTo(doorPos.current)
      if (distToDoor <= INTERACT_RANGE && !doorInteractedRef.current) {
        doorInteractedRef.current = true
        openChapelRepair()
        return
      }

      // Altar check
      const distToAltar = playerPos.current.distanceTo(altarPos.current)
      if (
        distToAltar <= INTERACT_RANGE &&
        altarActive &&
        !altarHealedToday &&
        !altarInteractedRef.current
      ) {
        altarInteractedRef.current = true
        healPlayer(25)
        setAltarHealedToday(true)
        // Subtitle placeholder â€” a proper subtitle system will replace this.
        console.info("[Chapel] \"The altar's warmth mends your wounds.\"")
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chapelRepairOpen, openChapelRepair, altarActive, altarHealedToday, healPlayer, setAltarHealedToday])

  // Reset interaction flags when the player moves away from the triggers.
  useFrame(() => {
    playerPos.current.copy(playerPositionRef.current)

    if (playerPos.current.distanceTo(doorPos.current) > INTERACT_RANGE) {
      doorInteractedRef.current = false
    }
    if (playerPos.current.distanceTo(altarPos.current) > INTERACT_RANGE) {
      altarInteractedRef.current = false
    }
  })

  return (
    <group position={[CHAPEL_POS.x, CHAPEL_POS.y, CHAPEL_POS.z]} name="chapel">
      <ChapelGeometry />
      <DoorMesh barred={doorBarred} />
    </group>
  )
}
