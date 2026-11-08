// Greybox cemetery layout: pure data + a deterministic prop scatter.
// No React / three.js imports so the layout can be tested in Node.
// World axes: +X east, +Z south. The keeper's hut / spawn sits at the origin.

import type { KeyItemId } from '../game/types'

export type Vec3 = readonly [number, number, number]

export type GateId = 'mausoleum-row' | 'catacombs'

/** Which key item opens which gate. The mystery spec grants the items. */
export const GATE_KEYS: Readonly<Record<GateId, KeyItemId>> = {
  'mausoleum-row': 'rusted-crypt-key',
  catacombs: 'bone-whistle',
}

// --- Grounds ---------------------------------------------------------------

/** Half-extent of the walled grounds (fences stand on this line). */
export const GROUNDS_HALF = 40

// --- Keeper's hut ----------------------------------------------------------

/** The hut is centred on the spawn point; its door is in the +Z wall, behind the player at the start. */
export const HUT = {
  halfX: 3.2,
  halfZ: 3,
  height: 2.4,
  wallThickness: 0.2,
  doorWidth: 1.4,
  /** Height of the roof ridge above the wall tops. */
  roofRise: 1.3,
} as const

/** Z of the workbench centre: against the hut's north wall, straight ahead of the spawn. */
export const BENCH_Z = -2.2

// --- Chapel ----------------------------------------------------------------

export const CHAPEL_CENTER: Vec3 = [10, 0, 5]
export const CHAPEL = {
  halfX: 2.5,
  halfZ: 6,
  height: 3,
  wallThickness: 0.3,
  /** Door opening in the -Z face, centred on x = 0. */
  doorWidth: 1.4,
} as const

// --- Corridors (Mausoleum Row, Catacombs) ----------------------------------

export interface CorridorSpec {
  readonly id: GateId
  readonly centerX: number
  /** Z of the entrance (on the grounds fence line). */
  readonly entranceZ: number
  /** +1 runs toward +Z, -1 toward -Z. */
  readonly dir: 1 | -1
  readonly length: number
  /** Inner width. */
  readonly width: number
  /** Inner height. */
  readonly height: number
  readonly wallThickness: number
  /**
   * Open avenue: no side walls or ceiling, just a path with railings, lined by crypts.
   * Closed corridors (the catacombs) stay walled tubes.
   */
  readonly open: boolean
}

export const MAUSOLEUM_ROW: CorridorSpec = {
  id: 'mausoleum-row',
  centerX: -20,
  entranceZ: -GROUNDS_HALF,
  dir: -1,
  length: 20,
  width: 3.5,
  height: 4,
  wallThickness: 0.4,
  open: true,
}

// Low ceiling on purpose: claustrophobia is the point.
export const CATACOMBS: CorridorSpec = {
  id: 'catacombs',
  centerX: 25,
  entranceZ: GROUNDS_HALF,
  dir: 1,
  length: 20,
  width: 2.5,
  height: 2.2,
  wallThickness: 0.4,
  open: false,
}

export const CORRIDORS: readonly CorridorSpec[] = [MAUSOLEUM_ROW, CATACOMBS]

// --- Boundary --------------------------------------------------------------

/** Invisible walls enclose the full playable area, corridors included. */
export const PLAYABLE_BOUNDS = {
  halfX: GROUNDS_HALF + 2,
  // Room for the Crane crypt that closes the end of Mausoleum Row (back edge near z = -66).
  halfZ: GROUNDS_HALF + 30,
  wallHeight: 10,
  wallHalfThickness: 1,
} as const

// --- Fences ----------------------------------------------------------------

export interface FenceSegment {
  /** Axis the fence runs along. */
  readonly axis: 'x' | 'z'
  /** Coordinate on the other axis. */
  readonly fixed: number
  readonly from: number
  readonly to: number
}

export const FENCE = {
  height: 1.2,
  picketSpacing: 0.8,
  /** Half thickness of the collider that backs each segment. */
  colliderHalfThickness: 0.1,
} as const

function corridorOuterHalf(c: CorridorSpec): number {
  return c.width / 2 + c.wallThickness
}

/** Perimeter fence with a gap at each corridor mouth (the gate fills it). */
export function buildFenceSegments(): FenceSegment[] {
  const h = GROUNDS_HALF
  const segs: FenceSegment[] = [
    { axis: 'z', fixed: -h, from: -h, to: h },
    { axis: 'z', fixed: h, from: -h, to: h },
  ]
  for (const edge of [-h, h]) {
    const gap = CORRIDORS.find((c) => c.entranceZ === edge)
    if (!gap) {
      segs.push({ axis: 'x', fixed: edge, from: -h, to: h })
      continue
    }
    const half = corridorOuterHalf(gap)
    segs.push(
      { axis: 'x', fixed: edge, from: -h, to: gap.centerX - half },
      { axis: 'x', fixed: edge, from: gap.centerX + half, to: h }
    )
  }
  return segs
}

// --- Headstones ------------------------------------------------------------

export interface Headstone {
  readonly position: Vec3
  readonly rotationY: number
  readonly height: number
}

