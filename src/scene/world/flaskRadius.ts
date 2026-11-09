// Pure helper: the flask's splash radius including Blessed Reach (Req 1.8).
// The same value drives the damage area and the flash visual, so they cannot disagree.
import { WEAPON_MAP } from '../../data/weapons'

export function flaskSplashRadius(radiusBonusM: number): number {
  return (WEAPON_MAP['holy-water-flask'].radius ?? 0) + Math.max(0, radiusBonusM)
}
