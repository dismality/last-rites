// Lantern flicker (spec 11 H7, Req 7.11 to 7.14, 2.16). The signal is a multiplier of the base
// light, a pure function of time and a seed (hashed value noise, no Math.random), so the flame,
// the glass and the light all read the same number in the same frame and tests can sample it.
import { LANTERN_FLICKER as F, LANTERN_LIGHT as L } from '../../data/lanternLight'

export interface FlickerInputs {
  /** Lantern oil, percent. */
  oil: number
  sprinting: boolean
  /** A gust of wind is on the lantern. */
  gust: boolean
  flashingLights: boolean
  seed?: number
}

export interface FlickerParams {
  seed: number
  oil: number
  breathHz: readonly [number, number]
  gutterHz: number
  gutterAmp: number
  /** Flashing lights off: breathing and one slow dip only. */
  lowPass: boolean
  /** Hex colour of the light. */
  color: string
}

const TAU = Math.PI * 2
/** Bit offsets of the red and green bytes in a packed hex colour. */
const RED_SHIFT = 16
const HEX_RADIX = 16
const GREEN_SHIFT = 8
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Integer hash to [0, 1]. */
function hash01(i: number, seed: number): number {
  let x = Math.imul(i | 0, 374761393) + Math.imul(seed | 0, 668265263)
  x = Math.imul(x ^ (x >>> F.hashShiftMid), 1274126177)
  return ((x ^ (x >>> F.hashShiftEnd)) >>> 0) / 4294967295
}

/** Smooth 1-D value noise in [-1, 1]. */
function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = hash01(i, seed) * 2 - 1
  const b = hash01(i + 1, seed) * 2 - 1
  return a + (b - a) * u
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), HEX_RADIX)
  return [(n >> RED_SHIFT) & 255, (n >> GREEN_SHIFT) & 255, n & 255]
}

function rgbToHex(c: readonly [number, number, number]): string {
  return '#' + c.map((v) => Math.round(v).toString(HEX_RADIX).padStart(2, '0')).join('')
}

/** Redder as oil falls under the low threshold; the base colour at or above it. */
function lanternColor(oil: number): string {
  const k = clamp(oil / L.lowOilBelow, 0, 1)
  const base = hexToRgb(L.color)
  const low = hexToRgb(L.lowOilColor)
  return rgbToHex([0, 1, 2].map((i) => low[i] + (base[i] - low[i]) * k) as [number, number, number])
}

export function flickerParams(i: FlickerInputs): FlickerParams {
  const seed = i.seed ?? 1
  const oil = clamp(Number.isFinite(i.oil) ? i.oil : 0, 0, 100)
  let gutterAmp = F.gutterAmp
  if (oil < L.lowOilBelow) gutterAmp *= L.lowOilGutterMult
  if (i.sprinting || i.gust) gutterAmp *= L.moveGutterMult
  const [b0, b1] = L.breathHz
  const [g0, g1] = L.gutterHz
  return {
    seed,
    oil,
    breathHz: [b0 + (b1 - b0) * hash01(1, seed), b0 + (b1 - b0) * hash01(2, seed)],
    gutterHz: g0 + (g1 - g0) * hash01(3, seed),
    gutterAmp,
    lowPass: !i.flashingLights,
    color: lanternColor(oil),
  }
}

function breath(t: number, p: FlickerParams): number {
  const ph1 = hash01(4, p.seed) * TAU
  const ph2 = hash01(5, p.seed) * TAU
  const [w0, w1] = F.breathWeights
  return w0 * Math.sin(TAU * p.breathHz[0] * t + ph1) + w1 * Math.sin(TAU * p.breathHz[1] * t + ph2)
}

/** Occasional short dips of up to `dipMax`, one chance per cell. */
function dip(t: number, seed: number): number {
  const cell = Math.floor(t / F.dipCellS)
  if (hash01(cell, seed + F.dipSeedChance) >= F.dipChance) return 0
  const start = hash01(cell, seed + F.dipSeedStart) * (F.dipCellS - F.dipLenS) + cell * F.dipCellS
  const k = (t - start) / F.dipLenS
  if (k < 0 || k > 1) return 0
  const depth =
    L.dipMax * (F.dipDepthFloor + (1 - F.dipDepthFloor) * hash01(cell, seed + F.dipSeedDepth))
  return depth * Math.sin(Math.PI * k) ** 2
}

/** One slow dip below 1 Hz for Flashing lights off. */
function slowDip(t: number, seed: number): number {
  const s = Math.sin(TAU * F.slowDipHz * t + hash01(6, seed) * TAU)
  return F.slowDipDepth * Math.max(0, s) ** 2
}

/** The light multiplier at time `t`, always in [minMult, maxMult] and finite. */
export function flickerSignal(t: number, p: FlickerParams): number {
  const time = Number.isFinite(t) ? t : 0
  let m = 1 + F.breathAmp * breath(time, p)
  if (p.lowPass) {
    m -= slowDip(time, p.seed)
  } else {
    m += p.gutterAmp * valueNoise(time * p.gutterHz, p.seed + 7)
    m -= dip(time, p.seed)
  }
  return clamp(m, F.minMult, F.maxMult)
}

/**
 * The single flare when oil reaches 0: a brief boost over `flareS`, then 0. Returns null before
 * the oil ran out (`ageS` < 0). `ageS` is seconds since oil hit 0.
 */
export function lastFlare(ageS: number): number | null {
  if (ageS < 0) return null
  if (ageS >= L.flareS) return 0
  return 1 + F.flareBoost * Math.sin((Math.PI * ageS) / L.flareS)
}

/**
 * The final multiplier. `zeroAgeS` is seconds since oil hit 0 (null while there is oil). At oil 0
 * the flare plays once and the light is off after it; with Flashing lights off the flare becomes a
 * slow fade instead.
 */
export function flickerIntensity(t: number, p: FlickerParams, zeroAgeS: number | null): number {
  if (zeroAgeS === null || zeroAgeS < 0) return flickerSignal(t, p)
  if (p.lowPass) {
    const k = clamp(zeroAgeS / F.fadeOutS, 0, 1)
    return flickerSignal(t, p) * (0.5 + 0.5 * Math.cos(Math.PI * k))
  }
  return lastFlare(zeroAgeS) ?? 0
}

/** Flame scale from the signal; 0 when the light is out. */
export function signalToFlame(m: number): number {
  return m > 0 ? F.flameBase * m : 0
}

/** Glass emissive from the same signal; 0 when the light is out. */
export function signalToGlass(m: number): number {
  return m > 0 ? F.glassBase * m : 0
}

/** The light multiplier from a Hollow Bride: 0.7 within 8 m, 1 otherwise. */
export function brideDimFor(distanceM: number): number {
  return distanceM <= F.brideRangeM ? 1 - L.brideDim : 1
}

/**
 * Moves the dim towards its target. With Flashing lights on it jumps; off, it changes by at most
 * `brideSlewPerS` per second so there is no sudden drop.
 */
export function stepBrideDim(
  current: number,
  distanceM: number,
  dt: number,
  flashingLights: boolean,
): number {
  const target = brideDimFor(distanceM)
  if (flashingLights) return target
  const maxStep = F.brideSlewPerS * Math.max(0, dt)
  return current + clamp(target - current, -maxStep, maxStep)
}
