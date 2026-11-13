// The item models as the workbench draws them (spec 09, task 11m): the stock piles on the bench top
// (own materials, so the ember glow never leaks onto the same item lying in the world) and the flat
// dark silhouette that marks a missing ingredient in the recipe ghost. Meshes only, no lights.

import { Suspense, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DRACO_PATH, assetUrl } from '../../data/assets'
import { ITEM_MAP } from '../../data/items'
import { groundPose } from '../../data/itemModels'
import type { ItemId } from '../../game/types'
import '../assets/preloadModels'

const EMBER = new THREE.Color('#e8913a')
const BLACK = new THREE.Color('#000000')
/** Flat dark fill of the missing-ingredient silhouette. */
const SILHOUETTE_COLOR = '#0d0b09'

type Pos = readonly [number, number, number]

/** A copy of the model whose materials are private to the copy, plus those materials. */
function cloneWithOwnMaterials(scene: THREE.Object3D, count: number) {
  const mats: THREE.MeshStandardMaterial[] = []
  const owned = new Map<THREE.Material, THREE.Material>()
  const roots = Array.from({ length: count }, () => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.Material
      let mine = owned.get(src)
      if (!mine) {
        mine = src.clone()
        owned.set(src, mine)
        if ((mine as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          mats.push(mine as THREE.MeshStandardMaterial)
        }
      }
      mesh.material = mine
    })
    return root
  })
  return { roots, mats, all: [...owned.values()] }
}

/** Ember emissive on the pile's own materials; 0 puts them back to unlit. */
function applyGlow(mats: readonly THREE.MeshStandardMaterial[], intensity: number): void {
  for (const m of mats) {
    m.emissive.copy(intensity > 0 ? EMBER : BLACK)
    m.emissiveIntensity = intensity
  }
}

interface PileProps {
  item: ItemId
  /** Where each copy of the pile stands (bench-top surface points). */
  positions: readonly Pos[]
  scale: number
  craftable: boolean
  highlighted: boolean
  /** Phase offset of the glow pulse, so neighbouring piles do not breathe together. */
  phase: number
}

function LoadedPile({ url, item, positions, scale, craftable, highlighted, phase }: PileProps & { url: string }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  const pose = groundPose(item, scale)
  const copies = useMemo(() => cloneWithOwnMaterials(scene, positions.length), [scene, positions.length])
  useEffect(() => () => copies.all.forEach((m) => m.dispose()), [copies])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    // Craftable piles pulse softly, a hovered recipe's piles faster and stronger (as before the models).
    let intensity = 0
    if (craftable) intensity = 0.35 + Math.sin(t * 3.8) * 0.15
    if (highlighted) intensity = 0.6 + Math.sin(t * 6.0) * 0.25
    applyGlow(copies.mats, intensity)
  })

  return (
    <>
      {copies.roots.map((root, i) => (
        <group key={i} position={[...positions[i]]} rotation={[0, (i * Math.PI) / 3, 0]}>
          <group position={[0, pose.lift, 0]} rotation={[...pose.rotation]} scale={pose.scale}>
            <primitive object={root} />
          </group>
        </group>
      ))}
    </>
  )
}

/** The bench pile of one item: a few copies of its model. */
export function BenchPile(props: PileProps) {
  const path = ITEM_MAP[props.item]?.model
  if (!path) return null
  return (
    <Suspense fallback={null}>
      <LoadedPile {...props} url={assetUrl(path)} />
    </Suspense>
  )
}

function LoadedSilhouette({ url, item, scale }: { url: string; item: ItemId; scale: number }) {
  const { scene } = useGLTF(url, DRACO_PATH)
  const pose = groundPose(item, scale)
  const { root, material } = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({ color: SILHOUETTE_COLOR, transparent: true, opacity: 0.85 })
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) mesh.material = material
    })
    return { root, material }
  }, [scene])
  useEffect(() => () => material.dispose(), [material])
  return (
    <group position={[0, pose.lift, 0]} rotation={[...pose.rotation]} scale={pose.scale}>
      <primitive object={root} />
    </group>
  )
}

/** The model in a flat dark material: the shape of a missing ingredient, without its colour or name. */
export function ItemSilhouette({ item, scale }: { item: ItemId; scale: number }) {
  const path = ITEM_MAP[item]?.model
  if (!path) return null
  return (
    <Suspense fallback={null}>
      <LoadedSilhouette url={assetUrl(path)} item={item} scale={scale} />
    </Suspense>
  )
}
