// Renders every material stack lying at a spawn point as an Interactable.
// Acceptance is decided by the pure pickup rule; a refused pickup leaves the mesh in place.

import { SPAWN_POINTS } from '../../data/zones'
import { ITEM_MAP } from '../../data/items'
import { useSpawnStore } from '../../game/state/spawnStore'
import { Interactable } from './Interactable'
import { MaterialShape } from './MaterialShape'

export function MaterialPickups() {
  const materials = useSpawnStore((s) => s.world.materials)
  const collect = useSpawnStore((s) => s.collectMaterial)
  const drops = useSpawnStore((s) => s.drops)
  const collectDrop = useSpawnStore((s) => s.collectDrop)

  return (
    <>
      {/* Stacks the player dropped from the satchel. */}
      {drops.map((d) => (
        <group key={d.id} position={[...d.position]}>
          <Interactable
            id={`pickup:${d.id}`}
            action="pickup"
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
      {SPAWN_POINTS.flatMap((p) =>
        (materials[p.id] ?? []).map((stack, i) => (
          <group key={`${p.id}:${i}:${stack.item}`} position={[...p.position]}>
            <Interactable
              id={`pickup:${p.id}:${i}`}
              action="pickup"
              size={[0.3, 0.3, 0.3]}
              runeHeight={0.5}
              onInteract={() => collect(p.id, i)}
            >
              <group name={ITEM_MAP[stack.item].name} position={[i * 0.35, 0, 0]}>
                <MaterialShape item={stack.item} />
              </group>
            </Interactable>
          </group>
        )),
      )}
    </>
  )
}
