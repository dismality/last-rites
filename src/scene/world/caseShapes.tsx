// The case props' looks, built in code (spec 10 props). Each shape is a few merged meshes, so a
// detailed prop still costs a handful of draw calls. No lights and no colliders here: CaseProps
// wraps these in their Interactables. Rendering only.
import { useMemo } from 'react'
import * as THREE from 'three'
import type { SoleDef } from '../../data/cases'
import { lathe, merge, once, place, slab, type V3 } from '../assets/shapeKit'

const IRON = '#2a2623'
const BRONZE = '#6b5a3a'
const ROPE = '#8a7a5a'
const PAPER = '#d8c9a3'
const OLD_PAPER = '#c9b88f'
const INK = '#2a211b'
const LEATHER = '#3b2a22'
const OAK = '#4a3626'
const DARK_OAK = '#33251a'
const STONE = '#6e675c'
const PLASTER = '#e2ddd0'
const OIL = '#14110f'
/** The yellow clay of the robbed grave: bright, so it reads on Low graphics. */
const CLAY = '#c8931a'

const Y_UP: V3 = [0, 0, 0]
const FLAT: V3 = [-Math.PI / 2, 0, 0]
const SIDEWAYS: V3 = [0, 0, Math.PI / 2]

/** A wobbly closed outline round the origin: radius `r` (x, z scale) with a seeded wobble. */
function blob(rx: number, rz: number, wobble: number, seed: number, n = 18): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const w = 1 + wobble * Math.sin(a * 3 + seed) + wobble * 0.6 * Math.sin(a * 5 + seed * 2.3)
    return [Math.cos(a) * rx * w, Math.sin(a) * rz * w]
  })
}

// ---- Case 1: the safety-bell posts ----

/** An iron post on a stone footing, a bracket arm with a cast bell, a rope and a paper tag. */
export function BellPostShape({ height, cut }: { height: number; cut: boolean }) {
  const g = useMemo(() => {
    const iron = merge([
      place(new THREE.CylinderGeometry(0.028, 0.036, height, 8), [0, height / 2, 0]),
      // Collar rings and a ball finial.
      place(new THREE.TorusGeometry(0.034, 0.006, 6, 14), [0, 0.12, 0], FLAT),
      place(new THREE.TorusGeometry(0.03, 0.005, 6, 14), [0, height - 0.08, 0], FLAT),
      place(new THREE.SphereGeometry(0.04, 10, 8), [0, height + 0.03, 0]),
      // The bracket arm out to the bell, and its brace.
      place(new THREE.BoxGeometry(0.2, 0.025, 0.025), [0.09, height - 0.02, 0]),
      place(new THREE.BoxGeometry(0.13, 0.015, 0.015), [0.05, height - 0.08, 0], [0, 0, 0.6]),
      // The bell's yoke hanging from the arm.
      place(new THREE.BoxGeometry(0.03, 0.04, 0.012), [0.17, height - 0.05, 0]),
    ])
    const bronze = merge([
      // A cast bell: crown, waist, flared lip.
      place(
        lathe(
          [
            [0, 0.12],
            [0.03, 0.118],
            [0.045, 0.1],
            [0.052, 0.06],
            [0.06, 0.03],
            [0.078, 0.008],
            [0.084, 0],
            [0.076, 0],
            [0.054, 0.028],
            [0.046, 0.06],
            [0.04, 0.096],
            [0, 0.104],
          ],
          20,
        ),
        [0.17, height - 0.19, 0],
      ),
      // The clapper's ball, just inside the lip.
      place(new THREE.SphereGeometry(0.018, 8, 6), [0.17, height - 0.17, 0]),
    ])
    // A cut rope stops short, sliced on a slant; a whole one runs to the ground and lies there.
    const ropeLen = cut ? 0.36 : height - 0.22
    const ropeTop = height - 0.19
    const ropeParts = [place(new THREE.CylinderGeometry(0.008, 0.009, ropeLen, 6), [0.17, ropeTop - ropeLen / 2, 0])]
    if (cut) {
      // Frayed strands at the cut end.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2
        ropeParts.push(
          place(new THREE.ConeGeometry(0.003, 0.03, 4), [0.17 + Math.cos(a) * 0.004, ropeTop - ropeLen - 0.012, Math.sin(a) * 0.004], [Math.PI + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]),
        )
      }
    } else {
      ropeParts.push(place(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), [0.27, 0.02, 0.05], [0, 0.5, Math.PI / 2 - 0.08]))
    }
    const rope = merge(ropeParts)
    // The stone footing, its top edge worn round.
    const stone = merge([place(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8), [0, 0.05, 0])])
    // The paper tag, nailed to the post with a bent corner.
    const tag = merge([
      place(new THREE.BoxGeometry(0.1, 0.13, 0.004), [-0.05, height - 0.25, 0.04], [0, 0.4, 0.04]),
      place(new THREE.BoxGeometry(0.03, 0.03, 0.004), [-0.09, height - 0.32, 0.055], [0.4, 0.4, 0.8]),
    ])
    const nail = merge([place(new THREE.CylinderGeometry(0.005, 0.005, 0.01, 6), [-0.03, height - 0.2, 0.034], [Math.PI / 2, 0, 0])])
    return { iron, bronze, rope, stone, tag, nail }
  }, [height, cut])
  return (
    <>
      <mesh geometry={g.iron}>
        <meshStandardMaterial color={IRON} roughness={0.85} metalness={0.45} />
      </mesh>
      <mesh geometry={g.bronze}>
        <meshStandardMaterial color={BRONZE} roughness={0.55} metalness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={g.rope}>
        <meshStandardMaterial color={ROPE} roughness={1} />
      </mesh>
      <mesh geometry={g.stone}>
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
      <mesh geometry={g.tag}>
        <meshStandardMaterial color={OLD_PAPER} roughness={1} />
      </mesh>
      <mesh geometry={g.nail}>
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.6} />
      </mesh>
    </>
  )
}

