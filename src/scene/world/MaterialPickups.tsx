// Renders every material stack lying at a spawn point as an Interactable.
// Acceptance is decided by the pure pickup rule; a refused pickup leaves the mesh in place and the
// prompt says "Satchel full". A taken stack lingers for the cue fade, then is gone.

import { useMemo } from 'react'
import { SPAWN_POINTS } from '../../data/zones'
import { ITEM_MAP } from '../../data/items'
import { useSpawnStore } from '../../game/state/spawnStore'
import type { ItemId } from '../../game/types'
import { Interactable } from './Interactable'
import { MaterialShape } from './MaterialShape'
import { useLingering } from './useLingering'

interface StackView {
  key: string
  /** Interactable id and subject. */
  id: string
  subject: string
  spawnId: string
  index: number
  item: ItemId
  position: readonly [number, number, number]
}

export function MaterialPickups() {
  const materials = useSpawnStore((s) => s.world.materials)
  const collect = useSpawnStore((s) => s.collectMaterial)
  const drops = useSpawnStore((s) => s.drops)
  const collectDrop = useSpawnStore((s) => s.collectDrop)

  const stacks = useMemo<StackView[]>(
    () =>
      SPAWN_POINTS.flatMap((p) =>
        (materials[p.id] ?? []).map((stack, i) => ({
          key: `${p.id}:${i}:${stack.item}`,
          id: `pickup:${p.id}:${i}`,
          subject: `${p.id}:${i}`,
          spawnId: p.id,
          index: i,
          item: stack.item,
          position: p.position,
        })),
      ),
    [materials],
  )
  const stackList = useLingering(stacks, (s) => s.key)
  const dropList = useLingering(drops, (d) => d.id)

  return (
    <>
      {/* Stacks the player dropped from the satchel. */}
      {dropList.map(({ item: d, key, gone }) => (
        <group key={key} position={[...d.position]}>
          <Interactable
            kind="dropped-stack"
            subject={d.id}
            usedUp={gone}
            id={gone ? `pickup:${d.id}~gone` : `pickup:${d.id}`}
            size={[0.3, 0.3, 0.3]}
            runeHeight={0.5}
            onInteract={() => collectDrop(d.id)}
          >
            <group name={ITEM_MAP[d.item].name}>
              <MaterialShape item={d.item} />
            </group>
          </Interactable>
        </group>
      ))}
      {stackList.map(({ item: s, key, gone }) => (
        <group key={key} position={[...s.position]}>
          <Interactable
            kind="material-pickup"
            subject={s.subject}
            usedUp={gone}
            id={gone ? `${s.id}~gone` : s.id}
            size={[0.3, 0.3, 0.3]}
            runeHeight={0.5}
            onInteract={() => collect(s.spawnId, s.index)}
          >
            <group name={ITEM_MAP[s.item].name} position={[s.index * 0.35, 0, 0]}>
              <MaterialShape item={s.item} />
            </group>
          </Interactable>
        </group>
      ))}
    </>
  )
}
