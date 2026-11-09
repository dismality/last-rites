// Shot occlusion: a Rapier ray that tells ballistics how far a shot travels before a wall.
// Kept apart from the firing driver so it can be tested against a real Rapier world.
import type RAPIER from '@dimforge/rapier3d-compat'
import type { WallDistance } from '../../game/systems/ballistics'

export function makeWallDistance(world: RAPIER.World, rapier: typeof RAPIER): WallDistance {
  // Sensors (scare zones) are not walls, and the kinematic player body must never
  // block its own shot; without these, a shot fired inside a zone would stop at 0 m.
  const flags = rapier.QueryFilterFlags.EXCLUDE_SENSORS | rapier.QueryFilterFlags.EXCLUDE_KINEMATIC
  return (origin, dir, maxM) => {
    try {
      const len = Math.hypot(dir.x, dir.y, dir.z)
      if (!(len > 0) || !(maxM > 0)) return Infinity
      const ray = new rapier.Ray(origin, { x: dir.x / len, y: dir.y / len, z: dir.z / len })
      const hit = world.castRay(ray, maxM, true, flags)
      return hit ? hit.timeOfImpact : Infinity
    } catch {
      // A failed query must never block a shot.
      return Infinity
    }
  }
}
