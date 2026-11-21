// The case props' looks, built in code (spec 10 props). Each shape is a few merged meshes, so a
// detailed prop still costs a handful of draw calls. No lights and no colliders here: CaseProps
// wraps these in their Interactables. Rendering only.
import { useMemo } from 'react'
import * as THREE from 'three'
import type { CastDef, EvidenceCardId } from '../../data/cases'
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

// ---- Case 3 crypt: the evidence, the slate and the opened crypt ----

const letterGeo = once(() => ({
  paper: merge([
    place(new THREE.BoxGeometry(0.2, 0.004, 0.13), [0, 0.002, 0]),
    // The envelope's flap, a shallow triangle folded over.
    place(
      slab(
        [
          [-0.1, -0.065],
          [0.1, -0.065],
          [0, 0.01],
        ],
        0.002,
      ),
      [0, 0.004, 0],
    ),
  ]),
  seal: merge([place(new THREE.CylinderGeometry(0.016, 0.018, 0.005, 12), [0, 0.0065, -0.012])]),
  ink: merge(
    [0.025, 0.04].map((z, i) => place(new THREE.BoxGeometry(0.09 - i * 0.03, 0.001, 0.004), [0.015, 0.0045, z])),
  ),
}))

const rutGeo = once(() => {
  const mud: THREE.BufferGeometry[] = []
  const ridge: THREE.BufferGeometry[] = []
  for (const x of [-0.55, 0.55]) {
    mud.push(place(new THREE.BoxGeometry(0.2, 0.012, 2.4), [x, 0.002, 0]))
    // The squeezed-up mud along both edges, broken into lumps.
    for (let i = 0; i < 8; i++) {
      for (const side of [-1, 1]) {
        ridge.push(
          place(new THREE.SphereGeometry(0.05, 6, 4), [x + side * 0.12, 0.008, -1.1 + i * 0.31 + side * 0.07], [0, i, 0], [1, 0.35, 2.2]),
        )
      }
    }
  }
  // A puddle standing in one rut.
  const water = merge([place(slab(blob(0.08, 0.3, 0.15, 2), 0.002), [0.55, 0.009, 0.4])])
  return { mud: merge(mud), ridge: merge(ridge), water }
})

const oilGeo = once(() => ({
  pool: merge([place(slab(blob(0.42, 0.34, 0.12, 1.7, 24), 0.004), [0, 0, 0])]),
  // The keeper's oil can on its side, its spout towards the pool.
  can: merge([
    place(
      lathe([
        [0, -0.07],
        [0.06, -0.07],
        [0.065, -0.06],
        [0.065, 0.04],
        [0.045, 0.065],
        [0.012, 0.08],
        [0, 0.08],
      ]),
      [-0.34, 0.065, 0.22],
      [0, 0, Math.PI / 2 - 0.1],
      [1, 1, 1],
    ),
    place(new THREE.CylinderGeometry(0.006, 0.01, 0.14, 8), [-0.43, 0.05, 0.22], [0, 0, Math.PI / 2 + 0.3]),
    place(new THREE.TorusGeometry(0.035, 0.005, 6, 12, Math.PI), [-0.33, 0.12, 0.22], [Math.PI / 2, 0, Math.PI / 2]),
  ]),
}))

const pinGeo = once(() => ({
  iron: merge([
    // A tapered iron pin with a forged head and a ring through it.
    place(new THREE.CylinderGeometry(0.018, 0.012, 0.36, 8), [0, 0, 0.02], [Math.PI / 2, 0, 0]),
    place(new THREE.ConeGeometry(0.012, 0.05, 8), [0, 0, 0.225], [Math.PI / 2, 0, 0]),
    place(new THREE.CylinderGeometry(0.03, 0.028, 0.03, 8), [0, 0, -0.17], [Math.PI / 2, 0, 0]),
    place(new THREE.TorusGeometry(0.035, 0.006, 6, 16), [0, 0.015, -0.2], [0.3, 0, 0]),
  ]),
}))

const scratchGeo = once(() => ({
  splinter: merge(
    [-0.1, 0, 0.1].map((x, i) =>
      place(new THREE.BoxGeometry(0.03, 0.4 - i * 0.04, 0.008), [x, -i * 0.02, 0], [0, 0, 0.15 + i * 0.04]),
    ),
  ),
  groove: merge(
    [-0.1, 0, 0.1].map((x, i) =>
      place(new THREE.BoxGeometry(0.008, 0.38 - i * 0.04, 0.004), [x, -i * 0.02, 0.005], [0, 0, 0.15 + i * 0.04]),
    ),
  ),
}))