export const HEADSTONE = {
  count: 60,
  width: 0.6,
  depth: 0.2,
  minHeight: 0.8,
  maxHeight: 1.4,
  seed: 1891,
} as const

/** Small seeded PRNG (mulberry32) so the layout is identical every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isClear(x: number, z: number): boolean {
  const [cx, , cz] = CHAPEL_CENTER
  const nearChapel =
    Math.abs(x - cx) < CHAPEL.halfX + 4 && Math.abs(z - cz) < CHAPEL.halfZ + 4
  const nearSpawn = Math.hypot(x, z) < 6
  return !nearChapel && !nearSpawn
}

export function generateHeadstones(): Headstone[] {
  const rand = mulberry32(HEADSTONE.seed)
  const limit = GROUNDS_HALF - 3
  const out: Headstone[] = []
  // Attempt cap guarantees termination even if the exclusion zones grow.
  for (let i = 0; i < HEADSTONE.count * 20 && out.length < HEADSTONE.count; i++) {
    const x = (rand() * 2 - 1) * limit
    const z = (rand() * 2 - 1) * limit
    const rotationY = (rand() - 0.5) * 0.5 // slight lean to the left/right: crooked
    const height =
      HEADSTONE.minHeight + rand() * (HEADSTONE.maxHeight - HEADSTONE.minHeight)
    if (!isClear(x, z)) continue
    out.push({ position: [x, 0, z], rotationY, height })
  }
  return out
}

// --- Model placement -------------------------------------------------------

/** One instance of a model: ground position, yaw and per-axis scale. */
export interface Placement {
  readonly position: Vec3
  readonly rotationY: number
  readonly scale: Vec3
}

/**
 * Tiles a straight run (fence, wall) with equal panels of roughly `panelWidth`.
 * scale.x stretches each panel so the run has no gaps; models are centred on
 * their own origin by the renderer, so these are centre positions.
 */
export function panelRun(
  axis: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  panelWidth: number,
  scaleY = 1,
  scaleZ = 1,
): Placement[] {
  const len = to - from
  const n = Math.max(1, Math.round(len / panelWidth))
  const w = len / n
  const out: Placement[] = []
  for (let i = 0; i < n; i++) {
    const t = from + w * (i + 0.5)
    out.push({
      position: axis === 'x' ? [t, 0, fixed] : [fixed, 0, t],
      rotationY: axis === 'x' ? 0 : Math.PI / 2,
      scale: [w / panelWidth, scaleY, scaleZ],
    })
  }
  return out
}

/** Gravestone models, cycled by index so the mix is deterministic. */
export const HEADSTONE_KINDS = [
  'gravestone-cross',
  'gravestone-round',
  'gravestone-bevel',
  'gravestone-wide',
  'gravestone-broken',
] as const
export type HeadstoneKind = (typeof HEADSTONE_KINDS)[number]

/** Model height used to turn a headstone's layout height into a uniform scale. */
export const HEADSTONE_MODEL_HEIGHT = 1.1

export const FENCE_PANEL_WIDTH = 1.5
export const FENCE_MODEL_HEIGHT = 1.32
export const WALL_PANEL_WIDTH = 2.4
export const WALL_MODEL_HEIGHT = 1.74
export const WALL_MODEL_THICKNESS = 0.72

// --- Trees (the "dead oaks") ------------------------------------------------

// pine-fall-crooked is the autumn-coloured pine, not a fallen tree, so it is not used.
export type TreeKind = 'pine-crooked' | 'pine' | 'trunk' | 'trunk-long'

export interface Tree {
  readonly kind: TreeKind
  readonly position: Vec3
  readonly rotationY: number
}

/** Crooked pines stand in for dead oaks; fallen trunks are the stumps and logs. */
export const TREE = {
  seed: 1849,
  pines: 16,
  trunks: 8,
  /** Trunk collider half-extent for pines (the model's trunk is about 0.5 m across). */
  pineColliderHalf: 0.35,
  pineColliderHalfHeight: 3,
  trunkColliderHalf: 0.4,
  /** Keep pines this far from spawn points so pickups are never hidden. */
  clearance: 3,
} as const

/**
 * Seeded scatter. `avoid` lists points (spawn points, pickups) that must stay clear.
 * The first tree is fixed beside the oak-hollow grave so the name still fits.
 */
export function generateTrees(avoid: readonly Vec3[] = []): Tree[] {
  const rand = mulberry32(TREE.seed)
  const limit = GROUNDS_HALF - 3
  const out: Tree[] = [{ kind: 'pine-crooked', position: [-18.5, 0, 13.5], rotationY: 0.6 }]
  const blocked = (x: number, z: number) =>
    !isClear(x, z) ||
    avoid.some((a) => Math.hypot(a[0] - x, a[2] - z) < TREE.clearance) ||
    out.some((t) => Math.hypot(t.position[0] - x, t.position[2] - z) < 4)
  const total = TREE.pines + TREE.trunks
  for (let i = 0; i < total * 30 && out.length < total; i++) {
    const x = (rand() * 2 - 1) * limit
    const z = (rand() * 2 - 1) * limit
    const rotationY = rand() * Math.PI * 2
    const pickTrunk = out.length >= TREE.pines
    const kind: TreeKind = pickTrunk
      ? out.length % 2 === 0
        ? 'trunk'
        : 'trunk-long'
      : out.length % 2 === 0
        ? 'pine-crooked'
        : 'pine'
    if (blocked(x, z)) continue
    out.push({ kind, position: [x, 0, z], rotationY })
  }
  return out
}

