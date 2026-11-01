// Workbench â€” the keeper's crafting bench in the hut.
//
// When `workbenchOpen` is true the camera smoothly lerps to a fixed view
// above the bench (400 ms / eased). Materials in the player's satchel are
// laid out on the bench surface as instanced geometry piles. The world keeps
// running the whole time (Req 1.4). Pressing Esc or E closes the view.
//
// Crafting tick loop (Req 3.1, 3.3):
//   - Each useFrame tick calls tickCrafting(dt) on the crafting store.
//   - When tickCrafting returns completed=true, commitCraft() is called.
//   - If the player is hit (lastDamageAt changed), cancelCrafting() fires
//     immediately without consuming any inputs.
//
// Architecture note: state lives in worldStore / inventoryStore / craftingStore.
// This component is *rendering only* â€” it reads stores and drives visuals.

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Instances, Instance, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useCraftingStore } from '../../game/state/craftingStore'
import { canCraft } from '../../game/systems/crafting'
import { RECIPES } from '../../data/recipes'
import { playCraftingComplete, playCraftingCancel } from '../../audio/AudioManager'
import type { MaterialId } from '../../game/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fixed camera position and look-at target when the workbench is open.
 * Positioned above the bench surface, looking slightly down along Z.
 */
const BENCH_CAM_POSITION = new THREE.Vector3(0, 1.8, 0.6)
const BENCH_CAM_TARGET = new THREE.Vector3(0, 0.85, -0.5)

/** Lerp factor per-frame for a ~400 ms transition at 60 fps.
 *  Î± = 1 - (1 - target)^(1/frames) where target â‰ˆ 0.995 in 24 frames. */
const LERP_ALPHA = 0.12

/**
 * Bench surface grid origin. Materials are laid out in a 4-column grid from
 * left to right, top row first.
 */
const BENCH_ORIGIN = new THREE.Vector3(-0.55, 0.86, -0.55)

/** Materials in display order. */
const MATERIAL_ORDER: MaterialId[] = [
  'bone',
  'iron-nail',
  'candle-wax',
  'holy-water',
  'cloth',
  'lamp-oil',
  'grave-salt',
]

/** Colours that represent each material visually. */
const MATERIAL_COLOR: Record<MaterialId, string> = {
  'bone': '#e8dcc8',
  'iron-nail': '#8a8a8a',
  'candle-wax': '#f5e6a0',
  'holy-water': '#a0d4f0',
  'cloth': '#c4b090',
  'lamp-oil': '#b8860b',
  'grave-salt': '#ddd8cc',
}

/** Geometry scale per material type â€” gives each pile a distinct silhouette. */
const MATERIAL_SCALE: Record<MaterialId, [number, number, number]> = {
  'bone': [0.04, 0.12, 0.04],
  'iron-nail': [0.02, 0.06, 0.02],
  'candle-wax': [0.06, 0.08, 0.06],
  'holy-water': [0.07, 0.10, 0.07],
  'cloth': [0.10, 0.03, 0.10],
  'lamp-oil': [0.07, 0.09, 0.07],
  'grave-salt': [0.08, 0.04, 0.08],
}

/**
 * Map qty 1â€“10 to 1â€“5 pile meshes so piles grow visually with count.
 * qty â‰¤ 2 â†’ 1, â‰¤ 4 â†’ 2, â‰¤ 6 â†’ 3, â‰¤ 8 â†’ 4, else 5.
 */
function pileCount(qty: number): number {
  if (qty <= 2) return 1
  if (qty <= 4) return 2
  if (qty <= 6) return 3
  if (qty <= 8) return 4
  return 5
}

/**
 * Return positions for `count` pile meshes scattered around `centre` on the
 * XZ plane.  Uses a deterministic pseudo-random spread so it looks organic
 * but is stable across renders.
 */