/** Each evidence prop of Elias's last night. */
export function EvidenceShape({ id }: { id: Exclude<EvidenceCardId, 'dry-boots'> }) {
  switch (id) {
    case 'unsent-letter': {
      const g = letterGeo()
      return (
        <group rotation={[0, 0.5, 0]}>
          <mesh geometry={g.paper}>
            <meshStandardMaterial color={PAPER} roughness={1} />
          </mesh>
          <mesh geometry={g.seal}>
            <meshStandardMaterial color="#7a1c18" roughness={0.5} />
          </mesh>
          <mesh geometry={g.ink}>
            <meshStandardMaterial color={INK} roughness={1} />
          </mesh>
        </group>
      )
    }
    case 'cart-ruts': {
      const g = rutGeo()
      return (
        <>
          <mesh geometry={g.mud}>
            <meshStandardMaterial color="#1d1813" roughness={1} />
          </mesh>
          <mesh geometry={g.ridge}>
            <meshStandardMaterial color="#2c241b" roughness={1} />
          </mesh>
          <mesh geometry={g.water}>
            <meshStandardMaterial color="#20262a" roughness={0.1} metalness={0.4} />
          </mesh>
        </>
      )
    }
    case 'spilled-oil': {
      const g = oilGeo()
      return (
        <>
          <mesh geometry={g.pool}>
            <meshStandardMaterial color={OIL} roughness={0.15} metalness={0.4} />
          </mesh>
          <mesh geometry={g.can}>
            <meshStandardMaterial color="#5a4a30" roughness={0.6} metalness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </>
      )
    }
    case 'hearse-pin': {
      const g = pinGeo()
      return (
        <mesh geometry={g.iron}>
          <meshStandardMaterial color={IRON} roughness={0.75} metalness={0.6} />
        </mesh>
      )
    }
    case 'nail-marks': {
      const g = scratchGeo()
      return (
        <>
          <mesh geometry={g.splinter}>
            <meshStandardMaterial color={OLD_PAPER} roughness={1} />
          </mesh>
          <mesh geometry={g.groove}>
            <meshStandardMaterial color="#5a4632" roughness={1} />
          </mesh>
        </>
      )
    }
  }
}

const slateGeo = once(() => ({
  wood: merge([
    // An easel: two front legs, a back leg, a cross bar and a ledge.
    place(new THREE.BoxGeometry(0.04, 1.2, 0.03), [-0.28, 0.58, 0.05], [-0.15, 0, -0.08]),
    place(new THREE.BoxGeometry(0.04, 1.2, 0.03), [0.28, 0.58, 0.05], [-0.15, 0, 0.08]),
    place(new THREE.BoxGeometry(0.035, 1.15, 0.03), [0, 0.55, -0.22], [0.3, 0, 0]),
    place(new THREE.BoxGeometry(0.62, 0.03, 0.06), [0, 0.64, 0.08], [-0.35, 0, 0]),
    // The slate's wooden frame.
    place(new THREE.BoxGeometry(0.76, 0.04, 0.05), [0, 1.13, 0.01], [-0.35, 0, 0]),
    place(new THREE.BoxGeometry(0.76, 0.04, 0.05), [0, 0.7, 0.16], [-0.35, 0, 0]),
    place(new THREE.BoxGeometry(0.04, 0.48, 0.05), [-0.36, 0.915, 0.085], [-0.35, 0, 0]),
    place(new THREE.BoxGeometry(0.04, 0.48, 0.05), [0.36, 0.915, 0.085], [-0.35, 0, 0]),
  ]),
  slate: merge([place(new THREE.BoxGeometry(0.7, 0.45, 0.02), [0, 0.915, 0.085], [-0.35, 0, 0])]),
  chalk: merge([
    // Chalk lines scrawled across the board, and a stub on the ledge.
    ...[0.1, 0.02, -0.07].map((y, i) =>
      place(new THREE.BoxGeometry(0.4 - i * 0.08, 0.008, 0.002), [-0.05 + i * 0.03, 0.915 + y * 0.94, 0.085 + 0.012 + y * 0.34], [-0.35, 0, 0.03 * (i - 1)]),
    ),
    place(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), [0.18, 0.68, 0.16], SIDEWAYS),
  ]),
}))

