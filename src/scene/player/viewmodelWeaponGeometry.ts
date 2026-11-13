// Where each held model ends up in front of the viewmodel camera. The transforms themselves are in
// data/itemModels.ts (HELD_GRIPS); this is the pure maths that checks them, so a unit test can
// prove no weapon reaches the camera without loading a GLB. No three.js.

import {
  HELD_GRIPS,
  HELD_MODEL_IDS,
  HELD_ORIGIN,
  isHeldModelId,
  itemSizeM,
  type HeldGrip,
  type HeldModelId,
} from '../../data/itemModels'

export type HeldWeaponId = HeldModelId

export const HELD_WEAPON_IDS: readonly HeldWeaponId[] = HELD_MODEL_IDS

export const isHeldWeaponId = isHeldModelId

/** Viewmodel camera near plane (Viewmodel.tsx). */
export const VIEWMODEL_NEAR_M = 0.01
/** A weapon must stay at least this far in front of the camera: a wide margin over the near plane. */
export const MIN_CLEARANCE_M = 0.1

type Vec3 = readonly [number, number, number]

/** Euler XYZ as three.js applies it: the matrix is Rx * Ry * Rz. */
function rotate(v: Vec3, e: Vec3): Vec3 {
  let [x, y, z] = v
  const [ex, ey, ez] = e
  // Rz first.
  ;[x, y] = [x * Math.cos(ez) - y * Math.sin(ez), x * Math.sin(ez) + y * Math.cos(ez)]
  // then Ry.
  ;[x, z] = [x * Math.cos(ey) + z * Math.sin(ey), -x * Math.sin(ey) + z * Math.cos(ey)]
  // then Rx.
  ;[y, z] = [y * Math.cos(ex) - z * Math.sin(ex), y * Math.sin(ex) + z * Math.cos(ex)]
  return [x, y, z]
}

/**
 * The eight corners of the model's bounding box, in the viewmodel camera's space (the camera looks
 * down -Z), with the rig at rest. Null for a weapon with no measured size.
 */
export function heldCorners(id: HeldWeaponId): Vec3[] | null {
  const size = itemSizeM(id)
  if (!size) return null
  const grip: HeldGrip = HELD_GRIPS[id]
  const corners: Vec3[] = []
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        const local: Vec3 = [
          sx * size[0] * grip.scale,
          sy * size[1] * grip.scale,
          sz * size[2] * grip.scale,
        ]
        const turned = rotate(local, grip.rotation)
        const inHeld: Vec3 = [
          turned[0] + grip.position[0],
          turned[1] + grip.position[1],
          turned[2] + grip.position[2],
        ]
        const r = rotate(inHeld, HELD_ORIGIN.rotation)
        corners.push([
          r[0] + HELD_ORIGIN.position[0],
          r[1] + HELD_ORIGIN.position[1],
          r[2] + HELD_ORIGIN.position[2],
        ])
      }
  return corners
}

/** Distance of the nearest point of the model's box in front of the camera (positive is in front). */
export function nearestClearanceM(id: HeldWeaponId): number | null {
  const corners = heldCorners(id)
  return corners ? Math.min(...corners.map((c) => -c[2])) : null
}
