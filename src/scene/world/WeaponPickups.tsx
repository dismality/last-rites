// The four findable weapons as props with an Interactable each (Req 2.1-2.6, 23.8).
// Each weapon is its Blender model lying on a primitive prop (cupboard, table, woodpile, step).
// Whether the weapon can be taken (satchel room, already taken) is
// decided by the pure pickup rule inside takeWeaponPickup; a refusal leaves the prop in place.

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { WEAPON_PICKUP_POSES } from '../../data/itemModels'
import { WEAPON_PICKUPS, type WeaponPickupId } from '../../data/weaponPickups'
import { takeWeaponPickup } from '../../game/state/combatActions'
import { useCombatStore } from '../../game/state/combatStore'
import { Interactable } from './Interactable'
import { GroundItem } from './ItemModel'
import { useLingerAfter } from './useLingering'

const WOOD = '#4a3626'
const STONE = '#6b6a68'

const LOG_COUNT = 9
const LOG_LAYOUT: ReadonlyArray<readonly [number, number, number]> = [
  // x, y, row: three rows stacked in a pyramid.
  [-0.5, 0.12, 0],
  [-0.25, 0.12, 0],
  [0, 0.12, 0],
  [0.25, 0.12, 0],
  [-0.38, 0.34, 0],
  [-0.13, 0.34, 0],
  [0.12, 0.34, 0],
  [-0.25, 0.56, 0],
  [0, 0.56, 0],
]

/** One draw call for the whole pile of logs. */
function Woodpile() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    LOG_LAYOUT.forEach(([x, y], i) => {
      m.makeTranslation(x, y, 0)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, LOG_COUNT]} castShadow>
      <cylinderGeometry args={[0.11, 0.11, 0.9, 8]} />
      <meshStandardMaterial color={WOOD} roughness={0.95} />
    </instancedMesh>
  )
}

/** A small cupboard (revolver) or a low table (shotgun) for the item to rest on. */
function Shelf({ height, width = 0.6 }: { height: number; width?: number }) {
  return (
    <mesh position={[0, -height / 2 - 0.03, 0]}>
      <boxGeometry args={[width, height, 0.4]} />
      <meshStandardMaterial color={STONE} roughness={0.9} />
    </mesh>
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

function Prop({ id }: { id: WeaponPickupId }) {
  switch (id) {
    case 'revolver':
      return (
        <>
          <Shelf height={0.9} />
          <Weapon id={id} />
        </>
      )
    case 'shotgun':
      return (
        <>
          <Shelf height={0.8} width={1} />
          <Weapon id={id} />
        </>
      )
    case 'wood-axe':
      // The woodpile is scenery (WeaponPickup draws it); only the axe is taken and fades.
      return <Weapon id={id} />
    case 'silver-sabre':
      return (
        <>
          <mesh position={[0, -0.17, 0]}>
            <boxGeometry args={[0.9, 0.3, 0.5]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
          <Weapon id={id} />
        </>
      )
  }
}

/** One findable weapon. Taken, it fades with its cues for a moment, then the prop is gone. */
function WeaponPickup({ id, position }: { id: WeaponPickupId; position: readonly [number, number, number] }) {
  const isTaken = useCombatStore((s) => s.takenPickups.includes(id))
  const shown = useLingerAfter(isTaken)
  return (
    <group name={`weapon-pickup:${id}`} position={[...position]}>
      {id === 'wood-axe' && <Woodpile />}
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
          <Prop id={id} />
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
