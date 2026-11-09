import { LANTERN_FLICKER_BELOW, LANTERN_MAX_FUEL } from '../../data/balance'

// Fuel is the only input to the flame, so health can never leak into it (Req 2.1, 2.10).
const FLAME_SIZE_MIN = 0.12
const FLAME_BRIGHTNESS_MIN = 0.2
const GUTTER_PERIOD_S = 0.9
const GUTTER_DEPTH = 0.35

/** Non-finite fuel reads as empty; everything else is clamped to the tank. */
const fuelFraction = (fuel: number): number => {
  if (!Number.isFinite(fuel)) return 0
  return Math.min(1, Math.max(0, fuel / LANTERN_MAX_FUEL))
}

export const flameSize = (fuel: number): number =>
  FLAME_SIZE_MIN + (1 - FLAME_SIZE_MIN) * fuelFraction(fuel)

export const flameBrightness = (fuel: number): number =>
  FLAME_BRIGHTNESS_MIN + (1 - FLAME_BRIGHTNESS_MIN) * fuelFraction(fuel)

const isLow = (fuel: number): boolean => !Number.isFinite(fuel) || fuel < LANTERN_FLICKER_BELOW

export const oilLabel = (fuel: number): string =>
  isLow(fuel) ? 'Low oil' : `Oil ${Math.round(Math.min(LANTERN_MAX_FUEL, fuel))}%`

/**
 * Brightness multiplier for the gutter. Constant 1 unless fuel is low and
 * flashing lights are allowed, so "off" holds the flame steady (Req 2.7, 10.1).
 */
export const gutterActive = (fuel: number, flashing: boolean): boolean => flashing && isLow(fuel)

export const gutterFactor = (tS: number, fuel: number, flashing: boolean): number => {
  if (!flashing || !isLow(fuel)) return 1
  const t = Number.isFinite(tS) ? tS : 0
  const wave = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / GUTTER_PERIOD_S)
  return 1 - GUTTER_DEPTH * wave
}
