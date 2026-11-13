// The chapel: the Blender scene (chapel-exterior.glb and chapel-interior.glb, spec 09 task 11n-a)
// over the game's own wall colliders. The old box walls stay as invisible colliders so every door,
// board and zombie rule is untouched; the models draw everything you see. Colliders for the pews,
// font, cupboard, altar and the buttresses come from the models' JSON (shortened where they would
// block the aisle, see systems/chapelColliders.ts). Mount inside <Physics>. Door and repair logic:
// Chapel.tsx and ChapelDoors.tsx.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Group, Object3D } from 'three'
import {
  CHAPEL_ANCHORS,
  CHAPEL_MESH,
} from '../../data/chapelScenery'
import {
  CHAPEL_EXTERIOR_MODEL_URL,
  CHAPEL_INTERIOR_MODEL_URL,
  DRACO_PATH,
} from '../../data/assets'
import { CHAPEL, CHAPEL_CENTER, CHAPEL_DOORS } from '../../data/cemeteryLayout'
import { bellAngle } from '../../game/systems/bellSwing'
import { chapelSceneColliders } from '../../game/systems/chapelColliders'
import { isBellActive } from '../../game/systems/repairs'
import { useChapelStore } from '../../game/state/chapelStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { readRiteStatus } from '../../game/state/riteStatus'
import { useWorldStore } from '../../game/state/worldStore'
import '../assets/preloadModels'
import { Slab } from './buildingParts'
import { bellRuntime, ringBell } from './bellRuntime'
import { Interactable } from './Interactable'

const DOOR_HEIGHT = 2.5
/** Warm door lantern: dim enough that the lantern's own light still leads. No shadow. */
const DOOR_LANTERN = { color: '#e8913a', intensity: 3, distance: 9 } as const

/**
 * The whistle answers at the altar: stone shifts and the catacomb stair opens. The hotspot only
 * exists while the whistle is held and shows cues only while the stair is sealed, so ordinary
 * altar use is untouched.
 */