// ---- Case 3 chapel: the psalter and the hymn tiles ----

const psalterGeo = once(() => ({
  leather: merge([
    place(new THREE.BoxGeometry(0.2, 0.008, 0.28), [0, 0.004, 0]),
    place(new THREE.BoxGeometry(0.2, 0.008, 0.28), [0, 0.056, 0]),
    // The rounded spine with raised bands.
    place(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10, 1, false, Math.PI, Math.PI), [-0.1, 0.03, 0], [Math.PI / 2, 0, 0]),
    ...[-0.08, 0, 0.08].map((z) => place(new THREE.TorusGeometry(0.03, 0.003, 4, 10, Math.PI), [-0.1, 0.03, z], [0, 0, Math.PI / 2])),
  ]),
  pages: merge([place(new THREE.BoxGeometry(0.19, 0.044, 0.266), [0.004, 0.03, 0])]),
  brass: merge([
    // A clasp across the fore-edge and a cross on the cover.
    place(new THREE.BoxGeometry(0.03, 0.05, 0.03), [0.1, 0.03, 0]),
    place(new THREE.BoxGeometry(0.012, 0.002, 0.11), [0, 0.061, 0]),
    place(new THREE.BoxGeometry(0.07, 0.002, 0.012), [0, 0.061, -0.02]),
    ...([[-0.08, -0.12], [0.08, -0.12], [-0.08, 0.12], [0.08, 0.12]] as const).map(([x, z]) =>
      place(new THREE.BoxGeometry(0.03, 0.003, 0.03), [x, 0.061, z], [0, Math.PI / 4, 0]),
    ),
  ]),
  ribbon: merge([place(new THREE.BoxGeometry(0.012, 0.002, 0.08), [0.02, 0.012, 0.17], [-0.9, 0, 0])]),
}))

/** A small leather psalter with a brass clasp, corners and cross, and a ribbon hanging out. */
export function PsalterShape() {
  const g = psalterGeo()
  return (
    <>
      <mesh geometry={g.leather}>
        <meshStandardMaterial color={LEATHER} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={g.pages}>
        <meshStandardMaterial color={OLD_PAPER} roughness={1} />
      </mesh>
      <mesh geometry={g.brass}>
        <meshStandardMaterial color="#a8832f" roughness={0.45} metalness={0.75} />
      </mesh>
      <mesh geometry={g.ribbon}>
        <meshStandardMaterial color="#6a1f1f" roughness={0.8} />
      </mesh>
    </>
  )
}

const tileGeo = once(() => ({
  base: merge([
    place(
      slab(
        [
          [-0.082, -0.082],
          [0.082, -0.082],
          [0.082, 0.082],
          [-0.082, 0.082],
        ],
        0.02,
        0.006,
      ),
      [0, -0.015, 0],
    ),
  ]),
  face: merge([
    // A sunken field with a raised rim and a boss in the middle.
    place(new THREE.BoxGeometry(0.13, 0.006, 0.13), [0, 0.012, 0]),
    place(new THREE.CylinderGeometry(0.025, 0.03, 0.01, 12), [0, 0.016, 0]),
  ]),
}))

/** A bevelled brass hymn tile with a sunken field. `lit` once its letter is set. */
export function HymnTileShape({ lit }: { lit: boolean }) {
  const g = tileGeo()
  const glow = { emissive: '#e8913a', emissiveIntensity: lit ? 0.6 : 0 }
  return (
    <>
      <mesh geometry={g.base}>
        <meshStandardMaterial color="#a8832f" roughness={0.45} metalness={0.75} {...glow} />
      </mesh>
      <mesh geometry={g.face}>
        <meshStandardMaterial color="#6e5222" roughness={0.6} metalness={0.7} {...glow} />
      </mesh>
    </>
  )
}

// ---- Case 3 crypt: the cart ruts, the hearse pin, the fingernail marks and Elias ----
// Every one is real geometry in strong colours, so it reads on Low graphics with no shadows.

