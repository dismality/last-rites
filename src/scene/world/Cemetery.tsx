// Cemetery -- the four zones, dressed with the Kenney graveyard kit (public/assets/models/world).
//
// Mount inside <Physics>. Everything here is static: fixed rigid bodies with
// explicit CuboidColliders (cheap, exact) that kept their greybox sizes, so
// the models are purely visual. Gates live in Gates.tsx; no rules live here.
//
// Draw-call budget: every repeated prop goes through <InstancedModel>, one call
// per model type (~20 total), plus a handful of floor/ceiling slabs.

import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  AVENUE_CRYPT_SIZE,
  CORRIDORS,
  CRANE_CRYPT,
  FENCE,
  FENCE_PANEL_WIDTH,
  GROUNDS_HALF,
  HEADSTONE,
  HEADSTONE_KINDS,
  HEADSTONE_MODEL_HEIGHT,
  LAMP_COLLIDER,
  LAMP_POSTS,
  PLAYABLE_BOUNDS,
  TREE,
  WALL_MODEL_HEIGHT,
  WALL_MODEL_THICKNESS,
  WALL_PANEL_WIDTH,
  avenueCrypts,
  avenueFarZ,
  buildFenceSegments,
  craneCryptPosition,
  generateHeadstones,
  generateTrees,
  panelRun,
  type CorridorSpec,
  type Placement,
  type TreeKind,
  type Vec3,
} from '../../data/cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'
import { ChapelBuilding } from './ChapelBuilding'
import { Gate, OssuaryDoor } from './Gates'
import { Hut } from './Hut'
import { InstancedModel } from './InstancedModel'

// Shared materials for the primitives that remain (ground, floors, ceilings).
const MATERIALS = {
  grass: new THREE.MeshStandardMaterial({ color: '#2b3326', roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: '#5a5550', roughness: 0.95 }),
  darkStone: new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 1 }),
}
type MaterialKey = keyof typeof MATERIALS

const HEADSTONES = generateHeadstones()
const FENCE_SEGMENTS = buildFenceSegments()

const unit = (position: Vec3, rotationY = 0, s = 1): Placement => ({
  position,
  rotationY,
  scale: [s, s, s],
})

// Headstones: five models cycled by index, each a single instanced draw call.
const HEADSTONE_PLACEMENTS = HEADSTONE_KINDS.map((_kind, k) =>
  HEADSTONES.flatMap((h, i) =>
    i % HEADSTONE_KINDS.length === k
      ? [unit(h.position, h.rotationY, h.height / HEADSTONE_MODEL_HEIGHT)]
      : [],
  ),
)

const FENCE_PLACEMENTS = FENCE_SEGMENTS.flatMap((s) =>
  panelRun(s.axis, s.fixed, s.from, s.to, FENCE_PANEL_WIDTH),
)

const SPAWN_AVOID: Vec3[] = [
  ...SPAWN_POINTS.map((p) => p.position),
  ...FIXED_SPAWNS.map((p) => p.position),
]
const TREES = generateTrees(SPAWN_AVOID)
const treesOf = (kind: TreeKind) =>
  TREES.flatMap((t, i) =>
    t.kind === kind ? [unit(t.position, t.rotationY, 0.9 + (i % 4) * 0.1)] : [],
  )
const PINE_PLACEMENTS = treesOf('pine-crooked')
const PLAIN_PINE_PLACEMENTS = treesOf('pine')
const TRUNK_PLACEMENTS = treesOf('trunk')
const LONG_TRUNK_PLACEMENTS = treesOf('trunk-long')

const LAMP_PLACEMENTS = LAMP_POSTS.map((l) => unit(l.position, l.rotationY))

// Coffins sit beside their pickup point so the stacks aren't buried inside the mesh.
const COFFIN_PLACEMENTS = SPAWN_POINTS.filter((p) => p.lootTable === 'broken-coffin').map((p, i) =>
  unit([p.position[0], 0, p.position[2] + 1.2], 0.5 + i * 0.9),
)

const CRYPT_PLACEMENTS = [unit(craneCryptPosition())]

// Crypts lining Mausoleum Row, grouped by model so each is one instanced draw call.
const AVENUE_CRYPTS = avenueCrypts()
const AVENUE_MODELS = Object.keys(AVENUE_CRYPT_SIZE) as Array<keyof typeof AVENUE_CRYPT_SIZE>
const AVENUE_PLACEMENTS = AVENUE_MODELS.map((model) =>
  AVENUE_CRYPTS.filter((c) => c.model === model).map((c) => unit(c.position, c.rotationY)),
)

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
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[...position]} />
    </>
  )
}

