// Wall probe for the enemy AI: a horizontal Rapier ray between two ground points.
// Kept apart from EnemyDirector so it can be tested against a real Rapier world.
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Vec2 } from '../../game/systems/combat'

/** Probes run at roughly knee height so low headstones still count. */
export const PROBE_Y = 0.6
/** Probes stop short of their end point so the player's own capsule never reads as a wall. */
export const PROBE_END_MARGIN_M = 0.5

export function makeWallProbe(world: RAPIER.World, rapier: typeof RAPIER) {
  return (a: Vec2, b: Vec2): boolean => {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const full = Math.hypot(dx, dz)
    const len = full - PROBE_END_MARGIN_M
    if (len <= 0) return false
    const ray = new rapier.Ray({ x: a.x, y: PROBE_Y, z: a.z }, { x: dx / full, y: 0, z: dz / full })
    // Sensors (scare zones) are not walls. Without this, a zombie standing inside a sensor
    // hits it at distance 0 in every direction and holds position forever (the wg-west grave
    // sits inside the grounds-west-hill zone), so the night can never be cleared.
    return world.castRay(ray, len, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS) !== null
  }
}
