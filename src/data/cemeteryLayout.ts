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
}

export const CORRIDORS: readonly CorridorSpec[] = [MAUSOLEUM_ROW, CATACOMBS]

// --- Boundary --------------------------------------------------------------

/** Invisible walls enclose the full playable area, corridors included. */
export const PLAYABLE_BOUNDS = {
  halfX: GROUNDS_HALF + 2,
  halfZ: GROUNDS_HALF + 20 + 2,
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
