// Cemetery -- greybox for the four zones (primitives stand in for final models).
//
// Mount inside <Physics>. Everything here is static: fixed rigid bodies with
// explicit CuboidColliders (cheap, exact). Gate lock state is derived from the
// inventory's key items via the pure `isGateLocked` rule; no rules live here.
//
// Draw-call budget: ~25 meshes. Headstones and fence pickets are one
// <Instances> draw call each.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  CHAPEL,
  CHAPEL_CENTER,
  CORRIDORS,
  FENCE,
  GROUNDS_HALF,
  HEADSTONE,
  PLAYABLE_BOUNDS,
  buildFenceSegments,
  generateHeadstones,
  picketPositions,
  type CorridorSpec,
  type Vec3,
} from '../../data/cemeteryLayout'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { isGateLocked } from '../../game/systems/gates'

// Shared materials keep the look consistent and avoid per-mesh allocations.
const MATERIALS = {
  grass: new THREE.MeshStandardMaterial({ color: '#2b3326', roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: '#5a5550', roughness: 0.95 }),
  darkStone: new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 1 }),
  iron: new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.6, metalness: 0.5 }),
}
type MaterialKey = keyof typeof MATERIALS

const HEADSTONES = generateHeadstones()
const FENCE_SEGMENTS = buildFenceSegments()
const PICKETS = FENCE_SEGMENTS.flatMap(picketPositions)

/** A box that is both visible and solid. Must sit inside a fixed RigidBody. */
function Block({
  position,
  size,
  material,
  visible = true,
}: {
  position: Vec3
  size: Vec3
  material: MaterialKey
  visible?: boolean
}) {
  return (
    <>
      {visible && (
        <mesh position={[...position]} material={MATERIALS[material]} castShadow receiveShadow>
          <boxGeometry args={[...size]} />
        </mesh>
      )}
      <CuboidCollider
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
        position={[...position]}
      />
    </>
  )
}

/**
 * drei's Instances builds its matrices over the first frames, but three caches
 * the bounding sphere the first time it culls. Recompute once the instances
 * are populated so culling uses the real extents.
 */
function useFitBounds(ref: React.RefObject<THREE.InstancedMesh | null>) {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current >= 3) return
    frames.current += 1
    if (frames.current === 3) ref.current?.computeBoundingSphere()
  })
}

// --- Grounds ---------------------------------------------------------------

function Headstones() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useFitBounds(ref)
  return (
    <>
      <Instances ref={ref} limit={HEADSTONES.length} castShadow receiveShadow>
        <boxGeometry args={[HEADSTONE.width, 1, HEADSTONE.depth]} />
        <primitive object={MATERIALS.stone} attach="material" />
        {HEADSTONES.map((h, i) => (
          <Instance
            key={i}
            position={[h.position[0], h.height / 2, h.position[2]]}
            rotation={[0, h.rotationY, 0]}
            scale={[1, h.height, 1]}
          />
        ))}
      </Instances>
      <RigidBody type="fixed" colliders={false}>
        {HEADSTONES.map((h, i) => (
          <CuboidCollider
            key={i}
            args={[HEADSTONE.width / 2, h.height / 2, HEADSTONE.depth / 2]}
            position={[h.position[0], h.height / 2, h.position[2]]}
            rotation={[0, h.rotationY, 0]}
          />
        ))}
      </RigidBody>
    </>
  )
}

function Fences() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useFitBounds(ref)
  return (
    <>
      <Instances ref={ref} limit={PICKETS.length} castShadow>
        <boxGeometry args={[0.06, FENCE.height, 0.06]} />
        <primitive object={MATERIALS.iron} attach="material" />
        {PICKETS.map(([x, z], i) => (
          <Instance key={i} position={[x, FENCE.height / 2, z]} />
        ))}
      </Instances>
      <RigidBody type="fixed" colliders={false}>
        {FENCE_SEGMENTS.map((s, i) => {
          const mid = (s.from + s.to) / 2
          const half = (s.to - s.from) / 2
          const t = FENCE.colliderHalfThickness
          return (
            <CuboidCollider
              key={i}
              args={s.axis === 'x' ? [half, FENCE.height / 2, t] : [t, FENCE.height / 2, half]}
              position={s.axis === 'x' ? [mid, FENCE.height / 2, s.fixed] : [s.fixed, FENCE.height / 2, mid]}
            />
          )
        })}
      </RigidBody>
    </>
  )
}

