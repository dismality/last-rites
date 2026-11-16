// The chapel: the Blender scene (chapel-exterior.glb and chapel-interior.glb, spec 09 task 11n-a)
// over the game's own wall colliders. The old box walls stay as invisible colliders so every door,
// board and zombie rule is untouched; the models draw everything you see. Colliders for the pews,
// font, cupboard, altar and the buttresses come from the models' JSON (shortened where they would
// block the aisle, see systems/chapelColliders.ts). Mount inside <Physics>. Door and repair logic:
// Chapel.tsx and ChapelDoors.tsx.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Matrix4, Vector3, type Group, type Object3D } from 'three'
import { CHAPEL_ANCHORS, CHAPEL_MESH, type ChapelBox } from '../../data/chapelScenery'
import {
  CHAPEL_EXTERIOR_MODEL_URL,
  CHAPEL_INTERIOR_MODEL_URL,
  DRACO_PATH,
} from '../../data/assets'
import { CHAPEL, CHAPEL_CENTER, CHAPEL_DOORS } from '../../data/cemeteryLayout'
import { bellAngle } from '../../game/systems/bellSwing'
import { chapelSceneColliders } from '../../game/systems/chapelColliders'
import { altarRestOffset, altarSlideOffset, stairColliders } from '../../game/systems/chapelStair'
import { playScareSound } from '../../audio/AudioManager'
import { queuePlayerPush } from '../../game/state/playerPush'
import { queueTeleport } from '../../game/state/playerTeleport'
import { usePlayerStore } from '../../game/state/playerStore'
import {
  altarAt,
  altarPushOut,
  circleHitsBox,
  nearestFreePoint,
} from '../../game/systems/stairDescent'
import { playerPositionRef } from './playerPositionRef'
import { StairDescent } from './StairDescent'
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

/** The altar's slide offset this frame (chapel -z is negative). ChapelModels writes it; AltarBody reads it. */
const altarRuntime = { offset: 0 }

/** Largest shove per frame that keeps a player ahead of the sliding altar (it moves 1 cm a frame at most). */
const MAX_ALTAR_PUSH = 0.3

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
  // Every chapel-altar-* mesh with its resting z and chapel -z expressed in its parent's axes.
  const altar = useRef<{ o: Object3D; base: Vector3; dir: Vector3 }[]>([])
  // performance.now() when the stair opened during play; null when sealed or already open on load.
  const slideStart = useRef<number | null>(null)

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
    const root = inner.current
    altar.current = []
    if (root) {
      root.updateMatrixWorld(true)
      const toParent = new Matrix4()
      root.traverse((o) => {
        if (!o.name.startsWith(CHAPEL_MESH.altarPrefix) || !o.parent) return
        // Skip children of an altar node: the parent carries them.
        if (o.parent.name.startsWith(CHAPEL_MESH.altarPrefix)) return
        toParent.copy(o.parent.matrixWorld).invert().multiply(root.matrixWorld)
        const dir = new Vector3(0, 0, -1).transformDirection(toParent)
        altar.current.push({ o, base: o.position.clone(), dir })
      })
    }
  }, [interior, exterior])

  // Sealed or open on load: rest at once. Opening during play: slide over ALTAR_SLIDE.seconds.
  const opened = useRef(stairOpen)
  useLayoutEffect(() => {
    if (stairOpen && !opened.current) {
      slideStart.current = performance.now()
      const [x, y, z] = CHAPEL_CENTER
      playScareSound('stone-grind', x, y + 1, z + CHAPEL.halfZ - 1.2, 1)
    }
    if (!stairOpen) slideStart.current = null
    opened.current = stairOpen
  }, [stairOpen])

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
    const start = slideStart.current
    const off =
      start === null ? altarRestOffset(stairOpen) : altarSlideOffset((performance.now() - start) / 1000)
    altarRuntime.offset = off
    for (const a of altar.current) a.o.position.copy(a.base).addScaledVector(a.dir, -off)
    const b = bell.current
    if (!b) return
    const t = bellRuntime.ringAtMs
    b.rotation.x = t === null ? 0 : bellAngle((performance.now() - t) / 1000)
    bellRuntime.meshAngle = b.rotation.x
  })

  return (
    <>
      <Clone ref={inner} object={interior} />
      <Clone ref={outer} object={exterior} />
    </>
  )
}

/**
 * The altar's collider: a kinematic body that follows the slide frame by frame (spec 09 task
 * 11n-f). A static box that jumped 0.6 m at once landed on the player, who stands at the altar to
 * use the whistle. While it slides, a player in its way is shoved ahead of it toward the door;
 * once it has settled, a player still overlapping any chapel collider moves to the nearest free
 * spot (the safety net, also run once for a game loaded with the stair open).
 */