/** Pale crushed stone at the edges of a rut. */
const CRUSHED = '#cfc6b0'
/** Dark wet mud in the bottom of a rut. */
const MUD = '#140f0b'

/**
 * Two wheel ruts along -Z from the origin, `length` m long, `gauge` m apart: dark mud in each
 * groove with ridges of pale crushed stone pushed up either side (about 10 cm wide, 3 cm high).
 */
export function RutsShape({ length, gauge }: { length: number; gauge: number }) {
  const g = useMemo(() => {
    const mud: THREE.BufferGeometry[] = []
    const ridge: THREE.BufferGeometry[] = []
    for (const x of [-gauge / 2, gauge / 2]) {
      mud.push(place(new THREE.BoxGeometry(0.1, 0.006, length), [x, 0.003, -length / 2]))
      for (const side of [-1, 1]) {
        ridge.push(place(new THREE.BoxGeometry(0.035, 0.03, length), [x + side * 0.07, 0.012, -length / 2], [0, 0, side * 0.35]))
      }
    }
    return { mud: merge(mud), ridge: merge(ridge) }
  }, [length, gauge])
  return (
    <>
      <mesh geometry={g.mud}>
        <meshStandardMaterial color={MUD} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh geometry={g.ridge}>
        <meshStandardMaterial color={CRUSHED} roughness={1} emissive={CRUSHED} emissiveIntensity={0.08} />
      </mesh>
    </>
  )
}

const pinGeo = once(() => ({
  iron: merge([
    // A thick iron bar about 40 cm long, through both hasps, with a forged head and a ring.
    place(new THREE.CylinderGeometry(0.018, 0.014, 0.4, 8), [0, 0, 0], [0, 0, Math.PI / 2]),
    place(new THREE.CylinderGeometry(0.032, 0.03, 0.03, 10), [-0.21, 0, 0], [0, 0, Math.PI / 2]),
    place(new THREE.TorusGeometry(0.045, 0.008, 6, 16), [-0.25, 0, 0.0], [0, Math.PI / 2, 0]),
  ]),
  // The two hasps on the door and frame the bar runs through.
  hasps: merge([
    place(new THREE.BoxGeometry(0.05, 0.08, 0.04), [-0.08, 0, -0.02]),
    place(new THREE.BoxGeometry(0.05, 0.08, 0.04), [0.1, 0, -0.02]),
  ]),
  // The raven stamped on the ring head, picked out pale so it reads.
  raven: place(new THREE.CircleGeometry(0.018, 10), [-0.226, 0, 0], [0, -Math.PI / 2, 0]),
}))

/** The iron hearse pin pushed through the Crane crypt door's hasps, along X, ring head at -X. */
export function HearsePinShape() {
  const g = pinGeo()
  return (
    <>
      <mesh geometry={g.iron}>
        <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.6} emissive="#3a3a40" emissiveIntensity={0.15} />
      </mesh>
      <mesh geometry={g.hasps}>
        <meshStandardMaterial color="#2a2a2e" roughness={0.8} metalness={0.5} />
      </mesh>
      <mesh geometry={g.raven}>
        <meshStandardMaterial color="#d8d2c4" roughness={1} emissive="#d8d2c4" emissiveIntensity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

/** Groups of four deep, pale scratches gouged into dark oak at hand height; the lower ones stained. */
const scratchGeo = once(() => {
  const pale: THREE.BufferGeometry[] = []
  const stain: THREE.BufferGeometry[] = []
  const groups: [number, number, number][] = [
    [-0.25, 0.25, 0.2],
    [0.05, 0.15, -0.15],
    [0.25, -0.15, 0.1],
    [-0.1, -0.35, -0.05],
    [0.2, -0.5, 0.2],
  ]
  groups.forEach(([x, y, tilt], gi) => {
    for (let i = 0; i < 4; i++) {
      const len = 0.28 - i * 0.03
      const geo = place(new THREE.BoxGeometry(0.012, len, 0.006), [x + i * 0.035, y - i * 0.01, 0.004], [0, 0, tilt])
      ;(gi >= 3 ? stain : pale).push(geo)
    }
  })
  return { pale: merge(pale), stain: merge(stain) }
})

/** The fingernail marks on the inside of the crypt door, and a torn nail on the sill below. */
export function NailMarksShape() {
  const g = scratchGeo()
  return (
    <>
      <mesh geometry={g.pale}>
        <meshStandardMaterial color="#e8dcc4" roughness={1} emissive="#e8dcc4" emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={g.stain}>
        <meshStandardMaterial color="#5a1712" roughness={1} emissive="#5a1712" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.05, -0.97, 0.05]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <circleGeometry args={[0.012, 8]} />
        <meshStandardMaterial color="#e8dcc4" roughness={1} />
      </mesh>
    </>
  )
}

