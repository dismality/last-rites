// Barricade frames, boards and plaques for the two chapel doors (Req 16.1, 16.2, 16.7, 16.12).
// Frames and boards are instanced meshes (one draw call each for frames, boards and cracks, plus
// one plaque quad per door). Nothing is drawn until repair stage 1 builds the barricades.
// Holding E nails a board through the combat tick; the rising edge here only starts the timer.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DOORS } from '../../data/barricades'
import { CHAPEL_DOORS } from '../../data/cemeteryLayout'
import { startNail } from '../../game/state/combatActions'
import { useChapelStore } from '../../game/state/chapelStore'
import { useDoorStore } from '../../game/state/doorStore'
import { useToastStore } from '../../game/state/toastStore'
import { barricadeFor } from '../../game/systems/chapelDoors'
import type { DoorId } from '../../game/types'
import { Interactable } from './Interactable'

const DOOR_HEIGHT = 2.5
const RAIL = 0.1
const BOARD_H = 0.22
const BOARD_D = 0.08
/** Board heights across the opening, lowest slot first. */
const SLOT_Y = [0.55, 1.25, 1.95] as const
/** Below this share of full health a board shows a crack. */
const CRACK_BELOW = 0.25

const HEALTHY = new THREE.Color('#8a6a45')
const SPLINTERED = new THREE.Color('#2a1f17')
const FRAME_COLOR = '#3a342e'
const CRACK_COLOR = '#0d0a08'
const PLAQUE_INK = '#f5d9a8'

/** Pips for a door: "▮▮▯ 2/3". Text and shape, never colour alone. */
const plaqueText = (boards: number): string =>
  `${'▮'.repeat(boards)}${'▯'.repeat(DOORS.slots - boards)} ${boards}/${DOORS.slots}`

/** Boards darken from timber to near-black as health falls. */
function boardColor(hp: number, target = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, hp / DOORS.boardHp))
  return target.copy(SPLINTERED).lerp(HEALTHY, t)
}

const rotationY = (id: DoorId): number => {
  const [ox, , oz] = CHAPEL_DOORS[id].outward
  return Math.atan2(ox, oz)
}

const DUMMY = new THREE.Object3D()
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)

interface DoorProps {
  id: DoorId
  boards: readonly number[]
}

