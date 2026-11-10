// The loadout a retry starts with (spec 09, B2). Without it a retry restored the dusk exactly,
// low oil included, and a player could die over and over. Pure: no React / three.js.

import { LANTERN_MAX_FUEL, RETRY_MIN_FUEL } from '../../data/balance'

export interface RetryLoadout {
  fuel: number
  health: number
}

/**
 * Full health, and at least RETRY_MIN_FUEL oil (more is kept, up to the tank). A missing or
 * corrupt fuel value (NaN, Infinity, a string from an old snapshot) counts as empty.
 */
export function retryLoadout(fuel: unknown, maxHealth: number): RetryLoadout {
  const f = typeof fuel === 'number' && Number.isFinite(fuel) ? fuel : 0
  return {
    fuel: Math.min(LANTERN_MAX_FUEL, Math.max(RETRY_MIN_FUEL, f)),
    health: maxHealth,
  }
}
