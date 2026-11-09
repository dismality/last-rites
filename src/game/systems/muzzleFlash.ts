// Muzzle flash profile. With Flashing lights off it is a slow, dim sine arc with no light pop.
import { MUZZLE } from '../../data/combatFeedback'

export interface MuzzleProfile {
  durationS: number
  peak: number
  light: boolean
}

export const muzzleProfile = (flashing: boolean): MuzzleProfile =>
  flashing ? MUZZLE.flashingOn : MUZZLE.flashingOff

/** Linear decay when flashing; a sine arc (rise then fall) when not, so it never snaps. */
export function muzzleOpacity(p: MuzzleProfile, ageS: number): number {
  if (!(ageS >= 0) || ageS >= p.durationS) return 0
  const t = ageS / p.durationS
  return p.light ? p.peak * (1 - t) : p.peak * Math.sin(Math.PI * t)
}
