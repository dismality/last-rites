// Bats that watch the player (spec 11 H4). The rules live in game/systems/bats.ts and the step in
// game/state/batStep.ts (called from GameLoop); this file only draws them.
//
// Six InstancedMeshes carry every bat, so bats cost 6 draw calls however many are out:
//   perched body, head (both poses), eyes (both poses), flying body, left wing, right wing.
// The perched head and eyes meshes are reused for a flying bat (same shapes), which is how a bat
// "swaps to the flying model" on the same frame: its phase flips in the sim and the next draw
// moves it from the perched body to the flying body and wings. The eyes are an emissive material
// with no light behind them. A fading bat shrinks to nothing over fadeS (instances share one
// material, so there is no per-bat opacity).
//
// Mount inside the scene root, outside Physics-dependent trees. No colliders: bats are scenery.

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import { BAT } from '../../data/bats'
import { DRACO_PATH, propModelUrl } from '../../data/assets'
import { batPerchPoint, installBatShotListener } from '../../game/state/batStep'
import { useBatStore } from '../../game/state/batStore'
import { batOpacity, fleePosition, wingAngle } from '../../game/systems/bats'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'
import '../assets/preloadModels'

type V3 = readonly [number, number, number]

interface Part {
  geometry: BufferGeometry
  material: Material
  /** Where the part turns: the node's own position in the model. */
  pivot: V3
}

interface BatParts {
  perchBody: Part
  head: Part
  eyes: Part
  flyBody: Part
  wingLeft: Part
  wingRight: Part
}

const PERCHED_URL = propModelUrl('bat-perched')
const FLYING_URL = propModelUrl('bat-flying')
const CAP = BAT.perchedMax
const ORIGIN: V3 = [0, 0, 0]

function partOf(root: Object3D, name: string): Part {
  const o = root.getObjectByName(name) as Mesh | undefined
  if (!o || !('geometry' in o)) throw new Error(`bat model is missing "${name}"`)
  return { geometry: o.geometry, material: o.material as Material, pivot: [o.position.x, o.position.y, o.position.z] }
}

/** The real models: names are the node names written by the Blender export. */
function ModelBats() {
  const perched = useGLTF(PERCHED_URL, DRACO_PATH).scene
  const flying = useGLTF(FLYING_URL, DRACO_PATH).scene
  const parts = useMemo<BatParts>(
    () => ({
      perchBody: partOf(perched, 'bat-perched-body'),
      head: partOf(perched, 'bat-perched-head'),
      eyes: partOf(perched, 'bat-perched-eyes'),
      flyBody: partOf(flying, 'bat-flying-body'),
      wingLeft: partOf(flying, 'bat-flying-wing-left'),
      wingRight: partOf(flying, 'bat-flying-wing-right'),
    }),
    [perched, flying],
  )
  return <BatInstances parts={parts} />
}

/** Dark ellipsoids with ember eyes, drawn while either model file is missing. */
function PlaceholderBats() {
  const parts = useMemo<BatParts>(() => {
    const cloth = new MeshStandardMaterial({ color: '#1a1614', roughness: 0.95 })
    const ember = new MeshStandardMaterial({ color: '#000000', emissive: '#ff6620', emissiveIntensity: 2 })
    const body = new SphereGeometry(0.06, 10, 8).scale(1, 1.3, 0.9).translate(0, 0.08, 0)
    const wing = (side: 1 | -1) => new BoxGeometry(0.14, 0.004, 0.09).translate((side * 0.07), 0, 0)
    return {
      perchBody: { geometry: body, material: cloth, pivot: ORIGIN },
      head: { geometry: new SphereGeometry(0.035, 8, 6), material: cloth, pivot: [0, 0.17, 0.005] },
      eyes: { geometry: new SphereGeometry(0.009, 6, 4).translate(0, 0.004, 0.03), material: ember, pivot: [0, 0.17, 0.005] },
      flyBody: { geometry: body, material: cloth, pivot: ORIGIN },
      wingLeft: { geometry: wing(-1), material: cloth, pivot: [-0.035, 0.13, 0] },
      wingRight: { geometry: wing(1), material: cloth, pivot: [0.035, 0.13, 0] },
    }
  }, [])
  // The group name labels the placeholder in a scene search (dev tools and tests).
  return <BatInstances parts={parts} label="Bats (placeholder)" />
}

const qIdentity = new Quaternion()
const qYaw = new Quaternion()
const qLocal = new Quaternion()
const eul = new Euler()
const vPos = new Vector3()
const vPivot = new Vector3()
const vScale = new Vector3()
const vOne = new Vector3(1, 1, 1)
const base = new Matrix4()
const local = new Matrix4()
const out = new Matrix4()
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const DEG = Math.PI / 180

