// First-person hands and lantern built in code until viewmodel/hands.glb and viewmodel/lantern.glb
// exist (spec 11 H7). The right fist closes round the held item's grip (the held group's origin,
// where every weapon's handle sits); the left fist holds the lantern by its ring. Rendering only.
// Each hand is a few merged meshes: jointed fingers with knuckles and nails, a padded palm, a
// two-joint thumb, wrist, linen shirt cuff, buttoned coat cuff and a creased wool sleeve.
// PLACEHOLDER: /assets/models/viewmodel/hands.glb
// PLACEHOLDER: /assets/models/viewmodel/lantern.glb

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { HELD_ORIGIN } from '../../data/itemModels'
import { LANTERN_LIGHT } from '../../data/lanternLight'
import { lathe, merge, place, type V3 } from '../assets/shapeKit'
import { signalToFlame } from '../../game/systems/lanternFlicker'
import { lanternHandRuntime, lanternLightRuntime } from './lanternRig'

const SKIN = '#c4977a'
const NAIL = '#d9b3a0'
const SLEEVE = '#2e2620'
const CUFF = '#3d3128'
const LINEN = '#cfc6b2'
const IRON = '#2a2622'
const BRASS = '#8a6a32'

// ---- The hand ----

/** Radius of the arc the finger bones follow round the grip axis (local Z). */
const FINGER_ARC_R = 0.022
/** Where the knuckles sit on that arc (radians, from +X towards +Y). */
const KNUCKLE_ANGLE = Math.PI * 0.36
/** Bone lengths, knuckle to tip. */
const BONES = [0.036, 0.025, 0.02] as const
/** Bone radii, knuckle to tip. */
const BONE_R = [0.0105, 0.0095, 0.0085] as const
/** Index to little finger: position across the grip and size. */
const FINGERS: readonly { z: number; k: number; lag: number }[] = [
  { z: 0.028, k: 1, lag: 0 },
  { z: 0.0095, k: 1.04, lag: -0.05 },
  { z: -0.0095, k: 1, lag: -0.02 },
  { z: -0.027, k: 0.86, lag: 0.08 },
]

interface HandGeometry {
  skin: THREE.BufferGeometry
  nails: THREE.BufferGeometry
}

function buildHand(): HandGeometry {
  const skin: THREE.BufferGeometry[] = []
  const nails: THREE.BufferGeometry[] = []

  // Palm and back of the hand, padded and rounded, on the open side of the finger arc.
  skin.push(place(new RoundedBoxGeometry(0.034, 0.05, 0.082, 3, 0.011), [0.014, 0, 0]))
  // The heel of the palm, a soft pad below.
  skin.push(place(new THREE.SphereGeometry(0.018, 12, 10), [0.016, -0.018, 0.012], [0, 0, 0], [0.9, 0.7, 1.6]))

  for (const f of FINGERS) {
    let a = KNUCKLE_ANGLE + f.lag
    // The knuckle itself: a rounded bump at the back of the hand.
    skin.push(place(new THREE.SphereGeometry(BONE_R[0] * 1.06 * f.k, 10, 8), [Math.cos(a) * FINGER_ARC_R, Math.sin(a) * FINGER_ARC_R, f.z]))
    BONES.forEach((len, b) => {
      const r = BONE_R[b] * f.k
      const span = (len * f.k) / FINGER_ARC_R
      const mid = a + span / 2
      const chord = 2 * FINGER_ARC_R * Math.sin(span / 2)
      const rc = FINGER_ARC_R * Math.cos(span / 2)
      skin.push(
        place(new THREE.CapsuleGeometry(r, Math.max(0.001, chord - r), 4, 10), [Math.cos(mid) * rc, Math.sin(mid) * rc, f.z], [0, 0, mid]),
      )
      a += span
      // The joint after this bone, a touch wider than the bones either side.
      if (b < BONES.length - 1) {
        skin.push(place(new THREE.SphereGeometry(r * 1.01, 10, 8), [Math.cos(a) * FINGER_ARC_R, Math.sin(a) * FINGER_ARC_R, f.z]))
      }
      // The nail sits on the outside of the last bone, near its tip.
      if (b === BONES.length - 1) {
        const at = a - span * 0.4
        const out = FINGER_ARC_R + r * 0.82
        nails.push(
          place(new RoundedBoxGeometry(0.003, 0.011 * f.k, 0.0085 * f.k, 1, 0.0012), [Math.cos(at) * out, Math.sin(at) * out, f.z], [0, 0, at]),
        )
      }
    })
  }

  // The thumb: a muscle at its root, then two bones laid over the fingers.
  skin.push(place(new THREE.SphereGeometry(0.017, 12, 10), [0.006, 0.012, 0.03], [0.4, 0, 0], [1, 0.85, 1.25]))
  skin.push(place(new THREE.CapsuleGeometry(0.0105, 0.022, 4, 10), [-0.004, 0.024, 0.03], [0.9, 0, 0.3]))
  skin.push(place(new THREE.SphereGeometry(0.0112, 10, 8), [-0.012, 0.034, 0.018]))
  skin.push(place(new THREE.CapsuleGeometry(0.0095, 0.016, 4, 10), [-0.018, 0.037, 0.006], [1.25, 0, 0.55]))
  nails.push(place(new RoundedBoxGeometry(0.009, 0.003, 0.01, 1, 0.0012), [-0.02, 0.0465, 0.002], [0.3, 0, 0.55]))

  return { skin: merge(skin), nails: merge(nails) }
}

