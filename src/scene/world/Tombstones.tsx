// Readable tombstones. Rendering and interaction only: what a stone says and whether
// it is a wrong grave come from data/tombstones.ts and systems/tombstones.ts via the store.
// Mount inside <Physics>.
import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { type HeadstoneKind, type Placement } from '../../data/cemeteryLayout'
import { headstoneCollider, headstoneScale } from '../../data/colliderFootprints'
import { TOMBSTONES } from '../../data/tombstones'
import { useTombstoneStore } from '../../game/state/tombstoneStore'
import { InstancedModel } from './InstancedModel'
import { Interactable } from './Interactable'

export function Tombstones() {
  // One instanced draw per model kind keeps the draw-call budget flat.
  const byKind = useMemo(() => {
    const groups = new Map<HeadstoneKind, Placement[]>()
    for (const t of TOMBSTONES) {
      const s = headstoneScale(t.height)
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
      {TOMBSTONES.map((t) => {
        // The group carries position and yaw, so the collider is cut in the stone's own space.
        const c = headstoneCollider(t.model, headstoneScale(t.height), [0, 0, 0], 0)
        const [hx, hy, hz] = c.half
        return (
          <group key={t.id} position={t.position} rotation={[0, t.rotationY, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[hx, hy, hz]} position={[...c.position]} />
            </RigidBody>
            <Interactable
              id={`tombstone-${t.id}`}
              kind="tombstone"
              subject={t.id}
              runeHeight={hy * 2 + 0.4}
              onInteract={() => useTombstoneStore.getState().open(t.id)}
            >
              <mesh visible={false} position={[c.position[0], hy, c.position[2]]}>
                <boxGeometry args={[hx * 2 + 0.2, hy * 2, hz * 2 + 0.4]} />
              </mesh>
            </Interactable>
          </group>
        )
      })}
    </>
  )
}
