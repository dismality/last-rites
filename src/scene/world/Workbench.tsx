// Workbench — the keeper's crafting bench in the hut.
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
// This component is *rendering only* — it reads stores and drives visuals.

import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BenchPile, ItemSilhouette } from './BenchItemModels'
import * as THREE from 'three'
import { useUiWorldStore } from '../../game/state/uiWorldStore'
import { useCinematic } from '../../game/state/menuState'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useCraftingStore } from '../../game/state/craftingStore'
import { emit } from '../../game/events'
import { canCraft } from '../../game/systems/crafting'
import { RECIPES, RECIPE_MAP } from '../../data/recipes'
import { ghostView, recipeCard } from '../../ui/workbench/recipeView'
import { playCraftingComplete, playCraftingCancel } from '../../audio/AudioManager'
import type { ItemId, MaterialId } from '../../game/types'
import { ITEM_MAP } from '../../data/items'
import { fitScale } from '../../data/itemModels'
import { GroundItem } from './ItemModel'
import { workbenchCameraRuntime } from './workbenchCameraRuntime'
import { Interactable } from './Interactable'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BENCH_Z } from '../../data/cemeteryLayout'
import { rampIntensity } from '../../game/systems/lightRamp'
import { BenchOpenProbe } from '../perf/BenchOpenProbe'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fixed camera position and look-at target when the workbench is open.
 * Positioned above the bench surface, looking slightly down along Z.
 */
const BENCH_CAM_POSITION = new THREE.Vector3(0, 1.8, BENCH_Z + 1.1)
const BENCH_CAM_TARGET = new THREE.Vector3(0, 0.85, BENCH_Z)

/**
 * Bench surface grid origin. Materials are laid out in a 4-column grid from
 * left to right, top row first.
 */
const BENCH_ORIGIN = new THREE.Vector3(-0.55, 0.86, BENCH_Z - 0.05)

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
  bone: '#e8dcc8',
  'iron-nail': '#8a8a8a',
  'candle-wax': '#f5e6a0',
  'holy-water': '#a0d4f0',
  cloth: '#c4b090',
  'lamp-oil': '#b8860b',
  'grave-salt': '#ddd8cc',
  'wood-plank': '#8a6a45',
  'black-powder': '#2a2622',
  'lead-shot': '#6b6f7a',
  'silver-filings': '#c9ced6',
}

/** Longest edge of one model in a bench pile: the grid is 0.3 m apart, so a pile stays in its cell. */
const PILE_MAX_EDGE_M = 0.15

/**
 * Map qty 1–10 to 1–5 pile meshes so piles grow visually with count.
 * qty ≤ 2 → 1, ≤ 4 → 2, ≤ 6 → 3, ≤ 8 → 4, else 5.
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
  return offsets
    .slice(0, count)
    .map(([dx, dz]) => new THREE.Vector3(centre.x + dx, centre.y, centre.z + dz))
}

/** Column/row grid layout for up to 7 materials (4 columns). */
function benchPosition(index: number): THREE.Vector3 {
  const col = index % 4
  const row = Math.floor(index / 4)
  return new THREE.Vector3(BENCH_ORIGIN.x + col * 0.3, BENCH_ORIGIN.y, BENCH_ORIGIN.z + row * 0.3)
}

// ---------------------------------------------------------------------------
// CameraRig
// ---------------------------------------------------------------------------

/**
 * Lerps the default camera toward the bench view when `open` is true,
 * and back to where it was when `open` becomes false.
 * Operates in-place on `state.camera` — R3F's default camera.
 */
type RigPhase = 'idle' | 'opening' | 'returning'

/** Per-second exponential approach rate; roughly a 400 ms ease. */
const RIG_RATE = 12
const RIG_POS_EPS = 0.01
const RIG_ANGLE_EPS = 0.01

