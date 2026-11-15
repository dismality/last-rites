// The keeper's hut: the Blender scene (hut.glb, spec 09 task 11n-b) over the game's own wall
// colliders, with the workbench against its back wall. The door is in the +Z wall, behind the
// player at the start, so the first view is the bench. The box walls stay as invisible colliders
// so every door and zombie rule is untouched; the model draws everything you see. Furniture
// colliders (tables, stove, cot, barrels, log stack, vending machine) come from hut.json.
// Mount inside <Physics>.

import { useLayoutEffect, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Group } from 'three'
import { DRACO_PATH, HUT_MODEL_URL, VENDING_MACHINE_MODEL_URL } from '../../data/assets'
import { HUT } from '../../data/cemeteryLayout'
import { HUT_BOXES, VENDING_MACHINE } from '../../data/hutScenery'
import '../assets/preloadModels'
import { Slab } from './buildingParts'

const DOOR_HEIGHT = 2.1

/** The hut and the vending machine, both drawn from their models. */
function HutModels() {
  const hut = useGLTF(HUT_MODEL_URL, DRACO_PATH).scene
  const vending = useGLTF(VENDING_MACHINE_MODEL_URL, DRACO_PATH).scene
  const hutRef = useRef<Group>(null)
  const vendingRef = useRef<Group>(null)

  useLayoutEffect(() => {
    for (const g of [hutRef.current, vendingRef.current]) {
      g?.traverse((o) => {
        if ('isMesh' in o) o.receiveShadow = true
      })
    }
  }, [hut, vending])

  return (
    <>
      <Clone ref={hutRef} object={hut} />
      {/* Visual and collider only; the vending panel is spec 11 H6. */}
      <Clone
        ref={vendingRef}
        object={vending}
        position={[...VENDING_MACHINE.position]}
        rotation={[0, VENDING_MACHINE.rotationY, 0]}
      />
    </>
  )
}

export function Hut() {
  const { halfX, halfZ, height: h, wallThickness: t, doorWidth } = HUT
  const frontW = halfX - doorWidth / 2
  const frontX = doorWidth / 2 + frontW / 2

  return (
    <group name="hut">
      <HutModels />
      <RigidBody type="fixed" colliders={false}>
        {/* Walls: collider only. The model draws them. */}
        <Slab position={[0, h / 2, -halfZ]} size={[halfX * 2 + t, h, t]} material="wood" visible={false} />
        <Slab position={[-halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="wood" visible={false} />
        <Slab position={[halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="wood" visible={false} />
        <Slab position={[-frontX, h / 2, halfZ]} size={[frontW, h, t]} material="wood" visible={false} />
        <Slab position={[frontX, h / 2, halfZ]} size={[frontW, h, t]} material="wood" visible={false} />
        <Slab
          position={[0, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, halfZ]}
          size={[doorWidth, h - DOOR_HEIGHT, t]}
          material="darkWood"
          visible={false}
        />
        {/* Tables, stove, cot, barrels, log stack and the vending machine, from hut.json. */}
        {HUT_BOXES.map((b) => (
          <CuboidCollider
            key={b.note}
            args={[b.half[0], b.half[1], b.half[2]]}
            position={[...b.center]}
            rotation={[0, b.rotY, 0]}
          />
        ))}
      </RigidBody>

      {/* A warm fill at the model's hanging lantern, so the hut reads as lived in. No shadow.
          No stove ember light: a light more changes every material's shader cost, and the stove's
          ember material is emissive. */}
      <pointLight position={[0, h - 0.4, 0]} color="#e8913a" intensity={2} distance={7} decay={2} />
    </group>
  )
}
