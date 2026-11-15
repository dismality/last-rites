// The hut's Blender scene data (spec 09 task 11n-b): the collision boxes and surfaces that sit
// beside hut.glb. Typed imports of the JSON, so the scene and the tests read the same numbers.
// The hut model is in hut-local space, which is world space (the hut stands on the origin).

import hutRaw from '../../public/assets/models/scene/hut.json'
import benchRaw from '../../public/assets/models/props/workbench.json'
import type { Vec3 } from './cemeteryLayout'

export interface HutBox {
  /** Centre of the box (y is the middle), world metres. */
  readonly center: Vec3
  /** Half extents. */
  readonly half: Vec3
  readonly rotY: number
  /** The generator's name for it ("stove", "cot"). */
  readonly note: string
}

/** Stove, both tables, cot, barrels, log stack and the vending machine footprint. */
export const HUT_BOXES: readonly HutBox[] = hutRaw.boxes.map((b) => ({
  center: [b.center[0], b.center[1], b.center[2]],
  half: [b.half[0], b.half[1], b.half[2]],
  rotY: b.rotY,
  note: b.note,
}))

/** Heights the hut's items rest on. */
export const HUT_SURFACES = {
  eastTableY: hutRaw.surfaces['east-table-y'],
  westTableY: hutRaw.surfaces['west-table-y'],
  /** The workbench top, bench-local (the bench stands on the floor). */
  benchTopY: benchRaw.anchors['top-surface'].surfaceY,
} as const

/** Where the vending machine stands (its panel is spec 11 H6) and how it is turned. */
export const VENDING_MACHINE = { position: [2.83, 0, 1.85] as Vec3, rotationY: -Math.PI / 2 } as const

/** Ember light at the stove's firebox. Only mounted while the frame budget allows (see Hut.tsx). */
export const STOVE_GLOW: Vec3 = [
  hutRaw.anchors['stove-glow'].position[0],
  hutRaw.anchors['stove-glow'].position[1],
  hutRaw.anchors['stove-glow'].position[2],
]
