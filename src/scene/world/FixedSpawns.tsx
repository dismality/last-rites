// Keys, relics, journal pages and the ledger lying in the world. Keys and relics are upright hero
// models laid down here; pages and the ledger are modelled flat and rest as they are
// (journal-page.glb for all five pages, parish-ledger.glb).
// Which ones exist right now (collected, night-only) is decided by the pure
// spawn rules; taking one hands it to examine mode.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { ITEM_MAP } from '../../data/items'
import { itemSizeM } from '../../data/itemModels'
import { assetUrl } from '../../data/assets'
import { useSpawnStore } from '../../game/state/spawnStore'
import { useWorldStore } from '../../game/state/worldStore'
import { availableFixedSpawns } from '../../game/systems/spawns'
import '../assets/preloadModels'
import { Interactable } from './Interactable'
import { GroundItem } from './ItemModel'
import { useLingering } from './useLingering'

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
  const available = useMemo(() => availableFixedSpawns(world, phase), [world, phase])
  // A taken key, relic or page lingers for the cue fade instead of blinking out.
  const spawns = useLingering(available, (s) => s.id)

  return (
    <>
      {spawns.map(({ item: s, gone }) => {
        const model = ITEM_MAP[s.item].model
        const pageNo = /^journal-page-([1-5])$/.exec(s.item)?.[1]
        return (
          <group key={s.id} position={[...s.position]}>
            <Interactable
              kind="fixed-spawn"
              subject={s.id}
              usedUp={gone}
              id={gone ? `fixed:${s.id}~gone` : `fixed:${s.id}`}
              runeHeight={0.5}
              onInteract={() => collect(s.id)}
            >
              {itemSizeM(s.item) ? (
                // Pages and the ledger lie flat on whatever is under them; each page lies a
                // little differently.
                // A sloped rest (the lectern) tilts the whole page, so it lies flat on the slope.
                <group rotation={[-((s.tiltDeg ?? 0) * Math.PI) / 180, 0, 0]}>
                  <GroundItem item={s.item} yaw={pageNo ? Number(pageNo) * 0.9 : 0.5} />
                </group>
              ) : model ? (
                <HeroItem url={assetUrl(model)} />
              ) : null}
            </Interactable>
          </group>
        )
      })}
    </>
  )
}
