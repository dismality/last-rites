// The four findable weapons as props with an Interactable each (Req 2.1-2.6, 23.8).
// Each weapon is its Blender model lying on its prop (the chapel cupboard's shelf, the lodge table,
// the woodpile's chopping block, the sabre plinth; spec 09 task 11n-d). The props stay when the weapon is
// taken. Whether the weapon can be taken (satchel room, already taken) is
// decided by the pure pickup rule inside takeWeaponPickup; a refusal leaves the prop in place.

import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { DRACO_PATH, propModelUrl } from '../../data/assets'
import { CRANE_CRYPT_STEP } from '../../data/cemeteryLayout'
import { WEAPON_PICKUP_POSES } from '../../data/itemModels'
import { LODGE_TABLE_BOXES, WOODPILE_BOXES, type PropBox } from '../../data/propScenery'
import { WEAPON_PICKUPS, type WeaponPickupId } from '../../data/weaponPickups'
import { takeWeaponPickup } from '../../game/state/combatActions'
import { useCombatStore } from '../../game/state/combatStore'
import '../assets/preloadModels'
import { Interactable } from './Interactable'
import { GroundItem } from './ItemModel'
import { useLingerAfter } from './useLingering'

/** A fixed collider from a prop's JSON, in the prop's own space. */
function PropColliders({ boxes }: { boxes: readonly PropBox[] }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {boxes.map((b) => (
        <CuboidCollider
          key={b.note}
          args={[b.half[0], b.half[1], b.half[2]]}
          position={[...b.center]}
          rotation={[0, b.rotY, 0]}
        />
      ))}
    </RigidBody>
  )
}

/** A static prop model with its colliders. */
function PropModel({
  id,
  boxes,
  y = 0,
}: {
  id: 'woodpile' | 'lodge-table' | 'sabre-plinth'
  boxes?: readonly PropBox[]
  y?: number
}) {
  const model = useGLTF(propModelUrl(id), DRACO_PATH).scene
  return (
    <group position={[0, y, 0]}>
      <Clone object={model} />
      {boxes && <PropColliders boxes={boxes} />}
    </group>
  )
}

/** The weapon's Blender model lying on its resting place (pose in data/itemModels.ts). */
function Weapon({ id }: { id: WeaponPickupId }) {
  const pose = WEAPON_PICKUP_POSES[id]
  return (
    <group position={[...pose.surface]}>
      <GroundItem item={id} scale={pose.scale} yaw={pose.yaw} />
    </group>
  )
}

/** One findable weapon. Taken, it fades with its cues for a moment, then the weapon is gone. */
function WeaponPickup({ id, position }: { id: WeaponPickupId; position: readonly [number, number, number] }) {
  const isTaken = useCombatStore((s) => s.takenPickups.includes(id))
  const shown = useLingerAfter(isTaken)
  return (
    <group name={`weapon-pickup:${id}`} position={[...position]}>
      {/* The revolver rests on the chapel scene's own cupboard shelf, so it brings no prop. */}
      {id === 'wood-axe' && <PropModel id="woodpile" boxes={WOODPILE_BOXES} />}
      {id === 'shotgun' && <PropModel id="lodge-table" boxes={LODGE_TABLE_BOXES} />}
      {/* The pickup stands on the crypt step; the plinth is modelled from the ground. */}
      {id === 'silver-sabre' && <PropModel id="sabre-plinth" y={-CRANE_CRYPT_STEP[1]} />}
      {shown && (
        <Interactable
          id={`weapon:${id}`}
          kind="weapon-pickup"
          subject={id}
          runeHeight={id === 'wood-axe' ? 1.3 : 0.5}
          onInteract={() => {
            takeWeaponPickup(id)
          }}
        >
          <Weapon id={id} />
        </Interactable>
      )}
    </group>
  )
}

export function WeaponPickups() {
  return (
    <>
      {WEAPON_PICKUPS.map((p) => (
        <WeaponPickup key={p.id} id={p.id} position={p.position} />
      ))}
    </>
  )
}
