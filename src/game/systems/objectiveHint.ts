// Near / far hint rule (spec 09 task 11o). Pure: the caller keeps the previous answer.
// A hint is "near" within HINT_NEAR_M of its target and in the same building, and stays near
// until the player is past HINT_FAR_M or in another building (hysteresis, so no flicker).

import { HINT_FAR_M, HINT_NEAR_M, type HintPlace } from '../../data/objectiveHints'
import {
  BENCH_Z,
  CATACOMBS,
  CHAPEL,
  CHAPEL_CENTER,
  isInsideHut,
  type Vec3,
} from '../../data/cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from '../../data/zones'

export type BuildingId = 'outside' | 'hut' | 'chapel' | 'catacombs'

/** Which roofed place a ground point is in; everything else is the open grounds. */
export const buildingAt = (x: number, z: number): BuildingId => {
  if (isInsideHut(x, z)) return 'hut'
  if (
    Math.abs(x - CHAPEL_CENTER[0]) < CHAPEL.halfX &&
    Math.abs(z - CHAPEL_CENTER[2]) < CHAPEL.halfZ
  )
    return 'chapel'
  // The catacombs run from the grounds fence line out along +Z.
  const c = CATACOMBS
  if (Math.abs(x - c.centerX) < c.width / 2 && z > c.entranceZ && z < c.entranceZ + c.length)
    return 'catacombs'
  return 'outside'
}

interface Point {
  readonly x: number
  readonly z: number
}

/** The near/far state for this frame, given last frame's answer. Non-finite input reads as far. */
export const hintNear = (wasNear: boolean, player: Point, target: Point): boolean => {
  const d = Math.hypot(player.x - target.x, player.z - target.z)
  if (!Number.isFinite(d)) return false
  if (buildingAt(player.x, player.z) !== buildingAt(target.x, target.z)) return false
  return wasNear ? d < HINT_FAR_M : d < HINT_NEAR_M
}

/** World position of a hint place, or undefined when the data has no such row. */
export const hintPlacePosition = (place: HintPlace): Vec3 | undefined => {
  switch (place.kind) {
    case 'spawn-point':
      return SPAWN_POINTS.find((p) => p.id === place.id)?.position
    case 'fixed-spawn':
      return FIXED_SPAWNS.find((p) => p.id === place.id)?.position
    case 'workbench':
      return [0, 0, BENCH_Z]
  }
}
