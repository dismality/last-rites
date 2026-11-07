// Overlay <Canvas> for examine mode: one item, a warm key light, orbit-only controls.
// Reveal rules live in game/systems/examine.ts; this only feeds it the camera direction.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ITEM_MAP } from '../../data/items'
import { useExamineStore } from '../../game/state/examineStore'
import {
  INITIAL_CLUE_STATE,
  isMarkFacing,
  stepClueReveal,
  type ClueRevealState,
} from '../../game/systems/examine'
import type { ItemId } from '../../game/types'

/** Longest model edge is scaled to this so every item fills the view the same way. */
const FIT_SIZE = 1.4
const MIN_ZOOM = 1.2
const MAX_ZOOM = 5
const START_DISTANCE = 3

function ItemModel({ path }: { path: string }) {
  const { scene } = useGLTF(`/${path}`)
  const { object, scale } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    clone.position.sub(centre)
    return { object: clone, scale: FIT_SIZE / Math.max(size.x, size.y, size.z, 1e-3) }
  }, [scene])
  return <primitive object={object} scale={scale} />
}

/** Stand-in for items without a model (ledger, journal pages): a small parchment slab. */
function PlaceholderModel() {
  return (
    <mesh>
      <boxGeometry args={[1, 0.08, 1.3]} />
      <meshStandardMaterial color="#d8c9a3" roughness={0.9} />
    </mesh>
  )
}

function ClueWatcher({ itemId }: { itemId: ItemId }) {
  const clue = ITEM_MAP[itemId].clue
  const camera = useThree((s) => s.camera)
  const state = useRef<ClueRevealState>(INITIAL_CLUE_STATE)
  const dir = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    state.current = INITIAL_CLUE_STATE
  }, [itemId])
  useFrame((_s, delta) => {
    if (!clue || state.current.revealed) return
    // The model never rotates (the camera orbits), so local normal == world normal.
    camera.getWorldDirection(dir)
    const facing = isMarkFacing([dir.x, dir.y, dir.z], clue.normal)
    state.current = stepClueReveal(state.current, facing, delta)
    if (state.current.revealed) useExamineStore.getState().setClueRevealed()
  })
  return null
}

export function ExamineScene({ itemId }: { itemId: ItemId }) {
  const model = ITEM_MAP[itemId].model
  return (
    <Canvas
      camera={{ position: [0, 0.6, START_DISTANCE], fov: 40 }}
      aria-label="Rotatable 3D view of the item"
      gl={{ alpha: true }}
    >
      {/* Warm key light from upper left, faint cold fill so the far side never goes black. */}
      <ambientLight intensity={0.35} color="#9fb3c8" />
      <directionalLight position={[-2, 3, 3]} intensity={2.2} color="#f5b878" />
      <Suspense fallback={null}>{model ? <ItemModel path={model} /> : <PlaceholderModel />}</Suspense>
      <ClueWatcher itemId={itemId} />
      <OrbitControls
        enablePan={false}
        enableDamping
        minDistance={MIN_ZOOM}
        maxDistance={MAX_ZOOM}
      />
    </Canvas>
  )
}