// --- Lamps -----------------------------------------------------------------

/** Lamp posts: hut, chapel door, and both corridor mouths. Orientation faces the path. */
export const LAMP_POSTS: ReadonlyArray<{ position: Vec3; rotationY: number }> = [
  { position: [4.8, 0, -3.5], rotationY: Math.PI },
  { position: [7.5, 0, -2.5], rotationY: Math.PI },
  { position: [-17.5, 0, -37.5], rotationY: Math.PI },
  { position: [22.5, 0, 37.5], rotationY: 0 },
  { position: [-5, 0, 14], rotationY: 1 },
]
export const LAMP_COLLIDER = { half: 0.25, halfHeight: 1.5 } as const

// --- Set pieces -------------------------------------------------------------

/**
 * Crane family crypt. Parts share one position; the roof is raised by `roofLift`
 * (docs/world-models.md). It stands behind the end wall of Mausoleum Row as a
 * backdrop, so players never walk through its 1.77 m doorway.
 */
export const CRANE_CRYPT = {
  roofLift: 2.4,
  halfX: 2.37,
  halfZ: 2.93,
  height: 4.2,
} as const

export function craneCryptPosition(): Vec3 {
  const c = MAUSOLEUM_ROW
  // Flush against the end of the avenue, so the path runs up to the crypt's front.
  const avenueEnd = c.entranceZ + c.dir * c.length
  return [c.centerX, 0, avenueEnd + c.dir * CRANE_CRYPT.halfZ]
}

/** Far edge of the Crane crypt: the ground under Mausoleum Row must reach this far. */
export function avenueFarZ(): number {
  const c = MAUSOLEUM_ROW
  return c.entranceZ + c.dir * (c.length + CRANE_CRYPT.halfZ * 2)
}

export type AvenueCryptModel = 'crypt' | 'crypt-a' | 'crypt-b' | 'crypt-small'

/** Footprint of each lining crypt in its own space: width across the front, depth front to back. */
export const AVENUE_CRYPT_SIZE: Readonly<Record<AvenueCryptModel, { width: number; depth: number }>> = {
  crypt: { width: 1.73, depth: 2.68 },
  'crypt-a': { width: 1.49, depth: 2.68 },
  'crypt-b': { width: 1.49, depth: 2.68 },
  'crypt-small': { width: 3.24, depth: 3.36 },
}

export interface AvenueCrypt {
  readonly model: AvenueCryptModel
  readonly position: Vec3
  readonly rotationY: number
}

/** Gap between the avenue railing and the crypt fronts. */
const AVENUE_CRYPT_SETBACK = 0.8
const AVENUE_CRYPT_SPACING = 5.4
const AVENUE_CRYPT_FIRST_Z = 4.5
const AVENUE_CRYPT_MODELS: readonly AvenueCryptModel[] = ['crypt', 'crypt-small', 'crypt-a', 'crypt-b']

/** Crypts lining both sides of Mausoleum Row, fronts facing the path. */
export function avenueCrypts(): AvenueCrypt[] {
  const c = MAUSOLEUM_ROW
  const out: AvenueCrypt[] = []
  const rows = Math.floor((c.length - AVENUE_CRYPT_FIRST_Z - 3) / AVENUE_CRYPT_SPACING) + 1
  for (let i = 0; i < rows; i++) {
    for (const side of [-1, 1] as const) {
      // Offset the two sides by one model so they don't mirror each other.
      const model = AVENUE_CRYPT_MODELS[(i * 2 + (side === 1 ? 1 : 0)) % AVENUE_CRYPT_MODELS.length]
      const { depth } = AVENUE_CRYPT_SIZE[model]
      const x = c.centerX + side * (c.width / 2 + AVENUE_CRYPT_SETBACK + depth / 2)
      const z = c.entranceZ + c.dir * (AVENUE_CRYPT_FIRST_Z + i * AVENUE_CRYPT_SPACING)
      // Local +Z is the front: turn it toward the path.
      out.push({ model, position: [x, 0, z], rotationY: side === -1 ? -Math.PI / 2 : Math.PI / 2 })
    }
  }
  return out
}

/** Picket centres (x, z) along a fence segment. */
export function picketPositions(seg: FenceSegment): Array<readonly [number, number]> {
  const len = seg.to - seg.from
  const n = Math.max(1, Math.floor(len / FENCE.picketSpacing))
  const out: Array<readonly [number, number]> = []
  for (let i = 0; i <= n; i++) {
    const t = seg.from + (len * i) / n
    out.push(seg.axis === 'x' ? [t, seg.fixed] : [seg.fixed, t])
  }
  return out
}
