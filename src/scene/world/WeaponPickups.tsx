// The four findable weapons as props with an Interactable each (Req 2.1-2.6, 23.8).
// Primitive meshes only. Whether the weapon can be taken (satchel room, already taken) is
// decided by the pure pickup rule inside takeWeaponPickup; a refusal leaves the prop in place.

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { WEAPON_PICKUPS, type WeaponPickupId } from '../../data/weaponPickups'
import { takeWeaponPickup } from '../../game/state/combatActions'
import { useCombatStore } from '../../game/state/combatStore'
import { Interactable } from './Interactable'
import { useLingerAfter } from './useLingering'

const WOOD = '#4a3626'
const IRON = '#5a5d60'
const SILVER = '#b9c2cc'
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

function AxeProp() {
  return (
    <group rotation={[0, 0.5, -0.9]}>
      <mesh>
        <cylinderGeometry args={[0.02, 0.025, 0.7, 6]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
      <mesh position={[0.07, 0.3, 0]}>
        <boxGeometry args={[0.16, 0.1, 0.03]} />
        <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  )
}

function SabreProp() {
  return (
    <group rotation={[Math.PI / 2, 0, 0.4]}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.04, 0.6, 0.01]} />
        <meshStandardMaterial color={SILVER} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.16, 0.02, 0.02]} />
        <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
    </group>
  )
}

function RevolverProp() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.22, 0.05, 0.04]} />
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[-0.08, -0.07, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.05, 0.12, 0.04]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
    </group>
  )
}

function ShotgunProp() {
  return (
    <group rotation={[0, 0.3, 0]}>
      {[-0.02, 0.02].map((z) => (
        <mesh key={z} position={[0.15, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.7, 6]} />
          <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-0.28, -0.03, 0]}>
        <boxGeometry args={[0.25, 0.06, 0.05]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A small cupboard (revolver) or a low table (shotgun) for the item to rest on. */
function Shelf({ height }: { height: number }) {
  return (
    <mesh position={[0, -height / 2 - 0.03, 0]}>
      <boxGeometry args={[0.6, height, 0.4]} />
      <meshStandardMaterial color={STONE} roughness={0.9} />
    </mesh>
  )
}

function Prop({ id }: { id: WeaponPickupId }) {
  switch (id) {
    case 'revolver':
      return (
        <>
          <Shelf height={0.9} />
          <RevolverProp />
        </>
      )
    case 'shotgun':
      return (
        <>
          <Shelf height={0.8} />
          <group position={[0, 0.05, 0]}>
            <ShotgunProp />
          </group>
        </>
      )
    case 'wood-axe':
      // The woodpile is scenery (WeaponPickup draws it); only the axe is taken and fades.
      return (
        <group position={[0, 0.8, 0.12]}>
          <AxeProp />
        </group>
      )
    case 'silver-sabre':
      return (
        <>
          <mesh position={[0, -0.17, 0]}>
            <boxGeometry args={[0.9, 0.3, 0.5]} />
            <meshStandardMaterial color={STONE} roughness={0.95} />
          </mesh>
          <SabreProp />
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
          size={[0.8, 0.8, 0.8]}
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