function pilePositions(centre: THREE.Vector3, count: number): THREE.Vector3[] {
  const offsets: [number, number][] = [
    [0, 0],
    [0.05, 0.04],
    [-0.05, 0.04],
    [0.04, -0.05],
    [-0.04, -0.05],
  ]
  return offsets.slice(0, count).map(([dx, dz]) =>
    new THREE.Vector3(centre.x + dx, centre.y, centre.z + dz),
  )
}

/** Column/row grid layout for up to 7 materials (4 columns). */
function benchPosition(index: number): THREE.Vector3 {
  const col = index % 4
  const row = Math.floor(index / 4)
  return new THREE.Vector3(
    BENCH_ORIGIN.x + col * 0.30,
    BENCH_ORIGIN.y,
    BENCH_ORIGIN.z + row * 0.30,
  )
}

// ---------------------------------------------------------------------------
// CameraRig
// ---------------------------------------------------------------------------

/**
 * Lerps the default camera toward the bench view when `open` is true,
 * and back to where it was when `open` becomes false.
 * Operates in-place on `state.camera` â€” R3F's default camera.
 */
function CameraRig({ open }: { open: boolean }) {
  const { camera } = useThree()
  // Capture the camera position/rotation at the moment the bench opens so we
  // can return to it faithfully when it closes.
  const returnPos = useRef(new THREE.Vector3())
  const returnQuat = useRef(new THREE.Quaternion())
  const wasOpen = useRef(false)
  // Scratch objects pre-allocated to avoid GC.
  const targetPos = useRef(new THREE.Vector3())
  const targetQuat = useRef(new THREE.Quaternion())
  const lookAtMatrix = useRef(new THREE.Matrix4())

  useFrame(() => {
    if (open && !wasOpen.current) {
      // Just opened â€” save current camera transform for return trip.
      returnPos.current.copy(camera.position)
      returnQuat.current.copy(camera.quaternion)
      wasOpen.current = true
    }
    if (!open && wasOpen.current) {
      wasOpen.current = false
    }

    if (open) {
      // Lerp toward bench view.
      targetPos.current.copy(BENCH_CAM_POSITION)
      lookAtMatrix.current.lookAt(BENCH_CAM_POSITION, BENCH_CAM_TARGET, camera.up)
      targetQuat.current.setFromRotationMatrix(lookAtMatrix.current)
    } else {
      // Lerp back to the saved first-person position.
      targetPos.current.copy(returnPos.current)
      targetQuat.current.copy(returnQuat.current)
    }

    camera.position.lerp(targetPos.current, LERP_ALPHA)
    camera.quaternion.slerp(targetQuat.current, LERP_ALPHA)
  })

  return null
}

// Phase counter — incremented once per MaterialPile mount so each pile starts
// at a different point in its animation sine wave. Module-level so it is never
// called during component render (satisfies react-hooks/purity rule).
let pilePhaseCounter = 0
const PILE_PHASE_STEP = (Math.PI * 2) / 7 // spread 7 materials evenly

// ---------------------------------------------------------------------------
// MaterialPile
// ---------------------------------------------------------------------------

interface MaterialPileProps {
  materialId: MaterialId
  qty: number
  position: THREE.Vector3
  /** True when this material is part of a craftable recipe. */
  craftable?: boolean
  /** True when the recipe-book hover highlights this material. */
  highlighted?: boolean
}

/**
 * Renders qty-scaled pile of instanced box meshes for one material type.
 * - Craftable piles pulse with ember emissive intensity so bloom catches it.
 * - Highlighted piles (recipe hover) pulse more strongly and add a rune label.
 */