function CameraRig({ open }: { open: boolean }) {
  const { camera } = useThree()
  const phase = useRef<RigPhase>('idle')
  // Captured at the moment the bench opens so we can return faithfully.
  const returnPos = useRef(new THREE.Vector3())
  const returnQuat = useRef(new THREE.Quaternion())
  // Scratch objects pre-allocated to avoid GC.
  const targetPos = useRef(new THREE.Vector3())
  const targetQuat = useRef(new THREE.Quaternion())
  const lookAtMatrix = useRef(new THREE.Matrix4())

  useEffect(
    () => () => {
      workbenchCameraRuntime.active = false
    },
    [],
  )

  useFrame((_, delta) => {
    if (open && phase.current !== 'opening') {
      // Only save the pose when starting from first person, not mid-return.
      if (phase.current === 'idle') {
        returnPos.current.copy(camera.position)
        returnQuat.current.copy(camera.quaternion)
      }
      phase.current = 'opening'
      workbenchCameraRuntime.active = true
    } else if (!open && phase.current === 'opening') {
      phase.current = 'returning'
    }
    // Not opening or returning: leave the camera alone (the controller owns it).
    if (phase.current === 'idle') return

    if (phase.current === 'opening') {
      targetPos.current.copy(BENCH_CAM_POSITION)
      lookAtMatrix.current.lookAt(BENCH_CAM_POSITION, BENCH_CAM_TARGET, camera.up)
      targetQuat.current.setFromRotationMatrix(lookAtMatrix.current)
    } else {
      targetPos.current.copy(returnPos.current)
      targetQuat.current.copy(returnQuat.current)
    }

    const alpha = 1 - Math.exp(-RIG_RATE * Math.min(delta, 0.1))
    camera.position.lerp(targetPos.current, alpha)
    camera.quaternion.slerp(targetQuat.current, alpha)

    if (
      phase.current === 'returning' &&
      camera.position.distanceTo(targetPos.current) < RIG_POS_EPS &&
      camera.quaternion.angleTo(targetQuat.current) < RIG_ANGLE_EPS
    ) {
      camera.position.copy(targetPos.current)
      camera.quaternion.copy(targetQuat.current)
      phase.current = 'idle'
      workbenchCameraRuntime.active = false
    }
  })

  return null
}

const BENCH_LIGHT_INTENSITY = 8
const BENCH_LIGHT_RATE = 12

/** Bench point light, permanently mounted; the open/close animation ramps its intensity. */
function BenchLight({ open }: { open: boolean }) {
  const ref = useRef<THREE.PointLight>(null)
  useFrame((_, delta) => {
    const light = ref.current
    if (!light) return
    light.intensity = rampIntensity(
      light.intensity,
      open ? BENCH_LIGHT_INTENSITY : 0,
      Math.min(delta, 0.1),
      BENCH_LIGHT_RATE,
    )
  })
  return (
    <pointLight
      ref={ref}
      position={[0, 1.5, BENCH_Z]}
      intensity={0}
      distance={3}
      color="#e8913a"
      castShadow={false}
    />
  )
}

// Phase counter: incremented once per MaterialPile mount so each pile starts
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
function MaterialPile({
  materialId,
  qty,
  position,
  craftable = false,
  highlighted = false,
}: MaterialPileProps) {
  const count = pileCount(qty)
  const positions = useMemo(
    () => pilePositions(position, count).map((p) => [p.x, p.y, p.z] as const),
    [position, count],
  )
  // A module-level counter gives each pile its own point in the pulse without Math.random() in render.
  const [phase] = useState(() => pilePhaseCounter++ * PILE_PHASE_STEP)
  // Craftable glow and rune are interactable cues: off during the intro and endings.
  const cinematic = useCinematic()
  const glowCraftable = craftable && !cinematic
  const glowHighlighted = highlighted && !cinematic

  return (
    <group>
      <BenchPile
        item={materialId}
        positions={positions}
        scale={fitScale(materialId, PILE_MAX_EDGE_M)}
        craftable={glowCraftable}
        highlighted={glowHighlighted}
        phase={phase}
      />

      {/* Rune sprite above craftable pile — floats up slowly */}
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
            opacity: glowHighlighted ? 1 : 0.75,
            transition: 'opacity 150ms ease-out',
          }}
        >
          ✦
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
// BenchModel
// ---------------------------------------------------------------------------

/** Tabletop is 8 cm thick; its top face is at BENCH_TOP_Y, where the material piles sit. */
const BENCH_TOP_Y = 0.86
const BENCH_W = 1.4
const BENCH_D = 0.8
const BENCH_LEG = 0.09

/**
 * The bench: tabletop, four legs, a back splash against the wall, a lower shelf and a front
 * apron, so it reads as a heavy workbench rather than a floating plank. Local origin is the
 * middle of the footprint on the floor. One fixed collider keeps the player out of it.
 */
function BenchModel() {
  const legH = BENCH_TOP_Y - 0.08
  const legX = BENCH_W / 2 - BENCH_LEG / 2
  const legZ = BENCH_D / 2 - BENCH_LEG / 2
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[BENCH_W / 2, BENCH_TOP_Y / 2, BENCH_D / 2]}
          position={[0, BENCH_TOP_Y / 2, 0]}
        />
      </RigidBody>
      <mesh position={[0, BENCH_TOP_Y - 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH_W, 0.08, BENCH_D]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} />
      </mesh>
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * legX, legH / 2, sz * legZ]} castShadow>
            <boxGeometry args={[BENCH_LEG, legH, BENCH_LEG]} />
            <meshStandardMaterial color="#3b2713" roughness={1} />
          </mesh>
        )),
      )}
      {/* Lower shelf and front apron tie the legs together. */}
      <mesh position={[0, 0.28, 0]} receiveShadow>
        <boxGeometry args={[BENCH_W - 0.1, 0.05, BENCH_D - 0.1]} />
        <meshStandardMaterial color="#3b2713" roughness={1} />
      </mesh>
      <mesh position={[0, BENCH_TOP_Y - 0.18, BENCH_D / 2 - 0.03]}>
        <boxGeometry args={[BENCH_W - 0.1, 0.16, 0.05]} />
        <meshStandardMaterial color="#4a3119" roughness={1} />
      </mesh>
      {/* Back splash so tools don't slide off into the wall. */}
      <mesh position={[0, BENCH_TOP_Y + 0.12, -BENCH_D / 2 + 0.03]} castShadow>
        <boxGeometry args={[BENCH_W, 0.24, 0.06]} />
        <meshStandardMaterial color="#4a3119" roughness={1} />
      </mesh>
    </group>
  )
}
// ---------------------------------------------------------------------------
// RecipeGhost (spec 09, G1)
// ---------------------------------------------------------------------------