function AltarBody({ rest, others }: { rest: ChapelBox; others: readonly ChapelBox[] }) {
  const body = useRef<RapierRigidBody>(null)
  const stairOpen = useMysteryStore((s) => s.mystery.gates.catacombs)
  const settled = useRef(false)
  const restOffset = altarRestOffset(stairOpen)
  // Kinematic only while it moves; at rest it is a fixed box again, as every other chapel collider
  // (the character controller steps off the top stair more readily beside a fixed body).
  const [moving, setMoving] = useState(false)
  // Opened during play: until the slide starts (next frame) the box stays where the altar still is,
  // so a fixed box never appears 0.6 m nearer the door on top of the player. A game loaded with the
  // stair open starts at rest.
  const sawSealed = useRef(!stairOpen)
  const slideDone = useRef(false)
  if (!stairOpen) {
    sawSealed.current = true
    slideDone.current = false
  }
  const fixedOffset = stairOpen && sawSealed.current && !slideDone.current ? 0 : restOffset

  useFrame(() => {
    const off = altarRuntime.offset
    const nowMoving = stairOpen && off !== restOffset
    if (nowMoving !== moving) {
      if (!nowMoving) slideDone.current = true
      setMoving(nowMoving)
    }
    if (moving) body.current?.setNextKinematicTranslation({
      x: CHAPEL_CENTER[0],
      y: CHAPEL_CENTER[1],
      z: CHAPEL_CENTER[2] + off,
    })
    const p = playerPositionRef.current
    const x = p.x - CHAPEL_CENTER[0]
    const z = p.z - CHAPEL_CENTER[2]
    const inside = p.y > -0.3 && Math.abs(x) < CHAPEL.halfX && Math.abs(z) < CHAPEL.halfZ
    if (!stairOpen) {
      settled.current = false
      return
    }
    if (inside && off !== restOffset) {
      const dz = altarPushOut(x, z, altarAt(rest, off))
      if (dz !== 0) queuePlayerPush(0, dz, Math.min(Math.abs(dz), MAX_ALTAR_PUSH))
    }
    if (!settled.current && off === restOffset) {
      settled.current = true
      const all = [...others, altarAt(rest, off)]
      if (inside && all.some((b) => circleHitsBox(x, z, b))) {
        const spot = nearestFreePoint(x, z, all)
        if (spot) {
          const pl = usePlayerStore.getState()
          const feet: [number, number, number] = [spot.x + CHAPEL_CENTER[0], 0.05, spot.z + CHAPEL_CENTER[2]]
          pl.setPosition(feet)
          queueTeleport({ position: feet, yaw: pl.yaw, pitch: pl.pitch })
        }
      }
    }
  })

  return (
    <RigidBody
      key={moving ? 'moving' : 'rest'}
      ref={body}
      type={moving ? 'kinematicPosition' : 'fixed'}
      colliders={false}
      position={[0, 0, moving ? altarRuntime.offset : fixedOffset]}
    >
      <CuboidCollider args={[rest.half[0], rest.half[1], rest.half[2]]} position={[...rest.center]} />
    </RigidBody>
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
  const stairOpen = useMysteryStore((s) => s.mystery.gates.catacombs)
  const altarDz = altarRestOffset(stairOpen)
  const altarZ = halfZ - 1.2 + altarDz
  // The altar has its own kinematic body (AltarBody); everything else is static and never moves.
  const { altarRest, sceneColliders } = useMemo(() => {
    const all = chapelSceneColliders(0)
    return { altarRest: all.find((b) => b.note === 'altar')!, sceneColliders: all.filter((b) => b.note !== 'altar') }
  }, [])
  const stair = useMemo(() => stairColliders(), [])
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
      {/* The open stair: a ramp along the step nosings and the shaft walls (spec 09 task 11n-e). */}
      {stairOpen && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[...stair.ramp.half]}
            position={[...stair.ramp.center]}
            rotation={[stair.ramp.rotX, 0, 0]}
          />
          {stair.walls.map((w, i) => (
            <CuboidCollider key={i} args={[...w.half]} position={[...w.center]} />
          ))}
        </RigidBody>
      )}

      {/* The lantern by the front door, at the model's anchor. Always mounted (constant light count), no shadow. */}
      <pointLight
        position={[...lantern]}
        color={DOOR_LANTERN.color}
        intensity={DOOR_LANTERN.intensity}
        distance={DOOR_LANTERN.distance}
        decay={2}
      />

      <AltarBody rest={altarRest} others={sceneColliders} />
      <StairDescent />
      <AltarStairReveal z={altarZ} />
      <CaseAltar z={altarZ} />
    </group>
  )
}
