// Pure zone lookup: which named zone a ground position is in (Req 7.1, 7.2).

import { ZONE_BOUNDS, type ZoneId } from '../../data/zones'

/**
 * First matching rectangle wins (bounds are ordered); `grounds` is the fallback so the
 * lookup is total, including for non-finite input.
 */
export const zoneAt = (x: number, z: number, bounds = ZONE_BOUNDS): ZoneId => {
  for (const { zone, rect } of bounds) {
    if (x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) return zone
  }
  return 'grounds'
}
