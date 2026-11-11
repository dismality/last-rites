// What the player can see versus what blocks them, for the scattered graveyard props.
// Pure data and maths (no three.js, React or Rapier), so a test can pin every collider to its model.
//
// Footprints are measured from the real .glb files (accessor bounds, unscaled, metres, y from the
// ground). tests/colliderFootprints.test.ts reads the files and fails if this table drifts from
// them. Tree trunks are not in the accessor bounds (the canopy is far wider), so their radius is a
// measured constant: the lowest vertex ring of the pine (y = 0.49, about 1.0 x 0.9 m across).

import {
  HEADSTONE_KINDS,
  HEADSTONE_MODEL_HEIGHT,
  type HeadstoneKind,
  type TreeKind,
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

/**
 * Tree trunks and stumps. Pines: trunk radius at the lowest ring (the foliage starts at y = 0.95 and
 * is walked through, like leaves). Height is the lower of the two pine tops (6.02 and 6.61 m).
 * Fallen trunks are upright stumps 0.81 m across.
 */
export const TREE_FOOTPRINTS: Readonly<Record<TreeKind, RoundFootprint>> = {
  'pine-crooked': { radius: 0.47, height: 6 },
  pine: { radius: 0.47, height: 6 },
  trunk: { radius: 0.405, height: 0.675 },
  'trunk-long': { radius: 0.405, height: 1.5 },
}

/** Lamp post: the plinth is 0.5 m across and the post is 3.04 m tall (the lantern arm is overhead). */
export const LAMP_FOOTPRINT: RoundFootprint = { radius: 0.25, height: 3.04 }

/** Crane crypt body (the roof overhangs it by 0.15 m, well above head height). */
export const CRANE_CRYPT_BODY = { halfX: 2.22, halfZ: 2.88, height: 4.22 } as const

/** Headstone model for the i-th generated headstone: the five kinds are cycled by index. */
export function headstoneKind(index: number): HeadstoneKind {
  return HEADSTONE_KINDS[index % HEADSTONE_KINDS.length]
}

/** Uniform scale that turns a layout height into the model's height. */
export function headstoneScale(layoutHeight: number): number {
  return layoutHeight / HEADSTONE_MODEL_HEIGHT
}

/** Tree scale, by index in the generated list (also used to size the instanced model). */
export function treeScale(index: number): number {
  return 0.9 + (index % 4) * 0.1
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

export function treeCollider(kind: TreeKind, scale: number, position: Vec3): CylinderSpec {
  const f = TREE_FOOTPRINTS[kind]
  const halfHeight = (f.height * scale) / 2
  return {
    position: [position[0], position[1] + halfHeight, position[2]],
    radius: f.radius * scale,
    halfHeight,
  }
}

export function lampCollider(position: Vec3): CylinderSpec {
  return {
    position: [position[0], position[1] + LAMP_FOOTPRINT.height / 2, position[2]],
    radius: LAMP_FOOTPRINT.radius,
    halfHeight: LAMP_FOOTPRINT.height / 2,
  }
}
