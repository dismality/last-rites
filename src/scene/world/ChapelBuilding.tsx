// The chapel's walls, pitched roof, door frame, belfry and altar, built from plain stone boxes.
// The walls are single boxes (one per face) with stone buttresses from the kit's pillar model,
// so nothing is stacked or stretched. Mount inside <Physics>. Door and repair logic: Chapel.tsx.

import { RigidBody } from '@react-three/rapier'
import { CHAPEL, CHAPEL_CENTER, CHAPEL_DOORS, type Placement } from '../../data/cemeteryLayout'
import { GableRoof, Slab } from './buildingParts'
import { PART_MATERIALS } from './partMaterials'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { InstancedModel } from './InstancedModel'
import { Interactable } from './Interactable'

const DOOR_HEIGHT = 2.5
const ROOF_RISE = 2
const ROOF_EAGE_M = 0.4
const FRAME = { post: 0.28, depth: 0.5, lintel: 0.35 } as const
const BUTTRESS_Z = [-5.9, -3, 0, 3, 5.9] as const
const WINDOW_Z = [-1.5, 1.5] as const

/** Model height of `pillar-large`; buttresses are stretched to rise just above the eaves. */
const PILLAR_HEIGHT = 2.7

/**
 * The whistle answers at the altar: stone shifts and the catacomb stair opens. The hotspot only
 * exists while the whistle is held and shows cues only while the stair is sealed, so ordinary
 * altar use is untouched.
 */
function AltarStairReveal({ z }: { z: number }) {
  const hasWhistle = useInventoryStore((s) => s.inventory.keyItems.includes('bone-whistle'))
  // Stays mounted after the stair opens so its cues fade; then it is used up and not targetable.
  if (!hasWhistle) return null
  return (
    <group position={[0, 0, z]}>
      <Interactable
        id="altar-whistle"
        kind="altar-whistle"
        size={[1.6, 1.1, 0.8]}
        runeHeight={1.6}
        onInteract={() => useMysteryStore.getState().interactGate('catacombs', 'altar')}
      >
        <mesh visible={false} position={[0, 0.55, 0]}>
          <boxGeometry args={[1.6, 1.1, 0.8]} />
        </mesh>
      </Interactable>
    </group>
  )
}