const slumpGeo = once(() => ({
  // Elias slumped against the inside of the door, in his dark coat: sitting, back to the door.
  coat: merge([
    place(new THREE.CapsuleGeometry(0.18, 0.4, 6, 12), [0, 0.42, 0.12], [0.35, 0, 0]),
    place(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), [-0.12, 0.12, 0.42], [Math.PI / 2 - 0.1, 0, 0.1]),
    place(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), [0.12, 0.12, 0.42], [Math.PI / 2 - 0.1, 0, -0.1]),
    place(new THREE.CapsuleGeometry(0.05, 0.36, 4, 8), [-0.24, 0.35, 0.22], [0.6, 0, 0.15]),
    place(new THREE.CapsuleGeometry(0.05, 0.36, 4, 8), [0.24, 0.35, 0.22], [0.6, 0, -0.15]),
  ]),
  skin: merge([
    place(new THREE.SphereGeometry(0.11, 12, 10), [0.04, 0.82, 0.22], Y_UP, [1, 1.1, 1]),
    place(new THREE.SphereGeometry(0.04, 8, 6), [-0.26, 0.18, 0.38]),
    place(new THREE.SphereGeometry(0.04, 8, 6), [0.26, 0.18, 0.38]),
  ]),
}))

/** Elias Thorne, found slumped against the inside of the Crane crypt door. PLACEHOLDER figure. */
export function SlumpedBodyShape() {
  const g = slumpGeo()
  return (
    <>
      <mesh geometry={g.coat}>
        <meshStandardMaterial color="#26221d" roughness={1} />
      </mesh>
      <mesh geometry={g.skin}>
        <meshStandardMaterial color="#b8ad98" roughness={1} />
      </mesh>
    </>
  )
}

const doorGeo = once(() => ({
  // Five vertical planks with gaps, on a frame.
  planks: merge(
    [-0.32, -0.16, 0, 0.16, 0.32].map((x, i) => place(new THREE.BoxGeometry(0.15, 1.95 - (i % 2) * 0.02, 0.05), [x, 0, 0])),
  ),
  iron: merge([
    // Strap hinges, studs and a ring pull.
    place(new THREE.BoxGeometry(0.75, 0.06, 0.012), [0.02, 0.65, 0.031]),
    place(new THREE.BoxGeometry(0.75, 0.06, 0.012), [0.02, -0.65, 0.031]),
    ...[-0.3, -0.1, 0.1, 0.3].flatMap((x) => [0.65, -0.65].map((y) => place(new THREE.SphereGeometry(0.012, 6, 4), [x, y, 0.04]))),
    place(new THREE.TorusGeometry(0.05, 0.008, 6, 16), [-0.28, -0.05, 0.045]),
    place(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10), [-0.28, 0, 0.034], [Math.PI / 2, 0, 0]),
  ]),
}))

/** The crypt's door leaf, swung back: oak planks, iron straps, studs and a ring pull. */
export function CryptDoorShape() {
  const g = doorGeo()
  return (
    <>
      <mesh geometry={g.planks}>
        <meshStandardMaterial color={DARK_OAK} roughness={0.95} />
      </mesh>
      <mesh geometry={g.iron}>
        <meshStandardMaterial color={IRON} roughness={0.7} metalness={0.6} />
      </mesh>
    </>
  )
}


// ---- Walk clues ----

const spadeGeo = once(() => ({
  wood: merge([
    place(new THREE.CylinderGeometry(0.018, 0.02, 0.8, 8), [0, 0.6, 0]),
    // The D-grip at the top.
    place(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI), [0, 1.0, 0]),
    place(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 6), [0, 1.0, 0], SIDEWAYS),
  ]),
  iron: merge([
    // Socket, tread and a dished blade.
    place(new THREE.CylinderGeometry(0.024, 0.03, 0.12, 8), [0, 0.25, 0]),
    place(
      slab(
        [
          [-0.09, 0.12],
          [0.09, 0.12],
          [0.085, -0.06],
          [0.04, -0.13],
          [-0.04, -0.13],
          [-0.085, -0.06],
        ],
        0.012,
        0.002,
      ),
      [0, 0.09, 0.006],
      [Math.PI / 2, 0, 0],
    ),
    place(new THREE.BoxGeometry(0.19, 0.012, 0.035), [0, 0.215, 0]),
  ]),
  clay: merge([
    place(new THREE.SphereGeometry(0.05, 8, 6), [0.02, 0.0, 0.015], Y_UP, [1.4, 0.8, 0.5]),
    place(new THREE.SphereGeometry(0.035, 7, 5), [-0.04, 0.05, 0.016], Y_UP, [1, 0.8, 0.45]),
    place(new THREE.SphereGeometry(0.03, 7, 5), [0.05, 0.1, 0.014], Y_UP, [1, 0.8, 0.4]),
  ]),
}))

