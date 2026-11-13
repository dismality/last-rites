// Interior fog (spec 09 task 11n-a, "Realism"): inside the chapel the fog is denser and warmer, so
// the far end of the room falls into darkness instead of showing the open-air haze. Pure: the
// scene eases `amount` toward 1 inside and 0 outside, and asks for the look at that amount.

import { ZONE_BOUNDS } from '../../data/zones'

export const INTERIOR_FOG = {
  /** Fog density multiplier at full effect. */
  densityScale: 2.4,
  /** How far the fog colour moves toward the warm tint at full effect (0..1). */
  tintMix: 0.55,
  /** Warm, dark candle-smoke brown (sRGB 0..1). */
  tint: [0.1, 0.06, 0.035] as readonly [number, number, number],
  /** Easing speed: about 0.4 s to cross a doorway. */
  easePerS: 2.5,
} as const

type Rgb = readonly [number, number, number]

/** Interiors that use the dense warm fog. The hut and catacombs join in their own scenery steps. */
const INTERIOR_ZONES: readonly string[] = ['chapel']

/** True when the point stands inside an interior zone (walls included). */
export function isInterior(x: number, z: number): boolean {
  return ZONE_BOUNDS.some(
    (b) =>
      INTERIOR_ZONES.includes(b.zone) &&
      x >= b.rect.minX &&
      x <= b.rect.maxX &&
      z >= b.rect.minZ &&
      z <= b.rect.maxZ,
  )
}

/** Moves `amount` toward `target` (0 or 1) at the easing speed; never overshoots. */
export function easeInterior(amount: number, target: 0 | 1, dtS: number): number {
  const step = INTERIOR_FOG.easePerS * dtS
  return target > amount ? Math.min(target, amount + step) : Math.max(target, amount - step)
}

/** The fog at `amount` (0 = open air, 1 = fully inside). */
export function interiorFogLook(
  density: number,
  color: Rgb,
  amount: number,
  /** The tint in the same colour space as `color` (the scene passes it converted to linear). */
  tint: Rgb = INTERIOR_FOG.tint,
): { density: number; color: [number, number, number] } {
  const a = Math.min(1, Math.max(0, amount))
  const mix = INTERIOR_FOG.tintMix * a
  const [r, g, b] = tint
  return {
    density: density * (1 + (INTERIOR_FOG.densityScale - 1) * a),
    color: [color[0] + (r - color[0]) * mix, color[1] + (g - color[1]) * mix, color[2] + (b - color[2]) * mix],
  }
}
