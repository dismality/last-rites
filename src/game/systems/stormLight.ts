// Pure lightning and storm-fog maths for SkyAndFog (spec 08 Req 10.5, 10.7, 10.8, 12.6).
import { LIGHTNING, STORM } from '../../data/storms'
import { hexToRgb } from './skyTransition'
import type { Rgb } from './skyTransition'

/** Cold-white the sky and fog lerp toward at full flash. */
export const LIGHTNING_COLOR = '#d6e4ff'
/** Share of the way to LIGHTNING_COLOR at full flash. */
export const LIGHTNING_COLOR_MIX = 0.5

const clamp01 = (n: number): number => (n < 0 || Number.isNaN(n) ? 0 : n > 1 ? 1 : n)

/** Multiplier on an existing light: 1 at level 0, `boost` at level 1. The slow variant peaks at 0.3, so it never exceeds 30% of the boost. */
export function boostFactor(level: number, boost: number): number {
  return 1 + (boost - 1) * clamp01(level)
}

export function ambientFlashFactor(level: number): number {
  return boostFactor(level, LIGHTNING.ambientBoost)
}

export function moonFlashFactor(level: number): number {
  return boostFactor(level, LIGHTNING.moonBoost)
}

/** Lerp an sRGB colour toward the lightning colour; level 0 returns the input unchanged. */
export function flashTint(color: Rgb, level: number): Rgb {
  const t = clamp01(level) * LIGHTNING_COLOR_MIX
  const target = hexToRgb(LIGHTNING_COLOR)
  return [
    color[0] + (target[0] - color[0]) * t,
    color[1] + (target[1] - color[1]) * t,
    color[2] + (target[2] - color[2]) * t,
  ]
}

/** Rendered fog density: the world store's value plus the storm modifier. Never written back to the store. */
export function stormFogDensity(base: number, stormActive: boolean): number {
  return stormActive ? base + STORM.fogAdd : base
}
