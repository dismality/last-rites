// Collision boxes of the graveyard scene (public/assets/models/scene/graveyard-colliders.json,
// written by tools/blender/graveyard_scene.py). A typed import so the scene and the tests read the
// very same boxes. Boxes are in game coordinates and turned about Y only.

import raw from '../../public/assets/models/scene/graveyard-colliders.json'
import type { Vec3 } from './cemeteryLayout'

export interface GraveyardBox {
  /** Centre of the box (y is the middle). */
  readonly center: Vec3
  /** Half extents along the box's own axes. */
  readonly half: Vec3
  /** Rotation about Y, radians (three.js Euler Y). */
  readonly rotY: number
}

export const GRAVEYARD_COLLIDERS: readonly GraveyardBox[] = raw.boxes.map((b) => ({
  center: [b.center[0], b.center[1], b.center[2]] as Vec3,
  half: [b.half[0], b.half[1], b.half[2]] as Vec3,
  rotY: b.rotY,
}))