/** Brick panels stretched to a wall's height and thickness. */
function wallRun(
  axis: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  height: number,
  thickness: number,
): Placement[] {
  return panelRun(
    axis,
    fixed,
    from,
    to,
    WALL_PANEL_WIDTH,
    height / WALL_MODEL_HEIGHT,
    thickness / WALL_MODEL_THICKNESS,
  )
}

// --- Grounds ---------------------------------------------------------------

function Headstones() {
  return (
    <>
      {HEADSTONE_KINDS.map((kind, k) => (
        <InstancedModel key={kind} model={kind} placements={HEADSTONE_PLACEMENTS[k]} />
      ))}
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
  return (
    <>
      <InstancedModel model="iron-fence" placements={FENCE_PLACEMENTS} centerXZ />
      <RigidBody type="fixed" colliders={false}>
        {FENCE_SEGMENTS.map((s, i) => {
          const mid = (s.from + s.to) / 2
          const half = (s.to - s.from) / 2
          const t = FENCE.colliderHalfThickness
          return (
            <CuboidCollider
              key={i}
              args={s.axis === 'x' ? [half, FENCE.height / 2, t] : [t, FENCE.height / 2, half]}
              position={
                s.axis === 'x' ? [mid, FENCE.height / 2, s.fixed] : [s.fixed, FENCE.height / 2, mid]
              }
            />
          )
        })}
      </RigidBody>
    </>
  )
}

/** Dead oaks (crooked pines), stumps and logs. Trunks are solid; canopies are out of reach. */
function Trees() {
  return (
    <>
      <InstancedModel model="pine-crooked" placements={PINE_PLACEMENTS} />
      <InstancedModel model="pine" placements={PLAIN_PINE_PLACEMENTS} />
      <InstancedModel model="trunk" placements={TRUNK_PLACEMENTS} />
      <InstancedModel model="trunk-long" placements={LONG_TRUNK_PLACEMENTS} />
      <RigidBody type="fixed" colliders={false}>
        {TREES.map((t, i) => {
          const pine = t.kind.startsWith('pine')
          const halfH = pine ? TREE.pineColliderHalfHeight : t.kind === 'trunk' ? 0.33 : 0.75
          const half = pine ? TREE.pineColliderHalf : TREE.trunkColliderHalf
          return (
            <CuboidCollider
              key={i}
              args={[half, halfH, half]}
              position={[t.position[0], halfH, t.position[2]]}
            />
          )
        })}
      </RigidBody>
    </>
  )
}

function LampPosts() {
  return (
    <>
      <InstancedModel model="lightpost-single" placements={LAMP_PLACEMENTS} />
      <RigidBody type="fixed" colliders={false}>
        {LAMP_POSTS.map((l, i) => (
          <CuboidCollider
            key={i}
            args={[LAMP_COLLIDER.half, LAMP_COLLIDER.halfHeight, LAMP_COLLIDER.half]}
            position={[l.position[0], LAMP_COLLIDER.halfHeight, l.position[2]]}
          />
        ))}
      </RigidBody>
    </>
  )
}

/** Dressing for spawn points: broken coffins (diggable mounds are in GraveMounds.tsx). No colliders (walk over). */
function SpawnDressing() {
  return (
    <>
      <InstancedModel model="coffin-old" placements={COFFIN_PLACEMENTS} />
    </>
  )
}

/**
 * Crane family crypt: body, door and roof share a position; the roof is lifted
 * (docs/world-models.md). Decorative backdrop at the end of Mausoleum Row, so the
 * 1.77 m door opening (tight for the 1.7 m capsule) is never walked through.
 */
function CraneCrypt() {
  const [x, , z] = craneCryptPosition()
  return (
    <>
      <InstancedModel model="crypt-large" placements={CRYPT_PLACEMENTS} />
      <InstancedModel model="crypt-large-door" placements={CRYPT_PLACEMENTS} />
      <InstancedModel
        model="crypt-large-roof"
        placements={CRYPT_PLACEMENTS}
        lift={CRANE_CRYPT.roofLift}
      />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[CRANE_CRYPT.halfX, CRANE_CRYPT.height / 2, CRANE_CRYPT.halfZ]}
          position={[x, CRANE_CRYPT.height / 2, z]}
        />
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

// --- Corridors -------------------------------------------------------------

function Corridor({ spec }: { spec: CorridorSpec }) {
  const { centerX, entranceZ, dir, length, width, height, wallThickness: t } = spec
  const midZ = entranceZ + (dir * length) / 2
  const endZ = entranceZ + dir * (length + t / 2)
  const outerW = width + t * 2
  const wallX = width / 2 + t / 2
  const walls = useMemo(() => {
    const z0 = Math.min(entranceZ, entranceZ + dir * length)
    const z1 = Math.max(entranceZ, entranceZ + dir * length)
    return [
      ...wallRun('z', -wallX, z0, z1, height, t),
      ...wallRun('z', wallX, z0, z1, height, t),
      ...wallRun('x', endZ, -outerW / 2, outerW / 2, height, t),
    ]
  }, [entranceZ, dir, length, wallX, endZ, outerW, height, t])
  return (
    <group position={[centerX, 0, 0]}>
      <InstancedModel model="brick-wall" placements={walls} centerXZ />
      <RigidBody type="fixed" colliders={false}>
        <Block position={[0, -0.2, midZ]} size={[outerW, 0.4, length]} material="darkStone" />
        <Block
          position={[-wallX, height / 2, midZ]}
          size={[t, height, length]}
          material="stone"
          visible={false}
        />
        <Block
          position={[wallX, height / 2, midZ]}
          size={[t, height, length]}
          material="stone"
          visible={false}
        />
        <Block
          position={[0, height / 2, endZ]}
          size={[outerW, height, t]}
          material="stone"
          visible={false}
        />
        <Block
          position={[0, height + t / 2, midZ]}
          size={[outerW, t, length]}
          material="darkStone"
        />
      </RigidBody>
      <Gate spec={spec} />
      {spec.id === 'catacombs' && <OssuaryDoor />}
    </group>
  )
}

/** Gap between the avenue path and the invisible wall that keeps players on it. */
const AVENUE_WALL_HALF = 0.15
/** Ground under the avenue is wide enough to carry the lining crypts. */
const AVENUE_FLOOR_WIDTH = 12

/**
 * Mausoleum Row: an open stone avenue with railings on both sides, crypts lining it and the
 * Crane crypt closing the far end. No roof or walls, so moonlight and fog reach the path.
 * Invisible walls behind the railings stop the player stepping off the floor.
 */
function Avenue({ spec }: { spec: CorridorSpec }) {
  const { centerX, entranceZ, dir, length, width, height } = spec
  const farZ = avenueFarZ()
  const floorLength = Math.abs(farZ - entranceZ)
  const floorMidZ = (entranceZ + farZ) / 2
  const pathMidZ = entranceZ + (dir * length) / 2
  const railX = width / 2
  const rails = useMemo(() => {
    const z0 = Math.min(entranceZ, entranceZ + dir * length)
    const z1 = Math.max(entranceZ, entranceZ + dir * length)
    return [-railX, railX].flatMap((x) => panelRun('z', x, z0, z1, FENCE_PANEL_WIDTH))
  }, [entranceZ, dir, length, railX])
  return (
    <>
      <group position={[centerX, 0, 0]}>
        <InstancedModel model="iron-fence" placements={rails} centerXZ />
        <RigidBody type="fixed" colliders={false}>
          <Block
            position={[0, -0.2, floorMidZ]}
            size={[AVENUE_FLOOR_WIDTH, 0.4, floorLength]}
            material="darkStone"
          />
          {[-1, 1].map((side) => (
            <Block
              key={side}
              position={[side * (railX + AVENUE_WALL_HALF), height / 2, pathMidZ]}
              size={[AVENUE_WALL_HALF * 2, height, length]}
              material="stone"
              visible={false}
            />
          ))}
        </RigidBody>
        <Gate spec={spec} />
      </group>
      {AVENUE_MODELS.map((model, i) => (
        <InstancedModel key={model} model={model} placements={AVENUE_PLACEMENTS[i]} />
      ))}
    </>
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
      <Trees />
      <LampPosts />
      <SpawnDressing />
      <Hut />
      <ChapelBuilding />
      {CORRIDORS.map((c) =>
        c.open ? <Avenue key={c.id} spec={c} /> : <Corridor key={c.id} spec={c} />,
      )}
      <CraneCrypt />
      <Boundary />
    </group>
  )
}
