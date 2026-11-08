// Readable tombstones. Rendering and interaction only: what a stone says and whether
// it is a wrong grave come from data/tombstones.ts and systems/tombstones.ts via the store.
// Mount inside <Physics>.
import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import {
  HEADSTONE,
  HEADSTONE_MODEL_HEIGHT,
  type HeadstoneKind,
  type Placement,
} from '../../data/cemeteryLayout'
import { TOMBSTONES } from '../../data/tombstones'
import { useTombstoneStore } from '../../game/state/tombstoneStore'
import { InstancedModel } from './InstancedModel'
import { Interactable } from './Interactable'

export function Tombstones() {
  // One instanced draw per model kind keeps the draw-call budget flat.
  const byKind = useMemo(() => {
    const groups = new Map<HeadstoneKind, Placement[]>()
    for (const t of TOMBSTONES) {
      const s = t.height / HEADSTONE_MODEL_HEIGHT
      const list = groups.get(t.model) ?? []
      list.push({ position: t.position, rotationY: t.rotationY, scale: [s, s, s] })
      groups.set(t.model, list)
    }
    return [...groups.entries()]
  }, [])

  return (
    <>
      {byKind.map(([kind, placements]) => (
        <InstancedModel key={kind} model={kind} placements={placements} />
      ))}
      {TOMBSTONES.map((t) => (
        <group key={t.id} position={t.position} rotation={[0, t.rotationY, 0]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[HEADSTONE.width / 2, t.height / 2, HEADSTONE.depth / 2]}
              position={[0, t.height / 2, 0]}
            />
          </RigidBody>
          <Interactable
            id={`tombstone-${t.id}`}
            action="read"
            size={[HEADSTONE.width + 0.2, t.height, HEADSTONE.depth + 0.2]}
            runeHeight={t.height + 0.4}
            onInteract={() => useTombstoneStore.getState().open(t.id)}
          >
            <mesh visible={false} position={[0, t.height / 2, 0]}>
              <boxGeometry args={[HEADSTONE.width + 0.2, t.height, HEADSTONE.depth + 0.4]} />
            </mesh>
          </Interactable>
        </group>
      ))}
    </>
  )
}
