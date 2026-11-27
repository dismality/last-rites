// Objective beacon rules: the amber light pillar and name label over the current objective's
// place. Pure: no React, three.js or stores.

import { isInsideHut } from '../../data/cemeteryLayout'
import type { Vec3 } from './objective'

/** Closer than this (m) the beacon is gone, so it never stands in the player's face. */
export const BEACON_HIDE_M = 2
/** From this far out (m) the beacon is fully shown. */
export const BEACON_FULL_M = 6

/** Beacon opacity factor 0..1 by flat distance to the objective. */
export function objectiveBeaconFade(distanceM: number): number {
  if (!Number.isFinite(distanceM)) return 1
  const t = (distanceM - BEACON_HIDE_M) / (BEACON_FULL_M - BEACON_HIDE_M)
  return Math.min(1, Math.max(0, t))
}

/** Flat (x/z) distance in metres from the player to a place. */
export function flatDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

/**
 * The label under the pillar: what the objective is and how far, e.g. "Ledger · 24 m". When the
 * hut wall stands between player and objective (like the compass's door rule) it says so:
 * "Page · in the hut · 25 m".
 */
export function objectiveBeaconLabel(marker: string | undefined, distanceM: number, inHut = false): string {
  const name = inHut ? `${marker ?? 'Objective'} · in the hut` : (marker ?? 'Objective')
  return Number.isFinite(distanceM) ? `${name} · ${Math.round(distanceM)} m` : name
}

/** The objective is inside the hut and the player is outside it. */
export function objectiveInHutFromOutside(player: Vec3, target: Vec3): boolean {
  return isInsideHut(target[0], target[2]) && !isInsideHut(player[0], player[2])
}