/** The slate on its easel where the six cards are laid out, with chalk marks. */
export function SlateShape() {
  const g = slateGeo()
  return (
    <>
      <mesh geometry={g.wood}>
        <meshStandardMaterial color={OAK} roughness={0.9} />
      </mesh>
      <mesh geometry={g.slate}>
        <meshStandardMaterial color="#2f2e2c" roughness={0.85} />
      </mesh>
      <mesh geometry={g.chalk}>
        <meshStandardMaterial color="#d8d4c8" roughness={1} />
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

const bodyGeo = once(() => ({
  // A body wrapped in a winding sheet, lying along X: head at +X, the cloth tied at neck and feet.
  shroud: merge([
    place(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), [0.05, 0.15, 0], [0, 0, Math.PI / 2], [1, 1, 0.75]),
    place(new THREE.CapsuleGeometry(0.12, 0.42, 6, 10), [-0.55, 0.11, 0], [0, 0, Math.PI / 2], [1, 1, 0.85]),
    place(new THREE.SphereGeometry(0.13, 12, 10), [0.66, 0.15, 0], Y_UP, [1.05, 0.95, 0.9]),
    // The hands folded on the chest, under the cloth.
    place(new THREE.SphereGeometry(0.07, 8, 6), [0.22, 0.28, 0], Y_UP, [1.4, 0.6, 1.1]),
    // The toes lifting the cloth.
    place(new THREE.SphereGeometry(0.06, 8, 6), [-0.82, 0.18, 0], Y_UP, [0.7, 1, 1.6]),
  ]),
  cord: merge([
    place(new THREE.TorusGeometry(0.105, 0.012, 6, 16), [0.5, 0.15, 0], [0, Math.PI / 2, 0], [1, 1, 0.85]),
    place(new THREE.TorusGeometry(0.135, 0.012, 6, 16), [0.02, 0.15, 0], [0, Math.PI / 2, 0], [1, 1, 0.75]),
    place(new THREE.TorusGeometry(0.1, 0.012, 6, 16), [-0.72, 0.11, 0], [0, Math.PI / 2, 0], [1, 1, 0.85]),
  ]),
}))

/** Elias, laid in the crypt in a winding sheet tied with cord. */
export function ShroudedBodyShape() {
  const g = bodyGeo()
  return (
    <>
      <mesh geometry={g.shroud}>
        <meshStandardMaterial color="#9a8f7c" roughness={1} />
      </mesh>
      <mesh geometry={g.cord}>
        <meshStandardMaterial color="#4a4036" roughness={1} />
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

export type WalkClueLook = 'spade' | 'posy' | 'oil' | 'note' | 'bundle'

/** A walk clue's look: a spade with fresh clay, a posy, a slick of oil, a folded note or a tied bundle. */
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
    return (
      <mesh geometry={puddleGeo()}>
        <meshStandardMaterial color={OIL} roughness={0.15} metalness={0.4} />
      </mesh>
    )
  }
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

const nicheGeo = once(() =>
  merge([
    // A stone pier: plinth, shaft and a moulded cap.
    place(new THREE.BoxGeometry(0.8, 0.14, 0.4), [0, 0.07, -0.1]),
    place(new THREE.BoxGeometry(0.7, 1.0, 0.3), [0, 0.64, -0.1]),
    place(new THREE.BoxGeometry(0.82, 0.06, 0.4), [0, 1.17, -0.1]),
    place(new THREE.BoxGeometry(0.74, 0.05, 0.34), [0, 1.225, -0.1]),
    // A frame round the niche's door.
    place(new THREE.BoxGeometry(0.48, 0.04, 0.03), [0, 0.62, 0.05]),
    place(new THREE.BoxGeometry(0.48, 0.04, 0.03), [0, 0.28, 0.05]),
    place(new THREE.BoxGeometry(0.04, 0.38, 0.03), [-0.22, 0.45, 0.05]),
    place(new THREE.BoxGeometry(0.04, 0.38, 0.03), [0.22, 0.45, 0.05]),
  ]),
)

/** The sexton's niche pier (the dials and the door are drawn by CaseProps, which tracks their state). */
export function NichePierShape() {
  return (
    <mesh geometry={nicheGeo()}>
      <meshStandardMaterial color={STONE} roughness={0.95} />
    </mesh>
  )
}

/** A crest dial: a stone disc with a pointer notch. */
const dialGeo = once(() =>
  merge([
    place(new THREE.CylinderGeometry(0.06, 0.062, 0.03, 16), [0, 0, 0], [Math.PI / 2, 0, 0]),
    place(new THREE.TorusGeometry(0.06, 0.006, 6, 18), [0, 0, 0.012]),
    place(new THREE.BoxGeometry(0.012, 0.04, 0.012), [0, 0.03, 0.018]),
  ]),
)
export function DialShape({ glow }: { glow: number }) {
  return (
    <mesh geometry={dialGeo()}>
      <meshStandardMaterial color="#8a8170" roughness={0.8} emissive="#e8913a" emissiveIntensity={glow} />
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
 * One plaster cast with the print set in it, drawn from its details: a smooth smudged heel; a full
 * cross-cut print with a ring of nine hobnails, one missing at the heel; or a narrow town shoe.
 */
export function BootCastShape({ cast }: { cast: CastDef }) {
  const g = useMemo(() => {
    const plaster = merge([place(slab(blob(0.12, 0.19, 0.05, cast.position[0], 20), 0.03, 0.01), [0, 0, 0])])
    const narrow = cast.tread.startsWith('fine')
    const len = cast.size === null ? 0.27 : 0.18 + cast.size * 0.01
    const w = narrow ? 0.29 * len : 0.36 * len
    const print: THREE.BufferGeometry[] = []
    const tread: THREE.BufferGeometry[] = []
    const top = 0.041
    if (cast.size === null) {
      // Only a heel came out, worn smooth and smeared.
      print.push(place(slab(soleOutline(len, w, 0, 0.34), 0.002), [0, top, 0.05]))
      print.push(place(slab(blob(0.03, 0.05, 0.3, 3), 0.002), [0.02, top, 0.13]))
    } else if (narrow) {
      // A town shoe: a separate heel block and a slim forepart.
      print.push(place(slab(soleOutline(len, w, 0, 0.24), 0.002), [0, top, 0]))
      print.push(place(slab(soleOutline(len, w, 0.42, 1), 0.002), [0, top, 0]))
      for (let i = 0; i < 10; i++) {
        const t = 0.48 + i * 0.05
        const hw = soleHalfWidth(t, w) * 0.75
        tread.push(place(new THREE.BoxGeometry(hw * 2, 0.0015, 0.0018), [0, top + 0.002, (t - 0.5) * len]))
      }
    } else {
      print.push(place(slab(soleOutline(len, w, 0, 1), 0.002), [0, top, 0]))
      // Cross-cut tread across the forepart.
      for (let i = 0; i < 7; i++) {
        const t = 0.48 + i * 0.065
        const hw = soleHalfWidth(t, w) * 0.7
        for (const dir of [-1, 1]) {
          tread.push(place(new THREE.BoxGeometry(hw * 2, 0.0015, 0.004), [0, top + 0.002, (t - 0.5) * len], [0, dir * 0.55, 0]))
        }
      }
      // Hobnails round the edge: ten places, the heel's last one missing.
      for (let i = 0; i < 10; i++) {
        if (i === 0) continue
        const t = 0.05 + (i / 10) * 0.9
        const side = i % 2 === 0 ? 1 : -1
        const hw = soleHalfWidth(t, w) * 0.72
        tread.push(place(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 8), [side * hw, top + 0.002, (t - 0.5) * len]))
      }
    }
    return { plaster, print: merge(print), tread: tread.length ? merge(tread) : null }
  }, [cast])
  return (
    <>
      <mesh geometry={g.plaster}>
        <meshStandardMaterial color={PLASTER} roughness={1} />
      </mesh>
      <mesh geometry={g.print}>
        <meshStandardMaterial color="#8d8576" roughness={1} />
      </mesh>
      {g.tread && (
        <mesh geometry={g.tread}>
          <meshStandardMaterial color="#b8b1a2" roughness={1} />
        </mesh>
      )}
    </>
  )
}

/** Four rivets for a tablet's iron frame. */
const rivetGeo = once(() =>
  merge(
    ([[-0.27, 0.16], [0.27, 0.16], [-0.27, -0.16], [0.27, -0.16]] as const).map(([x, y]) =>
      place(new THREE.SphereGeometry(0.012, 8, 6), [x, y, 0.002], Y_UP, [1, 1, 0.5]),
    ),
  ),
)
export function TabletRivets() {
  return (
    <mesh geometry={rivetGeo()}>
      <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.6} />
    </mesh>
  )
}