const GHOST_POS: [number, number, number] = [0, 1.2, BENCH_Z - 0.12]
/** Longest edge of an ingredient laid on the bench: a plank or a shovel shrinks to fit the row. */
const BENCH_INGREDIENT_MAX_EDGE_M = 0.2
const benchScale = (id: ItemId): number => fitScale(id, BENCH_INGREDIENT_MAX_EDGE_M)
const GHOST_WASHED = new THREE.Color('#9a9a9a')

/**
 * Faint stand-in of the selected recipe's result above the bench. It is washed out while idle
 * and fills with colour and an ember glow as the craft completes. Ingredients lie along the
 * front of the bench: owned ones solid, missing ones as outlines. Meshes only (no lights), so
 * the light count stays constant.
 */
function RecipeGhost() {
  const selected = useCraftingStore((s) => s.selectedRecipe)
  const progress = useCraftingStore((s) => s.craftingProgress)
  const inventory = useInventoryStore((s) => s.inventory)
  const ref = useRef<THREE.Mesh>(null)
  const recipe = selected ? RECIPE_MAP[selected] : undefined
  const view = useMemo(() => {
    if (!recipe) return null
    const card = recipeCard(recipe, canCraft(inventory, recipe).missing)
    const crafting = progress && progress.recipeId === recipe.id ? progress.elapsed / progress.duration : 0
    return ghostView(card, crafting)
  }, [recipe, inventory, progress])
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6
  })
  if (!recipe || !view) return null
  const outColor = MATERIAL_COLOR[recipe.output.item as MaterialId] ?? '#d8c9a3'
  const tint = GHOST_WASHED.clone().lerp(new THREE.Color(outColor), view.fill)
  return (
    <group>
      <mesh ref={ref} position={GHOST_POS}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={0.25 + 0.75 * view.fill}
          emissive="#e8913a"
          emissiveIntensity={view.fill * 1.2}
          roughness={0.7}
          depthWrite={false}
        />
      </mesh>
      {view.rows.map((row, i) => {
        const x = (i - (view.rows.length - 1) / 2) * 0.22
        // Owned ingredients are their Blender model, fitted to the bench; missing ones stay an outline.
        if (row.solid && ITEM_MAP[row.item as ItemId]?.model) {
          return (
            <group key={row.item} position={[x, BENCH_TOP_Y + 0.02, BENCH_Z + 0.25]}>
              <GroundItem item={row.item as ItemId} scale={benchScale(row.item as ItemId)} />
            </group>
          )
        }
        // Missing ones are the same model in a flat dark material: the shape hints at what to find.
        return (
          <group key={row.item} position={[x, BENCH_TOP_Y + 0.02, BENCH_Z + 0.25]}>
            <ItemSilhouette item={row.item as ItemId} scale={benchScale(row.item as ItemId)} />
          </group>
        )
      })}
    </group>
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
  const openWorkbench = useUiWorldStore((s) => s.openWorkbench)
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

  // Pointer lock release and re-lock for the open workbench live in cursorRelease.ts.

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
        emit({ type: 'craftCompleted', recipeId })
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
    return MATERIAL_ORDER.filter((id) => (totals.get(id) ?? 0) > 0).map((id, index) => ({
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
      {import.meta.env.DEV && <BenchOpenProbe open={workbenchOpen} />}

      {/* Bench geometry — always visible in the scene. */}
      <group name="workbench" position={[0, 0, 0]}>
        <group position={[0, 0, BENCH_Z]}>
          <Interactable
            id="workbench"
            kind="workbench"
            size={[1.4, 1.1, 0.8]}
            runeHeight={1.2}
            onInteract={openWorkbench}
          >
            <BenchModel />
          </Interactable>
        </group>

        {/* Material piles — only rendered when the workbench is open so the
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

        {workbenchOpen && <RecipeGhost />}
        {/* Point light on the bench surface to warm up the material colours. */}
        {/* Always mounted: adding/removing a light recompiles every shader (0.7 s freeze). */}
        <BenchLight open={workbenchOpen} />
      </group>
    </>
  )
}