function posyGeo() {
  const stems: THREE.BufferGeometry[] = []
  const petals: THREE.BufferGeometry[] = []
  const hearts: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const blooms: readonly (readonly [number, number, number])[] = [
    [-0.05, 0.02, 0.04],
    [0.05, 0.05, 0.08],
    [0.0, -0.06, 0.06],
    [0.07, -0.03, 0.03],
  ]
  blooms.forEach(([x, z, lift], i) => {
    // Stems lie on the ground, gathered at one end; the heads fan out.
    stems.push(place(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 5), [x * 0.4 - 0.14, 0.012, z * 0.4], [0, -Math.atan2(z, x + 0.3), Math.PI / 2]))
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2 + i
      petals.push(
        place(new THREE.SphereGeometry(0.024, 7, 5), [x + Math.cos(a) * 0.022, 0.02 + lift * 0.3, z + Math.sin(a) * 0.022], [0, -a, 0.3], [1.2, 0.35, 0.8]),
      )
    }
    hearts.push(place(new THREE.SphereGeometry(0.012, 6, 5), [x, 0.03 + lift * 0.3, z]))
    leaves.push(place(new THREE.SphereGeometry(0.03, 6, 4), [x - 0.05, 0.01, z + 0.02], [0, i, 0], [1.6, 0.2, 0.6]))
  })
  const ribbon = merge([place(new THREE.TorusGeometry(0.02, 0.006, 6, 12), [-0.24, 0.015, 0], [0, Math.PI / 2, 0])])
  return { stems: merge(stems), petals: merge(petals), hearts: merge(hearts), leaves: merge(leaves), ribbon }
}
const posy = once(posyGeo)

const puddleGeo = once(() => merge([place(slab(blob(0.3, 0.24, 0.14, 4.1, 22), 0.003), [0, 0.003, 0])]))

const noteGeo = once(() => ({
  paper: merge([
    // A sheet folded once, the top half lifting.
    place(new THREE.BoxGeometry(0.2, 0.003, 0.075), [0, 0.003, -0.037]),
    place(new THREE.BoxGeometry(0.2, 0.003, 0.075), [0, 0.012, 0.036], [0.25, 0, 0]),
  ]),
  ink: merge(
    [0, 1, 2, 3].map((i) => place(new THREE.BoxGeometry(0.14 - (i % 2) * 0.04, 0.001, 0.004), [-0.01, 0.0052, -0.06 + i * 0.012])),
  ),
}))

const bundleGeo = once(() => ({
  cloth: merge([
    place(new THREE.SphereGeometry(0.1, 12, 10), [0, 0.07, 0], Y_UP, [1.15, 0.7, 0.85]),
    // The knot and its two ears.
    place(new THREE.SphereGeometry(0.03, 8, 6), [0, 0.135, 0]),
    place(new THREE.ConeGeometry(0.02, 0.07, 6), [0.03, 0.16, 0], [0, 0, -0.8]),
    place(new THREE.ConeGeometry(0.02, 0.07, 6), [-0.03, 0.16, 0], [0, 0, 0.8]),
  ]),
  cord: merge([
    place(new THREE.TorusGeometry(0.088, 0.006, 6, 18), [0, 0.07, 0], [0, 0, 0], [1.3, 0.72, 1]),
    place(new THREE.TorusGeometry(0.075, 0.006, 6, 18), [0, 0.07, 0], [0, Math.PI / 2, 0], [1, 0.72, 1]),
  ]),
}))

export type WalkClueLook = 'spade' | 'posy' | 'oil' | 'note' | 'bundle' | 'ruts'

/** The tipped lantern at the Lowe crypt, and the sheen on its spilled oil. */
const tippedLanternGeo = once(() => ({
  lantern: merge([
    place(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 10, 1, true), [0.18, 0.07, 0.05], [0, 0, Math.PI / 2 - 0.15]),
    place(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), [0.28, 0.07, 0.05], [0, 0, Math.PI / 2 - 0.15]),
    place(new THREE.TorusGeometry(0.05, 0.006, 6, 12, Math.PI), [0.08, 0.08, 0.05], [0, Math.PI / 2, Math.PI / 2]),
  ]),
  sheen: merge([
    place(new THREE.RingGeometry(0.16, 0.19, 24), [0, 0.006, 0], [-Math.PI / 2, 0, 0]),
    place(new THREE.BoxGeometry(0.02, 0.004, 0.18), [-0.05, 0.004, 0.24]),
    place(new THREE.BoxGeometry(0.015, 0.004, 0.12), [0.06, 0.004, 0.22]),
  ]),
}))