export function ChapelBuilding() {
  const { halfX, halfZ, height: h, wallThickness: t, doorWidth } = CHAPEL
  const sideW = halfX - doorWidth / 2
  const sideX = doorWidth / 2 + sideW / 2
  // Vestry opening in chapel-local Z, derived from the shared door spec so combat and walls agree.
  const vestry = CHAPEL_DOORS.vestry
  const vestryW = vestry.width
  const vestryZ = vestry.point[2] - CHAPEL_CENTER[2]
  const westALen = vestryZ - vestryW / 2 + halfZ
  const westBLen = halfZ - (vestryZ + vestryW / 2)
  const ridge = h + ROOF_RISE
  // The belfry sits on the ridge over the door end.
  const belfryZ = -halfZ + 1.1

  const buttresses: Placement[] = BUTTRESS_Z.flatMap((z) =>
    ([-1, 1] as const).map<Placement>((side) => ({
      position: [side * (halfX + 0.1), 0, z],
      rotationY: 0,
      scale: [1.2, (h + 0.4) / PILLAR_HEIGHT, 1.2],
    })),
  )
  const altarZ = halfZ - 1.2
  const altar: Placement[] = [{ position: [0, 0, altarZ], rotationY: Math.PI, scale: [1, 1, 1] }]
  const candles: Placement[] = ([-0.55, 0.55] as const).map((x) => ({
    position: [x, 0.73, altarZ],
    rotationY: 0,
    scale: [1, 1, 1],
  }))
  const cross: Placement[] = [
    { position: [0, ridge + 2.55, belfryZ], rotationY: 0, scale: [0.6, 0.6, 0.6] },
  ]

  return (
    <group position={[...CHAPEL_CENTER]} name="chapel-building">
      <RigidBody type="fixed" colliders={false}>
        {/* Front wall split around the door, with a stone lintel over the opening. */}
        <Slab position={[-sideX, h / 2, -halfZ]} size={[sideW, h, t]} material="stone" />
        <Slab position={[sideX, h / 2, -halfZ]} size={[sideW, h, t]} material="stone" />
        <Slab
          position={[0, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, -halfZ]}
          size={[doorWidth, h - DOOR_HEIGHT, t]}
          material="stone"
        />
        <Slab position={[0, h / 2, halfZ]} size={[halfX * 2, h, t]} material="stone" />
        {/* West wall split around the vestry opening, with a lintel over it. */}
        <Slab
          position={[-halfX, h / 2, westALen / 2 - halfZ]}
          size={[t, h, westALen]}
          material="stone"
        />
        <Slab
          position={[-halfX, h / 2, halfZ - westBLen / 2]}
          size={[t, h, westBLen]}
          material="stone"
        />
        <Slab
          position={[-halfX, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, vestryZ]}
          size={[t, h - DOOR_HEIGHT, vestryW]}
          material="stone"
        />
        <Slab position={[halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="stone" />
        {/* Ceiling: keeps anything from climbing onto the roof. */}
        <Slab
          position={[0, h + t / 2, 0]}
          size={[halfX * 2 + t * 2, t, halfZ * 2 + t]}
          material="slate"
          visible={false}
        />
      </RigidBody>

      {/* Door frame: two posts and a lintel, proud of the wall so the opening reads from afar. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (doorWidth / 2 + FRAME.post / 2), DOOR_HEIGHT / 2, -halfZ - 0.05]}
          material={PART_MATERIALS.trim}
          castShadow
        >
          <boxGeometry args={[FRAME.post, DOOR_HEIGHT, FRAME.depth]} />
        </mesh>
      ))}
      <mesh
        position={[0, DOOR_HEIGHT + FRAME.lintel / 2, -halfZ - 0.05]}
        material={PART_MATERIALS.trim}
        castShadow
      >
        <boxGeometry args={[doorWidth + FRAME.post * 2, FRAME.lintel, FRAME.depth]} />
      </mesh>

      {/* Vestry frame: same posts and lintel as the front, on the west wall. */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[
            -halfX - 0.05,
            DOOR_HEIGHT / 2,
            vestryZ + side * (vestryW / 2 + FRAME.post / 2),
          ]}
          material={PART_MATERIALS.trim}
          castShadow
        >
          <boxGeometry args={[FRAME.depth, DOOR_HEIGHT, FRAME.post]} />
        </mesh>
      ))}
      <mesh
        position={[-halfX - 0.05, DOOR_HEIGHT + FRAME.lintel / 2, vestryZ]}
        material={PART_MATERIALS.trim}
        castShadow
      >
        <boxGeometry args={[FRAME.depth, FRAME.lintel, vestryW + FRAME.post * 2]} />
      </mesh>

      <GableRoof
        position={[0, h, 0]}
        width={halfX * 2 + ROOF_EAGE_M * 2}
        length={halfZ * 2 + ROOF_EAGE_M * 2}
        rise={ROOF_RISE}
        material="slate"
      />

      {/* Tall candlelit windows between the buttresses. */}
      {WINDOW_Z.flatMap((z) =>
        ([-1, 1] as const).map((side) => (
          <mesh
            key={`${z}${side}`}
            position={[side * halfX, 1.7, z]}
            material={PART_MATERIALS.glass}
          >
            <boxGeometry args={[t + 0.04, 1.3, 0.55]} />
          </mesh>
        )),
      )}

      <InstancedModel model="pillar-large" placements={buttresses} />

      {/* Belfry on the ridge: platform, four posts, bell, pyramid cap and a cross. */}
      <group position={[0, 0, belfryZ]}>
        <mesh position={[0, ridge - 0.15, 0]} material={PART_MATERIALS.trim} castShadow>
          <boxGeometry args={[1.7, 0.3, 1.7]} />
        </mesh>
        {([-1, 1] as const).flatMap((sx) =>
          ([-1, 1] as const).map((sz) => (
            <mesh
              key={`${sx}${sz}`}
              position={[sx * 0.7, ridge + 0.7, sz * 0.7]}
              material={PART_MATERIALS.trim}
              castShadow
            >
              <boxGeometry args={[0.2, 1.4, 0.2]} />
            </mesh>
          )),
        )}
        <mesh position={[0, ridge + 0.75, 0]} material={PART_MATERIALS.bronze}>
          <cylinderGeometry args={[0.2, 0.38, 0.55, 12]} />
        </mesh>
        <mesh
          position={[0, ridge + 1.95, 0]}
          rotation={[0, Math.PI / 4, 0]}
          material={PART_MATERIALS.slate}
          castShadow
        >
          <coneGeometry args={[1.25, 1.1, 4]} />
        </mesh>
      </group>
      <InstancedModel model="cross" placements={cross} />

      {/* Altar at the far end, with candles. */}
      <InstancedModel model="altar-stone" placements={altar} />
      <AltarStairReveal z={altarZ} />
      <InstancedModel model="candle-multiple" placements={candles} />
    </group>
  )
}
