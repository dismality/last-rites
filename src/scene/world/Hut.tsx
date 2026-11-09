// The keeper's hut: a plank cabin around the spawn point with the workbench against its back wall.
// The door is in the +Z wall, behind the player at the start, so the first view is the bench.
// Mount inside <Physics>. Walls are solid; windows and furniture are visual (the table has one collider).

import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { HUT } from '../../data/cemeteryLayout'
import { GableRoof, Slab } from './buildingParts'
import { PART_MATERIALS } from './partMaterials'

/** Overhang of the roof beyond the walls. */
const EAGE_M = 0.4
const DOOR_HEIGHT = 2.1
const WINDOW = { y: 1.4, z: -0.8, height: 0.7, width: 0.9 } as const

/** Side table that carries the hut's supplies (see `hut-shelf` and journal page 1 in zones.ts). */
const TABLE = { x: 2.1, z: -1.1, top: 0.75, w: 1.6, d: 0.8 } as const

export function Hut() {
  const { halfX, halfZ, height: h, wallThickness: t, doorWidth, roofRise } = HUT
  const frontW = halfX - doorWidth / 2
  const frontX = doorWidth / 2 + frontW / 2
  const legY = (TABLE.top - 0.03) / 2

  return (
    <group name="hut">
      <RigidBody type="fixed" colliders={false}>
        <Slab position={[0, h / 2, -halfZ]} size={[halfX * 2 + t, h, t]} material="wood" />
        <Slab position={[-halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="wood" />
        <Slab position={[halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="wood" />
        <Slab position={[-frontX, h / 2, halfZ]} size={[frontW, h, t]} material="wood" />
        <Slab position={[frontX, h / 2, halfZ]} size={[frontW, h, t]} material="wood" />
        <Slab
          position={[0, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, halfZ]}
          size={[doorWidth, h - DOOR_HEIGHT, t]}
          material="darkWood"
        />
        {/* Table: one block under the top so nobody walks through it. */}
        <CuboidCollider
          args={[TABLE.w / 2, TABLE.top / 2, TABLE.d / 2]}
          position={[TABLE.x, TABLE.top / 2, TABLE.z]}
        />
      </RigidBody>

      {/* Floorboards, a hair above the grass slab. */}
      <mesh position={[0, 0.025, 0]} material={PART_MATERIALS.floor} receiveShadow>
        <boxGeometry args={[halfX * 2, 0.05, halfZ * 2]} />
      </mesh>

      <GableRoof
        position={[0, h, 0]}
        width={halfX * 2 + EAGE_M * 2}
        length={halfZ * 2 + EAGE_M * 2}
        rise={roofRise}
        material="darkWood"
      />

      {/* Lit windows on both side walls. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * halfX, WINDOW.y, WINDOW.z]}
          material={PART_MATERIALS.glass}
        >
          <boxGeometry args={[t + 0.04, WINDOW.height, WINDOW.width]} />
        </mesh>
      ))}

      {/* Table. */}
      <mesh
        position={[TABLE.x, TABLE.top, TABLE.z]}
        material={PART_MATERIALS.wood}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TABLE.w, 0.06, TABLE.d]} />
      </mesh>
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[
              TABLE.x + sx * (TABLE.w / 2 - 0.08),
              legY,
              TABLE.z + sz * (TABLE.d / 2 - 0.08),
            ]}
            material={PART_MATERIALS.darkWood}
          >
            <boxGeometry args={[0.07, TABLE.top - 0.03, 0.07]} />
          </mesh>
        )),
      )}

      {/* A warm fill so the hut reads as lived in even before the lantern is lit. No shadow. */}
      <pointLight position={[0, h - 0.4, 0]} color="#e8913a" intensity={2} distance={7} decay={2} />
    </group>
  )
}