/** A walk clue's look: a spade with fresh clay, a posy, a slick of oil, a folded note, a bundle or cart ruts. */
export function WalkClueShape({ look }: { look: WalkClueLook }) {
  if (look === 'spade') {
    const g = spadeGeo()
    return (
      <group rotation={[0, 0, 0.35]}>
        <mesh geometry={g.wood}>
          <meshStandardMaterial color="#5a4632" roughness={0.9} />
        </mesh>
        <mesh geometry={g.iron}>
          <meshStandardMaterial color="#4a4038" roughness={0.75} metalness={0.5} />
        </mesh>
        <mesh geometry={g.clay}>
          <meshStandardMaterial color="#7a5434" roughness={1} />
        </mesh>
      </group>
    )
  }
  if (look === 'posy') {
    const g = posy()
    return (
      <>
        <mesh geometry={g.stems}>
          <meshStandardMaterial color="#3e5230" roughness={1} />
        </mesh>
        <mesh geometry={g.leaves}>
          <meshStandardMaterial color="#45602f" roughness={1} />
        </mesh>
        <mesh geometry={g.petals}>
          <meshStandardMaterial color="#8a3a3a" roughness={0.9} />
        </mesh>
        <mesh geometry={g.hearts}>
          <meshStandardMaterial color="#c9c2a8" roughness={1} />
        </mesh>
        <mesh geometry={g.ribbon}>
          <meshStandardMaterial color="#d8d0bc" roughness={0.9} />
        </mesh>
      </>
    )
  }
  if (look === 'oil') {
    const g = tippedLanternGeo()
    return (
      <>
        <mesh geometry={puddleGeo()}>
          <meshStandardMaterial color={OIL} roughness={0.05} metalness={0.6} />
        </mesh>
        {/* The sheen: a bright, thin edge round the pool, and drip trails down the step. */}
        <mesh geometry={g.sheen}>
          <meshStandardMaterial color="#6fa8a0" roughness={0.1} metalness={0.3} emissive="#7a6ab0" emissiveIntensity={0.45} />
        </mesh>
        <mesh geometry={g.lantern}>
          <meshStandardMaterial color="#5a4a30" roughness={0.6} metalness={0.6} />
        </mesh>
      </>
    )
  }
  if (look === 'ruts') return <RutsShape length={1.4} gauge={0.9} />
  if (look === 'note') {
    const g = noteGeo()
    return (
      <group rotation={[0, 0.4, 0]}>
        <mesh geometry={g.paper}>
          <meshStandardMaterial color={PAPER} roughness={1} />
        </mesh>
        <mesh geometry={g.ink}>
          <meshStandardMaterial color={INK} roughness={1} />
        </mesh>
      </group>
    )
  }
  const g = bundleGeo()
  return (
    <>
      <mesh geometry={g.cloth}>
        <meshStandardMaterial color="#4a4036" roughness={1} />
      </mesh>
      <mesh geometry={g.cord}>
        <meshStandardMaterial color={ROPE} roughness={1} />
      </mesh>
    </>
  )
}

// ---- Case 2: the watch log, the crest niche and the boot casts ----

const logGeo = once(() => ({
  cover: merge([
    // An open ledger: two boards and a spine lying flat.
    place(new THREE.BoxGeometry(0.17, 0.006, 0.32), [-0.088, 0.003, 0], [0, 0, 0.04]),
    place(new THREE.BoxGeometry(0.17, 0.006, 0.32), [0.088, 0.003, 0], [0, 0, -0.04]),
    place(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), [0, 0.004, 0], [Math.PI / 2, 0, 0]),
  ]),
  pages: merge([
    place(new THREE.BoxGeometry(0.16, 0.022, 0.3), [-0.082, 0.017, 0], [0, 0, 0.06]),
    place(new THREE.BoxGeometry(0.16, 0.022, 0.3), [0.082, 0.017, 0], [0, 0, -0.06]),
  ]),
  ink: merge(
    [-1, 1].flatMap((side) =>
      Array.from({ length: 9 }, (_, i) =>
        place(new THREE.BoxGeometry(0.11 - (i % 3) * 0.02, 0.001, 0.003), [side * 0.085, 0.029 + (side < 0 ? 0.004 : 0.004), -0.12 + i * 0.028], [0, 0, side * -0.06]),
      ),
    ),
  ),
  // An ink pot and a quill beside it.
  pot: merge([
    place(
      lathe([
        [0, 0],
        [0.026, 0],
        [0.028, 0.03],
        [0.012, 0.04],
        [0.012, 0.05],
        [0, 0.05],
      ]),
      [0.2, 0, 0.12],
    ),
  ]),
  quill: merge([
    place(new THREE.CylinderGeometry(0.002, 0.003, 0.2, 5), [0.16, 0.02, 0.05], [0.3, 0, 1.3]),
    place(new THREE.SphereGeometry(0.03, 6, 4), [0.11, 0.035, 0.08], [0.2, 0.5, 0.4], [0.3, 0.12, 2]),
  ]),
}))

/** The watch-house logbook lying open, with an ink pot and a quill. */
export function LogbookShape() {
  const g = logGeo()
  return (
    <>
      <mesh geometry={g.cover}>
        <meshStandardMaterial color="#2e231c" roughness={0.9} />
      </mesh>
      <mesh geometry={g.pages}>
        <meshStandardMaterial color={OLD_PAPER} roughness={1} />
      </mesh>
      <mesh geometry={g.ink}>
        <meshStandardMaterial color={INK} roughness={1} />
      </mesh>
      <mesh geometry={g.pot}>
        <meshStandardMaterial color="#1c2228" roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh geometry={g.quill}>
        <meshStandardMaterial color="#d8d0bc" roughness={0.9} />
      </mesh>
    </>
  )
}

