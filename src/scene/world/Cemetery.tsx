// Cemetery -- the four zones. The open grounds, Mausoleum Row crypts, oaks, headstones and fences
// come from one Draco scene (GraveyardScene.tsx, with its collision boxes). This file keeps the
// y = 0 physics floor, the catacomb corridor, the avenue rails and invisible walls, lamp posts,
// coffin dressing, the hut and chapel, and the boundary walls.
//
// Mount inside <Physics>. Everything here is static: fixed rigid bodies with explicit colliders.
// Gates live in Gates.tsx; no rules live here.
//
// Draw-call budget: every repeated prop goes through <InstancedModel>, one call per model type.
import { useMemo } from 'react'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  CORRIDORS,
  FENCE_PANEL_WIDTH,
  GROUNDS_HALF,
  LAMP_POSTS,
  PLAYABLE_BOUNDS,
  WALL_MODEL_HEIGHT,
  WALL_MODEL_THICKNESS,
  WALL_PANEL_WIDTH,
  avenueFarZ,
  panelRun,
  type CorridorSpec,
  type Placement,
  type Vec3,
} from '../../data/cemeteryLayout'
import { lampCollider } from '../../data/colliderFootprints'
import { SPAWN_POINTS } from '../../data/zones'
import { ChapelBuilding } from './ChapelBuilding'
import { Gate, OssuaryDoor } from './Gates'
import { GraveyardScene } from './GraveyardScene'
import { Hut } from './Hut'
import { InstancedModel } from './InstancedModel'

// Shared materials for the primitives that remain (catacomb floors, walls and ceilings).
const MATERIALS = {
  stone: new THREE.MeshStandardMaterial({ color: '#5a5550', roughness: 0.95 }),
  darkStone: new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 1 }),
}
type MaterialKey = keyof typeof MATERIALS

const unit = (position: Vec3, rotationY = 0, s = 1): Placement => ({
  position,
  rotationY,
  scale: [s, s, s],
})
const LAMP_PLACEMENTS = LAMP_POSTS.map((l) => unit(l.position, l.rotationY))

// Coffins sit beside their pickup point so the stacks aren't buried inside the mesh.
const COFFIN_PLACEMENTS = SPAWN_POINTS.filter((p) => p.lootTable === 'broken-coffin').map((p, i) =>
  unit([p.position[0], 0, p.position[2] + 1.2], 0.5 + i * 0.9),
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

function LampPosts() {
  return (
    <>
      <InstancedModel model="lightpost-single" placements={LAMP_PLACEMENTS} />
      <RigidBody type="fixed" colliders={false}>
        {LAMP_POSTS.map((l, i) => {
          const c = lampCollider(l.position)
          return <CylinderCollider key={i} args={[c.halfHeight, c.radius]} position={[...c.position]} />
        })}
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

function Grounds() {
  const span = GROUNDS_HALF * 2 + 4
  return (
    <RigidBody type="fixed" colliders={false}>
      {/* Top face at y = 0. Invisible: the graveyard scene draws the ground. */}
      <Block position={[0, -0.2, 0]} size={[span, 0.4, GROUNDS_HALF * 2]} material="stone" visible={false} />
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
            visible={false}
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
      <GraveyardScene />
      <LampPosts />
      <SpawnDressing />
      <Hut />
      <ChapelBuilding />
      {CORRIDORS.map((c) =>
        c.open ? <Avenue key={c.id} spec={c} /> : <Corridor key={c.id} spec={c} />,
      )}
      <Boundary />
    </group>
  )
}