interface ArmGeometry {
  skin: THREE.BufferGeometry
  linen: THREE.BufferGeometry
  cuff: THREE.BufferGeometry
  sleeve: THREE.BufferGeometry
  brass: THREE.BufferGeometry
}

const ALONG_Z: V3 = [Math.PI / 2, 0, 0]

function buildArm(): ArmGeometry {
  // Wrist, narrowing from the hand, with the wrist bone showing on the outside.
  const skin = merge([
    place(new THREE.CylinderGeometry(0.021, 0.025, 0.05, 14), [0, 0, 0.066], ALONG_Z),
    place(new THREE.SphereGeometry(0.008, 8, 6), [0.004, 0.02, 0.07]),
  ])
  // A linen shirt cuff showing past the coat.
  const linen = merge([place(new THREE.CylinderGeometry(0.028, 0.027, 0.02, 16), [0, 0, 0.088], ALONG_Z)])
  // The coat's turned-back cuff, its lip and a crease.
  const cuff = merge([
    place(new THREE.CylinderGeometry(0.037, 0.034, 0.05, 18), [0, 0, 0.112], ALONG_Z),
    place(new THREE.TorusGeometry(0.035, 0.0035, 6, 22), [0, 0, 0.088]),
    place(new THREE.TorusGeometry(0.0375, 0.0025, 6, 22), [0, 0, 0.137]),
  ])
  // The wool sleeve, with loose creases round it.
  const sleeve = merge([
    place(new THREE.CylinderGeometry(0.046, 0.037, 0.3, 18), [0, 0, 0.285], ALONG_Z),
    place(new THREE.TorusGeometry(0.041, 0.005, 6, 20), [0, 0.002, 0.19], [0.18, 0.1, 0], [1, 0.92, 1]),
    place(new THREE.TorusGeometry(0.043, 0.006, 6, 20), [0, -0.002, 0.26], [-0.22, 0, 0], [1, 0.9, 1]),
    place(new THREE.TorusGeometry(0.045, 0.005, 6, 20), [0.002, 0, 0.34], [0.12, -0.15, 0], [1, 0.94, 1]),
  ])
  // Two brass buttons on the outside of the cuff.
  const brass = merge(
    [0.104, 0.124].map((z) => place(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 10), [0.037, 0.004, z], [0, 0, Math.PI / 2])),
  )
  return { skin, linen, cuff, sleeve, brass }
}