function Plaque({ id, boards }: DoorProps) {
  const spec = CHAPEL_DOORS[id]
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    return { canvas: c, texture: new THREE.CanvasTexture(c) }
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const count = boards.length
  useEffect(() => {
    const g = canvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, canvas.width, canvas.height)
    g.fillStyle = 'rgba(20,17,15,0.85)'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.strokeStyle = '#a8946a'
    g.lineWidth = 4
    g.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
    g.fillStyle = PLAQUE_INK
    g.font = '40px serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(plaqueText(count), canvas.width / 2, canvas.height / 2 + 2)
    if (mat.current?.map) mat.current.map.needsUpdate = true
  }, [canvas, count])
  return (
    <mesh
      position={[0, DOOR_HEIGHT + 0.65, 0.3]}
      scale={[spec.width, spec.width * (96 / 256), 1]}
      raycast={() => null}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={texture} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** One door's group: local +Z points out of the chapel, local X spans the opening. */
function Door({ id, boards }: DoorProps) {
  const spec = CHAPEL_DOORS[id]
  const onInteract = () => {
    const r = startNail(id)
    if (!r.started) useToastStore.getState().push(r.text)
  }
  return (
    <group position={[spec.point[0], 0, spec.point[2]]} rotation={[0, rotationY(id), 0]}>
      <Interactable
        kind="barricade-door"
        subject={id}
        id={`nail-${id}`}
        runeHeight={DOOR_HEIGHT + 0.2}
        onInteract={onInteract}
      >
        {/* Invisible proxy so the empty slots still take the crosshair. */}
        <mesh position={[0, DOOR_HEIGHT / 2, 0]}>
          <boxGeometry args={[spec.width, DOOR_HEIGHT, 0.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Interactable>
      <Plaque id={id} boards={boards} />
    </group>
  )
}

export function ChapelDoors() {
  const chapel = useChapelStore((s) => s.chapel)
  const built = useDoorStore((s) => s.built)
  const doors = useDoorStore((s) => s.doors)
  const active = barricadeFor(chapel, { built, doors }).built

  const frames = useRef<THREE.InstancedMesh>(null)
  const boardMesh = useRef<THREE.InstancedMesh>(null)
  const cracks = useRef<THREE.InstancedMesh>(null)

  // Frames: four rails per door, set once the barricades exist.
  useEffect(() => {
    const mesh = frames.current
    if (!mesh) return
    let i = 0
    for (const id of DOORS.ids) {
      const spec = CHAPEL_DOORS[id]
      const ry = rotationY(id)
      const rails: Array<[number, number, number, number]> = [
        [-spec.width / 2 + RAIL / 2, DOOR_HEIGHT / 2, RAIL, DOOR_HEIGHT],
        [spec.width / 2 - RAIL / 2, DOOR_HEIGHT / 2, RAIL, DOOR_HEIGHT],
        [0, DOOR_HEIGHT - RAIL / 2, spec.width, RAIL],
        [0, RAIL / 2, spec.width, RAIL],
      ]
      for (const [lx, y, w, h] of rails) {
        const c = Math.cos(ry)
        const s = Math.sin(ry)
        DUMMY.position.set(spec.point[0] + lx * c + 0.04 * s, y, spec.point[2] - lx * s + 0.04 * c)
        DUMMY.rotation.set(0, ry, 0)
        DUMMY.scale.set(w, h, 0.14)
        DUMMY.updateMatrix()
        mesh.setMatrixAt(i++, DUMMY.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [active])

  // Boards and cracks follow the door store: a missing slot or a cracked board is a matrix change.
  useEffect(() => {
    const bm = boardMesh.current
    const cm = cracks.current
    if (!bm || !cm) return
    const tmp = new THREE.Color()
    let i = 0
    for (const id of DOORS.ids) {
      const spec = CHAPEL_DOORS[id]
      const ry = rotationY(id)
      for (let slot = 0; slot < DOORS.slots; slot++, i++) {
        const hp = active ? doors[id][slot] : undefined
        if (hp === undefined) {
          bm.setMatrixAt(i, HIDDEN)
          cm.setMatrixAt(i, HIDDEN)
          continue
        }
        // Slight z jitter per slot so stacked planks do not read as one slab.
        const lz = 0.02 + (slot % 2) * 0.03
        const c = Math.cos(ry)
        const s = Math.sin(ry)
        DUMMY.position.set(spec.point[0] + lz * s, SLOT_Y[slot], spec.point[2] + lz * c)
        DUMMY.rotation.set(0, ry, (slot - 1) * 0.04)
        DUMMY.scale.set(spec.width - RAIL, BOARD_H, BOARD_D)
        DUMMY.updateMatrix()
        bm.setMatrixAt(i, DUMMY.matrix)
        bm.setColorAt(i, boardColor(hp, tmp))
        if (hp / DOORS.boardHp < CRACK_BELOW) {
          // Cracked inset: a dark notch cut into the board face, outward side.
          DUMMY.position.set(
            spec.point[0] + (lz + BOARD_D / 2 + 0.005) * s,
            SLOT_Y[slot],
            spec.point[2] + (lz + BOARD_D / 2 + 0.005) * c,
          )
          DUMMY.scale.set(0.35, BOARD_H * 0.8, 0.02)
          DUMMY.updateMatrix()
          cm.setMatrixAt(i, DUMMY.matrix)
        } else cm.setMatrixAt(i, HIDDEN)
      }
    }
    bm.instanceMatrix.needsUpdate = true
    cm.instanceMatrix.needsUpdate = true
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true
  }, [active, doors])

  if (!active) return null

  const total = DOORS.ids.length * DOORS.slots
  return (
    <group name="chapel-doors">
      <instancedMesh
        ref={frames}
        args={[undefined, undefined, DOORS.ids.length * 4]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.8} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={boardMesh} args={[undefined, undefined, total]} castShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={cracks} args={[undefined, undefined, total]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={CRACK_COLOR} />
      </instancedMesh>
      {DOORS.ids.map((id) => (
        <Door key={id} id={id} boards={doors[id]} />
      ))}
    </group>
  )
}
