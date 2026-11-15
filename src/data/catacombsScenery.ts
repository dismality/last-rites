// The catacombs' Blender scene data (spec 09 task 11n-c): the collision boxes, surfaces and
// candle anchors that sit beside catacombs.glb. Typed imports of the JSON, so the scene and the
// tests read the same numbers. The model is in world space (mounted with no transform).

import raw from '../../public/assets/models/scene/catacombs.json'
import type { Vec3 } from './cemeteryLayout'

export interface CatacombBox {
  /** Centre of the box (y is the middle), world metres. */
  readonly center: Vec3
  /** Half extents. */
  readonly half: Vec3
  readonly rotY: number
  /** The generator's name for it ("ledge", "bier", "portal pier"). */
  readonly note: string
}

/**
 * The bier stands 0.94 m deep against the west wall, which would leave 1.56 m of the 2.5 m
 * corridor open. The brief asks for 1.6 m everywhere, so its collider's east edge is pulled in to
 * this x (the mesh is unchanged; the box still covers the stone body).
 */
export const BIER_EAST_EDGE_X = 24.64

/** Ledges, bier, reliquary altar, portal piers and wing walls. */
export const CATACOMB_BOXES: readonly CatacombBox[] = raw.boxes.map((b) => {
  const box: CatacombBox = {
    center: [b.center[0], b.center[1], b.center[2]],
    half: [b.half[0], b.half[1], b.half[2]],
    rotY: b.rotY,
    note: b.note,
  }
  if (b.note !== 'bier') return box
  const west = box.center[0] - box.half[0]
  const half = (BIER_EAST_EDGE_X - west) / 2
  return {
    ...box,
    center: [west + half, box.center[1], box.center[2]],
    half: [half, box.half[1], box.half[2]],
  }
})

/** Heights things rest on. */
export const CATACOMB_SURFACES = {
  ledgeY: raw.surfaces['ledges-y'],
  bierTopY: raw.surfaces['bier-top-y'],
  altarTopY: raw.surfaces['altar-top-y'],
} as const

const at = (p: readonly number[]): Vec3 => [p[0], p[1], p[2]]

/** Candle flames (emissive in the model). Only two get a light, and only when the budget allows. */
export const CATACOMB_CANDLES: Readonly<Record<string, Vec3>> = {
  bier: at(raw.anchors['candle-5'].position),
  altar: at(raw.anchors['candle-4'].position),
}
