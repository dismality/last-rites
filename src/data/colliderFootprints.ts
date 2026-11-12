// What the player can see versus what blocks them, for the readable tombstones and lamp posts.
// Pure data and maths (no three.js, React or Rapier), so a test can pin every collider to its model.
//
// Footprints are measured from the real .glb files (accessor bounds, unscaled, metres, y from the
// ground). tests/colliderFootprints.test.ts reads the files and fails if this table drifts from
// them. The random headstones, trees and crypts now come from the graveyard scene, whose boxes live
// in graveyard-colliders.json (see graveyardColliders.ts).

import {
  HEADSTONE_MODEL_HEIGHT,
  type HeadstoneKind,
  type Vec3,
} from './cemeteryLayout'

/** Axis-aligned bounds of a model in its own space. */
export interface ModelFootprint {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly height: number
}

/** Gravestone models. The broken stone's bounds are off-centre (+0.045 x, +0.106 z). */
export const HEADSTONE_FOOTPRINTS: Readonly<Record<HeadstoneKind, ModelFootprint>> = {
  'gravestone-cross': { minX: -0.337, maxX: 0.337, minZ: -0.247, maxZ: 0.247, height: 1.372 },
  'gravestone-round': { minX: -0.337, maxX: 0.337, minZ: -0.188, maxZ: 0.188, height: 0.862 },
  'gravestone-bevel': { minX: -0.337, maxX: 0.337, minZ: -0.188, maxZ: 0.188, height: 0.794 },
  'gravestone-wide': { minX: -0.638, maxX: 0.638, minZ: -0.225, maxZ: 0.225, height: 0.856 },
  'gravestone-broken': { minX: -0.337, maxX: 0.426, minZ: -0.188, maxZ: 0.4, height: 0.512 },
}

/** Round props: a vertical cylinder of this radius and (unscaled) height stands in for the model. */
export interface RoundFootprint {
  readonly radius: number
  readonly height: number
}

/** Lamp post: the plinth is 0.5 m across and the post is 3.04 m tall (the lantern arm is overhead). */
export const LAMP_FOOTPRINT: RoundFootprint = { radius: 0.25, height: 3.04 }

/** Uniform scale that turns a layout height into the model's height. */
export function headstoneScale(layoutHeight: number): number {
  return layoutHeight / HEADSTONE_MODEL_HEIGHT
}

export interface CuboidSpec {
  /** World position of the box centre (y is the middle of the box). */
  readonly position: Vec3
  readonly rotationY: number
  readonly half: Vec3
}

export interface CylinderSpec {
  readonly position: Vec3
  readonly radius: number
  readonly halfHeight: number
}

/** Rotates a model-space x/z offset by a Y rotation (three.js Euler Y convention). */
function rotate(x: number, z: number, rotationY: number): [number, number] {
  const c = Math.cos(rotationY)
  const s = Math.sin(rotationY)
  return [x * c + z * s, -x * s + z * c]
}

/**
 * The box matching a headstone model after it is scaled by `scale`, turned by `rotationY` and
 * placed at `position`. The box centre follows the model's own bounds, not its origin.
 */
export function headstoneCollider(
  kind: HeadstoneKind,
  scale: number,
  position: Vec3,
  rotationY: number,
): CuboidSpec {
  const f = HEADSTONE_FOOTPRINTS[kind]
  const [ox, oz] = rotate(((f.minX + f.maxX) / 2) * scale, ((f.minZ + f.maxZ) / 2) * scale, rotationY)
  const height = f.height * scale
  return {
    position: [position[0] + ox, position[1] + height / 2, position[2] + oz],
    rotationY,
    half: [((f.maxX - f.minX) / 2) * scale, height / 2, ((f.maxZ - f.minZ) / 2) * scale],
  }
}

export function lampCollider(position: Vec3): CylinderSpec {
  return {
    position: [position[0], position[1] + LAMP_FOOTPRINT.height / 2, position[2]],
    radius: LAMP_FOOTPRINT.radius,
    halfHeight: LAMP_FOOTPRINT.height / 2,
  }
}
