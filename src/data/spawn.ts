// Where a new run starts and which way the keeper faces (spec 09, B5).
// Objective 1 is the page on the hut's side table, so the first view looks at it, not the bench.
// yaw 0 looks along -Z; forward is (-sin yaw, -cos yaw).

import type { Vec3 } from './cemeteryLayout'
import { FIXED_SPAWNS } from './zones'

/** Feet position at the start of a run. */
export const SPAWN_FEET: Vec3 = [0, 0.05, 0]

const page = FIXED_SPAWNS.find((f) => f.id === 'fx-page-1')!.position

/** Yaw from the spawn toward journal page 1 on the side table. */
export const SPAWN_YAW = Math.atan2(-(page[0] - SPAWN_FEET[0]), -(page[2] - SPAWN_FEET[2]))
