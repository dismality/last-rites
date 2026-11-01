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

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
function ViewmodelMesh() {
  return (
    <mesh position={[0.22, -0.18, -0.4]} rotation={[0.1, -0.15, 0]}>
      {/* Rough box approximation of a held shovel/club */}
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

// ---------------------------------------------------------------------------
// Viewmodel (main export)
// ---------------------------------------------------------------------------

/**
 * Mount this inside the R3F Camera's subtree (or a fixed near-plane group)
 * so it moves with the player's view.
 *
 * The camera group is typically created in FirstPersonController; Viewmodel
 * is a child of that group.
 */
export function Viewmodel({ weaponState }: ViewmodelProps) {
  const opacity = useMemo(
    () => (weaponState ? crackOpacity(weaponState) : 0),
    [weaponState],
  )

  const cracked = weaponState ? isCracked(weaponState) : false

  return (
    <group name="viewmodel">
      <ViewmodelMesh />
      {cracked && <CrackOverlay opacity={opacity} />}
    </group>
  )
}