function AltarStairReveal({ z }: { z: number }) {
  const hasWhistle = useInventoryStore((s) => s.inventory.keyItems.includes('bone-whistle'))
  const day = useWorldStore((s) => s.phase === 'day')
  // Stays mounted after the stair opens so its cues fade; then it is used up and not targetable.
  // By day only: at dusk and night the same spot answers the case (CaseAltar), and the stair
  // waits for the next morning.
  if (!hasWhistle || !day) return null
  return (
    <group position={[0, 0, z]}>
      <Interactable
        id="altar-whistle"
        kind="altar-whistle"
        runeHeight={1.6}
        onInteract={() => useMysteryStore.getState().interactGate('catacombs', 'altar')}
      >
        <mesh visible={false} position={[0, 0.55, 0]}>
          <boxGeometry args={[1.6, 1.1, 0.8]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/**
 * The altar takes the case's answer (spec 10, Req 3). E opens the answer panel. Two other altar
 * uses keep the spot: the whistle (by day, while the stair is sealed) and the stage 3 rite hold
 * (while it is ready), so this hotspot steps aside for both. The rite goes in task 4.
 */
function CaseAltar({ z }: { z: number }) {
  const whistleTurn = useInventoryStore((s) => s.inventory.keyItems.includes('bone-whistle'))
  const sealed = useMysteryStore((s) => !s.mystery.gates.catacombs)
  const day = useWorldStore((s) => s.phase === 'day')
  if (whistleTurn && sealed && day) return null
  return (
    <group position={[0, 0, z]}>
      <Interactable
        id="case-altar"
        kind="case-altar"
        runeHeight={1.6}
        onInteract={() => {
          // While the final rite can be held, E at the altar belongs to the rite.
          if (readRiteStatus().availability === 'ready') return
          useOverlayStore.getState().setAltarPanelOpen(true)
        }}
      >
        <mesh visible={false} position={[0, 0.55, 0]}>
          <boxGeometry args={[1.6, 1.1, 0.8]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** True when `o` or one of its parents carries one of `names`. */
function hasAncestorNamed(o: Object3D, names: readonly string[]): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (names.includes(p.name)) return true
  return false
}

/**
 * The two models, mounted in chapel-local space. The roof, ceiling and walls shade the inside from
 * the moon; every mesh receives shadow. The bell mesh swings about its own origin (the bell-pivot
 * anchor); the stair cover hides once the whistle has opened the stair.
 */
function ChapelModels() {
  const interior = useGLTF(CHAPEL_INTERIOR_MODEL_URL, DRACO_PATH).scene
  const exterior = useGLTF(CHAPEL_EXTERIOR_MODEL_URL, DRACO_PATH).scene
  const inner = useRef<Group>(null)
  const outer = useRef<Group>(null)
  const stairOpen = useMysteryStore((s) => s.mystery.gates.catacombs)
  const bell = useRef<Object3D | null>(null)

  useLayoutEffect(() => {
    inner.current?.traverse((o) => {
      if ('isMesh' in o) o.receiveShadow = true
    })
    outer.current?.traverse((o) => {
      if (!('isMesh' in o)) return
      o.receiveShadow = true
      o.castShadow = hasAncestorNamed(o, CHAPEL_MESH.shadowCasters)
    })
    bell.current = outer.current?.getObjectByName(CHAPEL_MESH.bell) ?? null
  }, [interior, exterior])

  useLayoutEffect(() => {
    const cover = inner.current?.getObjectByName(CHAPEL_MESH.stairCover)
    if (cover) cover.visible = !stairOpen
  }, [stairOpen, interior])

  // The dusk bell rings when the bell is repaired (design bible §8); the wave bell rings it in
  // WaveDirector.
  useEffect(
    () =>
      useWorldStore.subscribe((s, prev) => {
        if (s.phase === 'dusk' && prev.phase !== 'dusk' && isBellActive(useChapelStore.getState().chapel)) {
          ringBell()
        }
      }),
    [],
  )

  useFrame(() => {
    const b = bell.current
    if (!b) return
    const t = bellRuntime.ringAtMs
    b.rotation.x = t === null ? 0 : bellAngle((performance.now() - t) / 1000)
  })

  return (
    <>
      <Clone ref={inner} object={interior} />
      <Clone ref={outer} object={exterior} />
    </>
  )
}

export function ChapelBuilding() {
  const { halfX, halfZ, height: h, wallThickness: t, doorWidth } = CHAPEL
  const sideW = halfX - doorWidth / 2
  const sideX = doorWidth / 2 + sideW / 2
  // Vestry opening in chapel-local Z, derived from the shared door spec so combat and walls agree.
  const vestry = CHAPEL_DOORS.vestry
  const vestryW = vestry.width
  const vestryZ = vestry.point[2] - CHAPEL_CENTER[2]
  const westALen = vestryZ - vestryW / 2 + halfZ
  const westBLen = halfZ - (vestryZ + vestryW / 2)
  const altarZ = halfZ - 1.2
  const sceneColliders = useMemo(() => chapelSceneColliders(), [])
  const lantern = CHAPEL_ANCHORS.doorLanternLight

  return (
    <group position={[...CHAPEL_CENTER]} name="chapel-building">
      <ChapelModels />
      <RigidBody type="fixed" colliders={false}>
        {/* Walls: collider only. The exterior model draws them, with real door and window openings. */}
        <Slab position={[-sideX, h / 2, -halfZ]} size={[sideW, h, t]} material="stone" visible={false} />
        <Slab position={[sideX, h / 2, -halfZ]} size={[sideW, h, t]} material="stone" visible={false} />
        <Slab
          position={[0, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, -halfZ]}
          size={[doorWidth, h - DOOR_HEIGHT, t]}
          material="stone"
          visible={false}
        />
        <Slab position={[0, h / 2, halfZ]} size={[halfX * 2, h, t]} material="stone" visible={false} />
        {/* West wall split around the vestry opening, with a lintel over it. */}
        <Slab
          position={[-halfX, h / 2, westALen / 2 - halfZ]}
          size={[t, h, westALen]}
          material="stone"
          visible={false}
        />
        <Slab
          position={[-halfX, h / 2, halfZ - westBLen / 2]}
          size={[t, h, westBLen]}
          material="stone"
          visible={false}
        />
        <Slab
          position={[-halfX, DOOR_HEIGHT + (h - DOOR_HEIGHT) / 2, vestryZ]}
          size={[t, h - DOOR_HEIGHT, vestryW]}
          material="stone"
          visible={false}
        />
        <Slab position={[halfX, h / 2, 0]} size={[t, h, halfZ * 2]} material="stone" visible={false} />
        {/* Ceiling: keeps anything from climbing onto the roof. */}
        <Slab
          position={[0, h + t / 2, 0]}
          size={[halfX * 2 + t * 2, t, halfZ * 2 + t]}
          material="slate"
          visible={false}
        />
        {/* Pews, font, cupboard, altar and buttresses from the models' JSON. */}
        {sceneColliders.map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.half[0], b.half[1], b.half[2]]}
            position={[...b.center]}
            rotation={[0, b.rotY, 0]}
          />
        ))}
      </RigidBody>

      {/* The lantern by the front door, at the model's anchor. Always mounted (constant light count), no shadow. */}
      <pointLight
        position={[...lantern]}
        color={DOOR_LANTERN.color}
        intensity={DOOR_LANTERN.intensity}
        distance={DOOR_LANTERN.distance}
        decay={2}
      />

      <AltarStairReveal z={altarZ} />
      <CaseAltar z={altarZ} />
    </group>
  )
}