function Grounds() {
  const span = GROUNDS_HALF * 2 + 4
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Top face at y = 0. */}
      <Block position={[0, -0.2, 0]} size={[span, 0.4, GROUNDS_HALF * 2]} material="grass" />
    </RigidBody>
  )
}

// --- Chapel ----------------------------------------------------------------

/** Walled shell with a door gap; two frame colliders flank the opening. */
function ChapelShell() {
  const { halfX, halfZ, height, wallThickness: t, doorWidth } = CHAPEL
  const y = height / 2
  const sideW = halfX - doorWidth / 2
  const sideX = doorWidth / 2 + sideW / 2
  return (
    <group position={[...CHAPEL_CENTER]}>
      <RigidBody type="fixed" colliders={false}>
        {/* Door frame: front wall split around the opening. */}
        <Block position={[-sideX, y, -halfZ]} size={[sideW, height, t]} material="stone" />
        <Block position={[sideX, y, -halfZ]} size={[sideW, height, t]} material="stone" />
        <Block position={[0, y, halfZ]} size={[halfX * 2, height, t]} material="stone" />
        <Block position={[-halfX, y, 0]} size={[t, height, halfZ * 2]} material="stone" />
        <Block position={[halfX, y, 0]} size={[t, height, halfZ * 2]} material="stone" />
        <Block
          position={[0, height + t / 2, 0]}
          size={[halfX * 2 + t * 2, t, halfZ * 2 + t]}
          material="darkStone"
        />
      </RigidBody>
    </group>
  )
}

// --- Corridors -------------------------------------------------------------

function Corridor({ spec }: { spec: CorridorSpec }) {
  const { centerX, entranceZ, dir, length, width, height, wallThickness: t } = spec
  const midZ = entranceZ + (dir * length) / 2
  const endZ = entranceZ + dir * (length + t / 2)
  const outerW = width + t * 2
  const wallX = width / 2 + t / 2
  return (
    <group position={[centerX, 0, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <Block position={[0, -0.2, midZ]} size={[outerW, 0.4, length]} material="darkStone" />
        <Block position={[-wallX, height / 2, midZ]} size={[t, height, length]} material="stone" />
        <Block position={[wallX, height / 2, midZ]} size={[t, height, length]} material="stone" />
        <Block position={[0, height / 2, endZ]} size={[outerW, height, t]} material="stone" />
        <Block position={[0, height + t / 2, midZ]} size={[outerW, t, length]} material="darkStone" />
      </RigidBody>
      <Gate spec={spec} />
    </group>
  )
}

/** Solid until the matching key item is held; unmounting removes the collider. */
function Gate({ spec }: { spec: CorridorSpec }) {
  const locked = useInventoryStore((s) => isGateLocked(spec.id, s.inventory.keyItems))
  if (!locked) return null
  const z = spec.entranceZ + spec.dir * (spec.wallThickness / 2)
  return (
    <RigidBody type="fixed" colliders={false}>
      <Block
        position={[0, spec.height / 2, z]}
        size={[spec.width + spec.wallThickness * 2, spec.height, spec.wallThickness]}
        material="iron"
      />
    </RigidBody>
  )
}

// --- Boundary --------------------------------------------------------------

function Boundary() {
  const { halfX, halfZ, wallHeight, wallHalfThickness: t } = PLAYABLE_BOUNDS
  const y = wallHeight / 2
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[halfX + t, y, t]} position={[0, y, -halfZ - t]} />
      <CuboidCollider args={[halfX + t, y, t]} position={[0, y, halfZ + t]} />
      <CuboidCollider args={[t, y, halfZ + t]} position={[-halfX - t, y, 0]} />
      <CuboidCollider args={[t, y, halfZ + t]} position={[halfX + t, y, 0]} />
    </RigidBody>
  )
}

export function Cemetery() {
  return (
    <group name="cemetery">
      <Grounds />
      <Headstones />
      <Fences />
      <ChapelShell />
      {CORRIDORS.map((c) => (
        <Corridor key={c.id} spec={c} />
      ))}
      <Boundary />
    </group>
  )
}
