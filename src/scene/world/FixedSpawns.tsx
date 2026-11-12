// Keys, relics, journal pages and the ledger lying in the world. Keys and relics use the
// hero models from items.ts; pages and the ledger have no model, so they are drawn as a
// torn sheet and a small book.
// Which ones exist right now (collected, night-only) is decided by the pure
// spawn rules; taking one hands it to examine mode.

import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { ITEM_MAP } from '../../data/items'
import { assetUrl } from '../../data/assets'
import { useSpawnStore } from '../../game/state/spawnStore'
import { useWorldStore } from '../../game/state/worldStore'
import { availableFixedSpawns } from '../../game/systems/spawns'
import '../assets/preloadModels'
import { Interactable } from './Interactable'
import { useLingering } from './useLingering'

/**
 * Hero models are real-world size (a key is about 10 cm), which is invisible from
 * eye height. Blow them up for the world view; examine mode fits them to the screen.
 */
const WORLD_DISPLAY_SCALE = 3

/** Models stand upright in their own space; lay them down so they rest on the ground. */
const LYING_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]

/** Ragged outline, built once: a rough rectangle with a torn top edge and a clipped corner. */
function tornPaperShape(): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-0.14, -0.2)
  s.lineTo(0.15, -0.19)
  s.lineTo(0.16, 0.12)
  s.lineTo(0.1, 0.16)
  s.lineTo(0.06, 0.13)
  s.lineTo(0.0, 0.2)
  s.lineTo(-0.05, 0.14)
  s.lineTo(-0.1, 0.19)
  s.lineTo(-0.15, 0.1)
  s.closePath()
  return s
}

const PAPER_GEOMETRY = new THREE.ShapeGeometry(tornPaperShape())
// Faint handwriting lines so the sheet reads as a page, not a tile. Plain boxes, no texture.
const INK_LINES = [-0.1, -0.04, 0.02, 0.08] as const

/** A journal page: a flat torn sheet with ink lines, lying slightly askew. */
function TornPaper({ seed }: { seed: number }) {
  return (
    <group position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, seed * 0.9]}>
      <mesh geometry={PAPER_GEOMETRY}>
        <meshStandardMaterial color="#d8c9a3" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {INK_LINES.map((y, i) => (
        <mesh key={y} position={[-0.01, y, 0.002]}>
          <planeGeometry args={[0.2 - i * 0.025, 0.012]} />
          <meshBasicMaterial color="#3b2a1a" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** The parish ledger: a closed, dark leather book. */
function LedgerBook() {
  return (
    <group position={[0, 0.04, 0]} rotation={[0, 0.5, 0]}>
      <mesh>
        <boxGeometry args={[0.28, 0.07, 0.38]} />
        <meshStandardMaterial color="#3a2418" roughness={0.85} />
      </mesh>
      <mesh position={[0.01, 0, 0]}>
        <boxGeometry args={[0.26, 0.05, 0.36]} />
        <meshStandardMaterial color="#c9b88c" roughness={0.95} />
      </mesh>
    </group>
  )
}

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
              size={[0.4, 0.2, 0.4]}
              runeHeight={0.5}
              onInteract={() => collect(s.id)}
            >
              {model ? (
                <HeroItem url={assetUrl(model)} />
              ) : pageNo ? (
                <TornPaper seed={Number(pageNo)} />
              ) : (
                <LedgerBook />
              )}
            </Interactable>
          </group>
        )
      })}
    </>
  )
}
