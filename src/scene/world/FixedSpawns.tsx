// Keys and relics lying in the world, drawn with the hero models from items.ts.
// Which ones exist right now (collected, night-only) is decided by the pure
// spawn rules; taking one hands it to examine mode.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { ITEM_MAP } from '../../data/items'
import { assetUrl } from '../../data/assets'
import { useSpawnStore } from '../../game/state/spawnStore'
import { useWorldStore } from '../../game/state/worldStore'
import { availableFixedSpawns } from '../../game/systems/spawns'
import '../assets/preloadModels'
import { Interactable } from './Interactable'

/**
 * Hero models are real-world size (a key is about 10 cm), which is invisible from
 * eye height. Blow them up for the world view; examine mode fits them to the screen.
 */
const WORLD_DISPLAY_SCALE = 3

/** Models stand upright in their own space; lay them down so they rest on the ground. */
const LYING_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]

function HeroItem({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  // Clone so two spawns of the same model never share a transform.
  const object = useMemo(() => scene.clone(true), [scene])
  return (
    <group scale={WORLD_DISPLAY_SCALE} rotation={LYING_ROTATION} position={[0, 0.03, 0]}>
      <primitive object={object} />
    </group>
  )
}

export function FixedSpawns() {
  const world = useSpawnStore((s) => s.world)
  const collect = useSpawnStore((s) => s.collectFixed)
  const phase = useWorldStore((s) => s.phase)
  const spawns = useMemo(
    () => availableFixedSpawns(world, phase).filter((s) => ITEM_MAP[s.item].model),
    [world, phase],
  )

  return (
    <>
      {spawns.map((s) => {
        const model = ITEM_MAP[s.item].model
        if (!model) return null
        return (
          <group key={s.id} position={[...s.position]}>
            <Interactable
              id={`fixed:${s.id}`}
              action="examine"
              size={[0.4, 0.2, 0.4]}
              runeHeight={0.5}
              onInteract={() => collect(s.id)}
            >
              <HeroItem url={assetUrl(model)} />
            </Interactable>
          </group>
        )
      })}
    </>
  )
}