/** Writes pos * yaw * (pivot * localRotation) into instance `i`. */
function place(
  mesh: InstancedMesh,
  i: number,
  pos: V3,
  yawDeg: number,
  scale: number,
  pivot: V3,
  localQ: Quaternion = qIdentity,
): void {
  qYaw.setFromAxisAngle(vUp, yawDeg * DEG)
  base.compose(vPos.set(pos[0], pos[1], pos[2]), qYaw, vScale.set(scale, scale, scale))
  local.compose(vPivot.set(pivot[0], pivot[1], pivot[2]), localQ, vOne)
  out.multiplyMatrices(base, local)
  mesh.setMatrixAt(i, out)
}
const vUp = new Vector3(0, 1, 0)

function BatInstances({ parts, label = 'bats' }: { parts: BatParts; label?: string }) {
  const refs = useRef<Record<keyof BatParts, InstancedMesh | null>>({
    perchBody: null,
    head: null,
    eyes: null,
    flyBody: null,
    wingLeft: null,
    wingRight: null,
  })
  // What was last drawn for a perched slot, so a far bat is not redrawn every frame.
  const drawn = useRef<string[]>([])

  useEffect(() => installBatShotListener(), [])

  useFrame((state) => {
    const m = refs.current
    if (!m.perchBody || !m.head || !m.eyes || !m.flyBody || !m.wingLeft || !m.wingRight) return
    const { entries, simTime } = useBatStore.getState()
    const cam = state.camera.position
    const n = Math.min(entries.length, CAP)
    const all = [m.perchBody, m.head, m.eyes, m.flyBody, m.wingLeft, m.wingRight]
    for (const mesh of all) mesh.count = n
    if (n === 0) {
      drawn.current.length = 0
      return
    }
    for (let i = 0; i < n; i++) {
      const { bat, fleeYaw } = entries[i]
      const at = batPerchPoint(bat.boxIndex)
      if (bat.phase === 'perched') {
        const key = `p${bat.boxIndex}`
        const far = Math.hypot(cam.x - at[0], cam.z - at[2]) > BAT.skipUpdateM
        if (far && drawn.current[i] === key) continue
        drawn.current[i] = key
        const turn = qLocal.setFromEuler(eul.set(0, (bat.yaw - bat.restYaw) * DEG, 0))
        place(m.perchBody, i, at, bat.restYaw, 1, parts.perchBody.pivot)
        place(m.head, i, at, bat.restYaw, 1, parts.head.pivot, turn)
        place(m.eyes, i, at, bat.restYaw, 1, parts.eyes.pivot, turn)
        m.flyBody.setMatrixAt(i, HIDDEN)
        m.wingLeft.setMatrixAt(i, HIDDEN)
        m.wingRight.setMatrixAt(i, HIDDEN)
      } else if (bat.phase === 'fleeing') {
        drawn.current[i] = 'f'
        const { position, headingDeg } = fleePosition(at, fleeYaw, bat.t)
        const s = batOpacity(bat)
        const flap = wingAngle(simTime)
        m.perchBody.setMatrixAt(i, HIDDEN)
        place(m.head, i, position, headingDeg, s, parts.head.pivot)
        place(m.eyes, i, position, headingDeg, s, parts.eyes.pivot)
        place(m.flyBody, i, position, headingDeg, s, parts.flyBody.pivot)
        place(m.wingLeft, i, position, headingDeg, s, parts.wingLeft.pivot, qLocal.setFromEuler(eul.set(0, 0, flap)))
        place(m.wingRight, i, position, headingDeg, s, parts.wingRight.pivot, qLocal.setFromEuler(eul.set(0, 0, -flap)))
      } else {
        if (drawn.current[i] === 'g') continue
        drawn.current[i] = 'g'
        for (const mesh of all) mesh.setMatrixAt(i, HIDDEN)
      }
    }
    for (const mesh of all) mesh.instanceMatrix.needsUpdate = true
  })

  const bind = (key: keyof BatParts) => (mesh: InstancedMesh | null) => {
    refs.current[key] = mesh
  }
  const keys: (keyof BatParts)[] = ['perchBody', 'head', 'eyes', 'flyBody', 'wingLeft', 'wingRight']
  return (
    <group name={label}>
      {keys.map((k) => (
        <instancedMesh
          key={k}
          ref={bind(k)}
          args={[parts[k].geometry, parts[k].material, CAP]}
          frustumCulled={false}
          castShadow={false}
          count={0}
        />
      ))}
    </group>
  )
}

export function Bats() {
  const perched = useAssetOrPlaceholder(PERCHED_URL)
  const flying = useAssetOrPlaceholder(FLYING_URL)
  if (perched === 'checking' || flying === 'checking') return null
  // PLACEHOLDER: /assets/models/props/bat-perched.glb and /assets/models/props/bat-flying.glb (dark ellipsoids; used while either file is missing)
  if (perched === 'missing' || flying === 'missing') return <PlaceholderBats />
  return (
    <Suspense fallback={null}>
      <ModelBats />
    </Suspense>
  )
}