let handCache: HandGeometry | null = null
let armCache: ArmGeometry | null = null
const handGeometry = () => (handCache ??= buildHand())
const armGeometry = () => (armCache ??= buildArm())

function Fist({ armRotation }: { armRotation: V3 }) {
  const hand = handGeometry()
  const arm = armGeometry()
  return (
    <group>
      <mesh geometry={hand.skin}>
        <meshStandardMaterial color={SKIN} roughness={0.68} />
      </mesh>
      <mesh geometry={hand.nails}>
        <meshStandardMaterial color={NAIL} roughness={0.35} />
      </mesh>
      <group rotation={[...armRotation]}>
        <mesh geometry={arm.skin}>
          <meshStandardMaterial color={SKIN} roughness={0.68} />
        </mesh>
        <mesh geometry={arm.linen}>
          <meshStandardMaterial color={LINEN} roughness={0.95} />
        </mesh>
        <mesh geometry={arm.cuff}>
          <meshStandardMaterial color={CUFF} roughness={1} />
        </mesh>
        <mesh geometry={arm.sleeve}>
          <meshStandardMaterial color={SLEEVE} roughness={1} />
        </mesh>
        <mesh geometry={arm.brass}>
          <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

/** The right hand on the held item's grip. Mount inside the viewmodel rig (it sways and swings with it). */
export function PlaceholderRightHand() {
  return (
    <group position={[...HELD_ORIGIN.position]} rotation={[...HELD_ORIGIN.rotation]} name="placeholder-right-hand">
      {/* The arm comes up from the bottom right of the screen to the grip. */}
      <Fist armRotation={[0.6, 0.4, 0]} />
    </group>
  )
}

// ---- The lantern ----

interface LanternGeometry {
  brass: THREE.BufferGeometry
  iron: THREE.BufferGeometry
  globe: THREE.BufferGeometry
  flame: THREE.BufferGeometry
  wick: THREE.BufferGeometry
}

/** One guard wire, bowed out round the globe. */
function guardWire(angle: number): THREE.BufferGeometry {
  const pts = (
    [
      [0.03, -0.036],
      [0.043, -0.016],
      [0.046, 0],
      [0.043, 0.018],
      [0.028, 0.037],
    ] as const
  ).map(([r, y]) => new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0022, 6)
}

function buildLantern(): LanternGeometry {
  const brass = merge([
    // The oil fount, a squat drum with a rolled rim.
    lathe([
      [0, -0.068],
      [0.041, -0.068],
      [0.047, -0.064],
      [0.049, -0.055],
      [0.047, -0.044],
      [0.04, -0.038],
      [0.026, -0.035],
      [0, -0.035],
    ]),
    // Filler cap on the fount's shoulder.
    place(new THREE.CylinderGeometry(0.0075, 0.0085, 0.008, 12), [0.032, -0.036, 0.012]),
    // The burner and its gallery.
    place(new THREE.CylinderGeometry(0.013, 0.015, 0.01, 16), [0, -0.031, 0]),
    place(new THREE.TorusGeometry(0.025, 0.002, 6, 24), [0, -0.035, 0], [Math.PI / 2, 0, 0]),
    // The wick-raiser: a spindle out to a knurled wheel.
    place(new THREE.CylinderGeometry(0.0018, 0.0018, 0.03, 6), [0.026, -0.03, 0], [0, 0, Math.PI / 2]),
    place(new THREE.CylinderGeometry(0.0065, 0.0065, 0.003, 14), [0.042, -0.03, 0], [0, 0, Math.PI / 2]),
  ])

  const iron = merge([
    // Guard rings top, middle and bottom.
    place(new THREE.TorusGeometry(0.03, 0.0026, 6, 24), [0, -0.036, 0], [Math.PI / 2, 0, 0]),
    place(new THREE.TorusGeometry(0.046, 0.0022, 6, 28), [0, 0, 0], [Math.PI / 2, 0, 0]),
    place(new THREE.TorusGeometry(0.028, 0.0026, 6, 24), [0, 0.037, 0], [Math.PI / 2, 0, 0]),
    ...[0, 1, 2, 3].map((i) => guardWire((i / 4) * Math.PI * 2 + Math.PI / 4)),
    // The vented hood over the globe.
    lathe(
      [
        [0.03, 0.036],
        [0.034, 0.04],
        [0.03, 0.047],
        [0.02, 0.054],
        [0.017, 0.057],
        [0.017, 0.063],
        [0.024, 0.065],
        [0.013, 0.073],
        [0.006, 0.076],
        [0, 0.076],
      ],
      20,
    ),
    // Vent holes show as dark studs round the chimney.
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2
      return place(new THREE.SphereGeometry(0.003, 6, 4), [Math.cos(a) * 0.0175, 0.06, Math.sin(a) * 0.0175])
    }),
    // The stem up to the carrying ring, and the ring.
    place(new THREE.CylinderGeometry(0.003, 0.004, 0.012, 8), [0, 0.075, 0]),
    place(new THREE.TorusGeometry(0.022, 0.0035, 8, 24), [0, 0.092, 0]),
  ])

  // The glass globe, bellied in the middle.
  const globe = lathe(
    [
      [0.025, -0.034],
      [0.031, -0.026],
      [0.036, -0.012],
      [0.0375, 0],
      [0.036, 0.014],
      [0.03, 0.028],
      [0.024, 0.036],
    ],
    28,
  )

  // A teardrop flame, about its own centre.
  const flame = lathe(
    [
      [0, -0.006],
      [0.0055, -0.004],
      [0.0068, -0.0005],
      [0.005, 0.003],
      [0.0025, 0.0055],
      [0, 0.0075],
    ],
    14,
  )

  // The wick's end, charred.
  const wick = new THREE.BoxGeometry(0.006, 0.006, 0.002)
  wick.translate(0, -0.023, 0)

  return { brass, iron, globe, flame, wick }
}