function MaterialPile({ materialId, qty, position, craftable = false, highlighted = false }: MaterialPileProps) {
  const count = pileCount(qty)
  const positions = useMemo(() => pilePositions(position, count), [position, count])
  const scale = MATERIAL_SCALE[materialId]
  const color = MATERIAL_COLOR[materialId]

  // Ref to the shared material so we can animate emissiveIntensity each frame.
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  // Phase offset: use a module-level counter so each pile starts at a
  // different point in the sine wave without calling Math.random() during render.
  const timeRef = useRef(pilePhaseCounter++ * PILE_PHASE_STEP)

  useFrame((_, delta) => {
    if (!matRef.current) return
    timeRef.current += delta

    let intensity = 0.15 // base
    if (craftable) {
      // Slow ember pulse: 0.35 â†’ 0.65 at ~0.6 Hz
      intensity = 0.35 + Math.sin(timeRef.current * 3.8) * 0.15
    }
    if (highlighted) {
      // Faster, stronger pulse when the recipe-book hovers over this item.
      intensity = 0.6 + Math.sin(timeRef.current * 6.0) * 0.25
    }

    matRef.current.emissiveIntensity = intensity
  })

  // Ember colour when glowing; otherwise the pile's own natural colour.
  const emissiveColor = (craftable || highlighted) ? '#e8913a' : color

  return (
    <group>
      <Instances limit={5}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={emissiveColor}
          emissiveIntensity={0.15}
          roughness={0.8}
          metalness={materialId === 'iron-nail' ? 0.6 : 0.0}
        />
        {positions.map((pos, i) => (
          <Instance
            key={i}
            position={[pos.x, pos.y + (scale[1] * 0.5), pos.z]}
            scale={scale}
            // Slight rotation variation for organic look
            rotation={[0, (i * Math.PI) / 3, 0]}
          />
        ))}
      </Instances>

      {/* Rune sprite above craftable pile â€” floats up slowly */}
      {craftable && (
        <Html
          position={[position.x, position.y + 0.28, position.z]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            color: '#e8913a',
            fontFamily: 'serif',
            fontSize: '10px',
            textShadow: '0 0 6px #e8913a',
            opacity: highlighted ? 1 : 0.75,
            transition: 'opacity 150ms ease-out',
          }}
        >
          âœ¦
        </Html>
      )}

      {/* Numeric quantity label floating above the pile */}
      <Html
        position={[position.x, position.y + 0.18, position.z]}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          color: highlighted ? '#f5b878' : '#d8c9a3',
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: '11px',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 1px 3px #14110f',
          whiteSpace: 'nowrap',
          transition: 'color 150ms ease-out',
        }}
      >
        {qty}
      </Html>
    </group>
  )
}

// ---------------------------------------------------------------------------
// BenchSurface
// ---------------------------------------------------------------------------

/**
 * The physical bench table â€” a flat box the materials sit on.
 * Position matches BENCH_ORIGIN so the camera rig frames it well.
 */