/** A loose torn page lying by the logbook. */
const pageGeo = once(() => merge([place(slab([[-0.06, -0.08], [0.06, -0.08], [0.06, 0.06], [0.03, 0.08], [0.0, 0.065], [-0.035, 0.08], [-0.06, 0.07]], 0.003), [0, 0, 0])]))
export function LoosePageShape() {
  return (
    <mesh geometry={pageGeo()}>
      <meshStandardMaterial color={PAPER} roughness={1} />
    </mesh>
  )
}

/** Half the width of a boot sole at `t` along it (0 heel, 1 toe), for a sole of width `w`. */
function soleHalfWidth(t: number, w: number): number {
  const pts: readonly (readonly [number, number])[] = [
    [0, 0.0],
    [0.03, 0.3],
    [0.1, 0.42],
    [0.22, 0.43],
    [0.38, 0.32],
    [0.58, 0.45],
    [0.72, 0.5],
    [0.86, 0.44],
    [0.95, 0.3],
    [1, 0],
  ]
  for (let i = 1; i < pts.length; i++) {
    const [t0, h0] = pts[i - 1]
    const [t1, h1] = pts[i]
    if (t <= t1) return w * (h0 + ((t - t0) / (t1 - t0)) * (h1 - h0))
  }
  return 0
}

/** A sole outline from `t0` to `t1` along a sole `len` long, heel towards -Z. */
function soleOutline(len: number, w: number, t0: number, t1: number, n = 16): [number, number][] {
  const right: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    right.push([Math.max(0.004, soleHalfWidth(t, w)), (t - 0.5) * len])
  }
  return [...right, ...right.reverse().map(([x, z]): [number, number] => [-x, z])]
}

/**
 * The print in the mud at the foot of the robbed grave, set in plaster, drawn from its sole: a square
 * iron-tipped heel, a full ring of hobnails, a crack straight across and yellow clay in the tread.
 * Real geometry in high-contrast colours, so it reads with no shadows (Low graphics).
 */
export function BootCastShape({ sole }: { sole: SoleDef }) {
  const g = useMemo(() => {
    const plaster = merge([place(slab(blob(0.13, 0.2, 0.05, 3, 20), 0.03, 0.01), [0, 0, 0])])
    const len = 0.3
    const w = 0.36 * len
    const top = 0.041
    const print = place(slab(soleOutline(len, w, 0, 1), 0.002), [0, top, 0])
    const nails: THREE.BufferGeometry[] = []
    if (sole.nails.startsWith('a full ring')) {
      for (let i = 0; i < 18; i++) {
        const t = 0.04 + (i / 18) * 0.92
        const hw = soleHalfWidth(t, w) * 0.78
        for (const side of [-1, 1]) {
          if (i % 2 === (side > 0 ? 0 : 1)) nails.push(place(new THREE.CylinderGeometry(0.007, 0.007, 0.003, 8), [side * hw, top + 0.002, (t - 0.5) * len]))
        }
      }
    }
    if (sole.sole.startsWith('cracked')) {
      // The crack: a jagged dark line straight across the ball of the foot.
      for (let i = 0; i < 4; i++) {
        nails.push(place(new THREE.BoxGeometry(0.035, 0.003, 0.006), [-0.05 + i * 0.033, top + 0.003, 0.03 + (i % 2) * 0.008], [0, (i % 2 ? 0.4 : -0.4), 0]))
      }
    }
    const clay = sole.clay
      ? merge([
          place(slab(blob(0.03, 0.02, 0.2, 1), 0.003), [0.015, top + 0.001, 0.07]),
          place(slab(blob(0.02, 0.025, 0.2, 2), 0.003), [-0.02, top + 0.001, -0.09]),
          place(slab(blob(0.05, 0.03, 0.3, 4), 0.003), [0.09, 0.03, -0.12]),
        ])
      : null
    return { plaster, print, nails: nails.length ? merge(nails) : null, clay }
  }, [sole])
  return (
    <>
      <mesh geometry={g.plaster}>
        <meshStandardMaterial color={PLASTER} roughness={1} />
      </mesh>
      <mesh geometry={g.print}>
        <meshStandardMaterial color="#6f6658" roughness={1} />
      </mesh>
      {g.nails && (
        <mesh geometry={g.nails}>
          <meshStandardMaterial color={INK} roughness={0.8} />
        </mesh>
      )}
      {g.clay && (
        <mesh geometry={g.clay}>
          <meshStandardMaterial color={CLAY} roughness={1} emissive={CLAY} emissiveIntensity={0.15} />
        </mesh>
      )}
    </>
  )
}

// ---- Case 2: the fresh graves, the boots and Kerr's locker ----