let lanternCache: LanternGeometry | null = null
const lanternGeometry = () => (lanternCache ??= buildLantern())

/**
 * A keeper's cage lantern held by its ring, with the left fist round the ring. The group origin is
 * the glass centre (the light's anchor). The flame follows the light rig's flicker signal.
 */
export function PlaceholderLantern() {
  const flame = useRef<THREE.Mesh>(null)
  const glass = useRef<THREE.Mesh>(null)
  const hand = useRef<THREE.Group>(null)
  const geo = lanternGeometry()

  useFrame(() => {
    const rt = lanternLightRuntime
    const s = rt.beam ? signalToFlame(rt.signal) : 0
    if (flame.current) flame.current.scale.set(s, s * 1.6, s)
    if (glass.current) {
      const m = glass.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = rt.beam ? 0.35 + 0.5 * rt.signal : 0.05
    }
    // On the belt the left hand is busy elsewhere (the shotgun fore-end), so it is not drawn here.
    if (hand.current) hand.current.visible = lanternHandRuntime.hand.mode !== 'belt'
  })

  return (
    <group name="placeholder-lantern">
      <mesh ref={glass} geometry={geo.globe}>
        <meshStandardMaterial
          color="#5a3c18"
          emissive={LANTERN_LIGHT.color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.5}
          roughness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={flame} position={[0, -0.012, 0]} geometry={geo.flame}>
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
      <mesh geometry={geo.wick}>
        <meshStandardMaterial color="#1a1410" roughness={1} />
      </mesh>
      <mesh geometry={geo.brass}>
        <meshStandardMaterial color={BRASS} metalness={0.75} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.iron}>
        <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.55} />
      </mesh>
      {/* Left fist round the top of the ring; the arm comes in from the bottom left. */}
      <group ref={hand} position={[0, 0.112, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Fist armRotation={[0.89, 0.89, 0]} />
      </group>
    </group>
  )
}