function BenchSurface() {
  return (
    <mesh position={[0, 0.8, -0.5]} receiveShadow>
      <boxGeometry args={[1.4, 0.06, 0.8]} />
      <meshStandardMaterial color="#5c3d1e" roughness={0.9} metalness={0} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Workbench (main export)
// ---------------------------------------------------------------------------

/**
 * Drop this component inside the R3F `<Canvas>` subtree.
 * It mounts unconditionally so the bench and camera rig are always present;
 * `workbenchOpen` in worldStore gates whether the camera lerps to the bench.
 */
export function Workbench() {
  const workbenchOpen = useUiWorldStore((s) => s.workbenchOpen)
  const closeWorkbench = useUiWorldStore((s) => s.closeWorkbench)
  const lastDamageAt = useUiWorldStore((s) => s.lastDamageAt)
  const inventory = useInventoryStore((s) => s.inventory)
  const highlightedItems = useCraftingStore((s) => s.highlightedItems)
  const unlockedRecipes = useCraftingStore((s) => s.unlockedRecipes)
  const tickCrafting = useCraftingStore((s) => s.tickCrafting)
  const commitCraft = useCraftingStore((s) => s.commitCraft)
  const cancelCrafting = useCraftingStore((s) => s.cancelCrafting)
  const craftingProgress = useCraftingStore((s) => s.craftingProgress)

  // Track last known damage timestamp so we fire cancel exactly once per hit.
  const prevDamageAt = useRef(lastDamageAt)

  // ----- Keyboard handling: Esc or E closes the workbench -----
  useEffect(() => {
    if (!workbenchOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.preventDefault()
        closeWorkbench()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workbenchOpen, closeWorkbench])

  // ----- Pointer lock: release on open, re-acquire on close -----
  useEffect(() => {
    if (workbenchOpen) {
      // Release pointer lock so the player can interact with the recipe book UI.
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    }
    // Re-acquiring pointer lock is handled by the first-person controller
    // when it detects workbenchOpen === false.
  }, [workbenchOpen])

  // ----- Crafting tick: advance timer and commit when done (Req 3.1) -----
  useFrame((_, delta) => {
    // Cancel-on-hit check: if damage was registered since last frame (Req 3.3).
    if (lastDamageAt !== prevDamageAt.current) {
      prevDamageAt.current = lastDamageAt
      if (craftingProgress !== null) {
        cancelCrafting()
        playCraftingCancel()
        return // skip tick this frame; craft was cancelled
      }
    }

    // Advance timer and commit when elapsed >= duration.
    const { completed, recipeId } = tickCrafting(delta)
    if (completed && recipeId !== null) {
      const result = commitCraft(recipeId)
      if (result.ok) {
        playCraftingComplete()
      } else if (result.error === 'no-capacity') {
        // TODO(ui): surface a "satchel full" toast message to the player.
        // For now a console warning keeps the information accessible during dev.
        console.warn('[Workbench] craft failed: satchel full')
      }
    }
  })

  // ----- Derive which materials are present in the satchel -----
  const materialPiles = useMemo(() => {
    const totals = new Map<MaterialId, number>()
    for (const stack of inventory.slots) {
      // Only materials (not crafted tools) go on the bench surface display.
      if (MATERIAL_ORDER.includes(stack.item as MaterialId)) {
        const id = stack.item as MaterialId
        totals.set(id, (totals.get(id) ?? 0) + stack.qty)
      }
    }
    return MATERIAL_ORDER
      .filter((id) => (totals.get(id) ?? 0) > 0)
      .map((id, index) => ({
        id,
        qty: totals.get(id)!,
        position: benchPosition(index),
      }))
  }, [inventory.slots])

  // ----- Derive which materials are in ANY craftable unlocked recipe -----
  const craftableMaterials = useMemo(() => {
    const set = new Set<MaterialId>()
    const unlockedSet = new Set(unlockedRecipes)
    for (const recipe of RECIPES) {
      if (!unlockedSet.has(recipe.id)) continue
      const result = canCraft(inventory, recipe)
      if (result.ok) {
        for (const input of recipe.inputs) {
          if (MATERIAL_ORDER.includes(input.item as MaterialId)) {
            set.add(input.item as MaterialId)
          }
        }
      }
    }
    return set
  }, [inventory, unlockedRecipes])

  return (
    <>
      {/* Camera rig runs every frame regardless of open state so the return
          lerp is smooth. */}
      <CameraRig open={workbenchOpen} />

      {/* Bench geometry â€” always visible in the scene. */}
      <group name="workbench" position={[0, 0, 0]}>
        <BenchSurface />

        {/* Material piles â€” only rendered when the workbench is open so the
            bench isn't cluttered during normal play. */}
        {workbenchOpen &&
          materialPiles.map(({ id, qty, position }) => (
            <MaterialPile
              key={id}
              materialId={id}
              qty={qty}
              position={position}
              craftable={craftableMaterials.has(id)}
              highlighted={highlightedItems.has(id)}
            />
          ))}

        {/* Point light on the bench surface to warm up the material colours. */}
        {workbenchOpen && (
          <pointLight
            position={[0, 1.5, -0.5]}
            intensity={8}
            distance={3}
            color="#e8913a"
            castShadow={false}
          />
        )}
      </group>
    </>
  )
}