/** A grave mound 1.8 m long, foot towards +Z, with a wooden marker at its head. */
const moundGeo = once(() => place(slab(blob(0.45, 0.95, 0.04, 7, 20), 0.18, 0.12), [0, 0, -0.95]))
/** The robbed grave dug out and thrown back loosely: a low, rough ring of soil the lid shows through. */
const dugGeo = once(() => place(slab(blob(0.5, 1.0, 0.18, 8, 20), 0.06, 0.03), [0, 0, -0.95]))
const markerGeo = once(() =>
  merge([
    place(new THREE.BoxGeometry(0.06, 0.8, 0.05), [0, 0.4, -1.95]),
    place(new THREE.BoxGeometry(0.42, 0.24, 0.03), [0, 0.62, -1.92]),
  ]),
)
/** The robbed grave's spoil: yellow clay heaped and spread on the grass, and the coffin lid showing. */
const spoilGeo = once(() =>
  merge([
    place(slab(blob(0.5, 0.35, 0.25, 11), 0.12, 0.08), [0.75, 0, -1.1]),
    place(slab(blob(0.3, 0.2, 0.3, 12), 0.02), [0.6, 0, -0.25]),
    place(slab(blob(0.25, 0.18, 0.3, 13), 0.02), [-0.6, 0, -1.6]),
  ]),
)
const lidGeo = once(() => place(new THREE.BoxGeometry(0.42, 0.04, 1.1), [0, 0.075, -0.95]))

/** A fresh grave: a settled mound, or the robbed one dug open with clay all round it. */
export function FreshGraveShape({ robbed }: { robbed: boolean }) {
  return (
    <>
      <mesh geometry={robbed ? dugGeo() : moundGeo()}>
        <meshStandardMaterial color={robbed ? '#3a2a1c' : '#4a3a26'} roughness={1} />
      </mesh>
      <mesh geometry={markerGeo()}>
        <meshStandardMaterial color={OAK} roughness={0.9} />
      </mesh>
      {robbed && (
        <>
          <mesh geometry={spoilGeo()}>
            <meshStandardMaterial color={CLAY} roughness={1} emissive={CLAY} emissiveIntensity={0.12} />
          </mesh>
          <mesh geometry={lidGeo()}>
            <meshStandardMaterial color={DARK_OAK} roughness={0.8} />
          </mesh>
        </>
      )}
    </>
  )
}

/** One boot standing upright: sole, upper and shaft. PLACEHOLDER until the detailed models are made. */
const bootGeo = (narrow: boolean) =>
  merge([
    place(slab(soleOutline(0.28, narrow ? 0.08 : 0.1, 0, 1), 0.025), [0, 0, 0]),
    place(new THREE.BoxGeometry(narrow ? 0.07 : 0.09, 0.08, 0.2), [0, 0.065, 0.03]),
    place(new THREE.CylinderGeometry(narrow ? 0.04 : 0.05, narrow ? 0.045 : 0.055, 0.2, 10), [0, 0.15, -0.07]),
  ])
const BOOT_GEO = { narrow: once(() => bootGeo(true)), wide: once(() => bootGeo(false)) }

/** A pair of boots side by side; Kerr's carry yellow clay on the toes. */
export function BootPairShape({ narrow, clay }: { narrow: boolean; clay: boolean }) {
  const geo = narrow ? BOOT_GEO.narrow() : BOOT_GEO.wide()
  return (
    <>
      {[-0.07, 0.07].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={geo}>
            <meshStandardMaterial color={narrow ? '#1c1714' : LEATHER} roughness={0.85} />
          </mesh>
          {clay && (
            <mesh position={[0, 0.03, 0.11]}>
              <boxGeometry args={[0.1, 0.05, 0.06]} />
              <meshStandardMaterial color={CLAY} roughness={1} emissive={CLAY} emissiveIntensity={0.15} />
            </mesh>
          )}
        </group>
      ))}
    </>
  )
}

/** Kerr's tool locker: an oak cabinet with iron bands and a round brass dial on the door. */
const lockerGeo = once(() =>
  merge([
    place(new THREE.BoxGeometry(0.7, 1.3, 0.45), [0, 0.65, 0]),
    place(new THREE.BoxGeometry(0.74, 0.05, 0.49), [0, 1.32, 0]),
  ]),
)
const lockerBandGeo = once(() =>
  merge([
    place(new THREE.BoxGeometry(0.72, 0.04, 0.02), [0, 0.3, 0.23]),
    place(new THREE.BoxGeometry(0.72, 0.04, 0.02), [0, 1.05, 0.23]),
  ]),
)
const lockerDialGeo = once(() => place(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 24), [0, 0.75, 0.235], [Math.PI / 2, 0, 0]))

export function LockerShape({ open }: { open: boolean }) {
  return (
    <>
      <mesh geometry={lockerGeo()}>
        <meshStandardMaterial color={open ? DARK_OAK : OAK} roughness={0.9} />
      </mesh>
      <mesh geometry={lockerBandGeo()}>
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh geometry={lockerDialGeo()}>
        <meshStandardMaterial color="#c9a24a" roughness={0.4} metalness={0.7} emissive="#c9a24a" emissiveIntensity={0.1} />
      </mesh>
    </>
  )
}


