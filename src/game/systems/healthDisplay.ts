// Pure model of the health bar animation (design bible §11). The component runs this
// in a rAF loop; nothing here touches React, three.js or the clock.

import { HEALTH_BAR } from '../../data/healthBar'

export interface HealthDisplayState {
  /** Sanitised target HP and max HP from the last step. */
  hp: number
  maxHp: number
  /** Shown values, in HP units. `chunk >= fill` always. */
  fill: number
  chunk: number
  /** Seconds the pale chunk still waits before it drains. */
  holdLeft: number
  drainFrom: number
  drainT: number
  easeFrom: number
  easeT: number
  fx: 'none' | 'flash' | 'thick'
  fxLeft: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

// Bad input must never reach the bar: non-finite or negative becomes 0, too large caps at max.
const sanitizeMax = (maxHp: number): number => (Number.isFinite(maxHp) ? Math.max(1, maxHp) : 1)
const sanitizeHp = (hp: number, maxHp: number): number =>
  Number.isFinite(hp) ? clamp(hp, 0, maxHp) : 0

export const initHealthDisplay = (hp: number, maxHp: number): HealthDisplayState => {
  const max = sanitizeMax(maxHp)
  const h = sanitizeHp(hp, max)
  return {
    hp: h,
    maxHp: max,
    fill: h,
    chunk: h,
    holdLeft: 0,
    drainFrom: h,
    drainT: 0,
    easeFrom: h,
    easeT: HEALTH_BAR.easeS,
    fx: 'none',
    fxLeft: 0,
  }
}

export const stepHealthDisplay = (
  s: HealthDisplayState,
  input: { hp: number; maxHp: number },
  flashing: boolean,
  dtS: number,
): HealthDisplayState => {
  const dt = Number.isFinite(dtS) && dtS > 0 ? dtS : 0
  const maxHp = sanitizeMax(input.maxHp)
  const hp = sanitizeHp(input.hp, maxHp)

  let { fill, chunk, holdLeft, drainFrom, drainT, easeFrom, easeT, fx, fxLeft } = s

  if (maxHp !== s.maxHp) {
    // A max change re-clamps everything in the same frame (Iron Constitution heals too).
    fill = hp
    chunk = Math.max(Math.min(chunk, maxHp), fill)
    drainFrom = Math.min(drainFrom, maxHp)
    easeFrom = fill
    easeT = HEALTH_BAR.easeS
  } else if (hp < fill) {
    // Damage: the red fill drops at once, the pale chunk keeps the highest value still shown.
    chunk = Math.max(chunk, fill)
    fill = hp
    holdLeft = HEALTH_BAR.holdS
    drainFrom = chunk
    drainT = 0
    easeFrom = fill
    easeT = HEALTH_BAR.easeS
    fx = flashing ? 'flash' : 'thick'
    fxLeft = flashing ? HEALTH_BAR.flashS : HEALTH_BAR.thickenS
  } else if (hp !== s.hp && hp > fill) {
    // Heal (or a retargeted heal): ease up from what is shown now.
    easeFrom = fill
    easeT = 0
  }

  // Ease the fill toward hp.
  if (easeT < HEALTH_BAR.easeS) {
    easeT = Math.min(HEALTH_BAR.easeS, easeT + dt)
    fill =
      easeT >= HEALTH_BAR.easeS
        ? hp
        : easeFrom + (hp - easeFrom) * (easeT / HEALTH_BAR.easeS)
  } else {
    fill = hp
  }

  // Hold, then drain the pale chunk down to the fill.
  let drainDt = dt
  if (holdLeft > 0) {
    const used = Math.min(holdLeft, dt)
    holdLeft -= used
    drainDt = dt - used
  }
  if (holdLeft <= 0 && chunk > fill) {
    drainT += drainDt
    const t = clamp(drainT / HEALTH_BAR.drainS, 0, 1)
    chunk = t >= 1 ? fill : drainFrom + (fill - drainFrom) * t
  } else if (chunk <= fill) {
    drainT = 0
    drainFrom = fill
  }
  chunk = Math.max(chunk, fill)

  if (fx !== 'none') {
    fxLeft -= dt
    if (fxLeft <= 0) {
      fx = 'none'
      fxLeft = 0
    }
  }

  return {
    hp,
    maxHp,
    fill,
    chunk,
    holdLeft,
    drainFrom,
    drainT,
    easeFrom,
    easeT,
    fx,
    fxLeft,
  }
}

export const healthFraction = (s: HealthDisplayState): number => clamp(s.fill / s.maxHp, 0, 1)

export const chunkFraction = (s: HealthDisplayState): number => clamp(s.chunk / s.maxHp, 0, 1)

export const healthText = (hp: number, maxHp: number): string => {
  const max = sanitizeMax(maxHp)
  return `${Math.round(sanitizeHp(hp, max))} / ${Math.round(max)}`
}

export const lowFrame = (
  hp: number,
  flashing: boolean,
): { low: boolean; pulse: boolean; thick: boolean } => {
  const low = (Number.isFinite(hp) ? Math.max(0, hp) : 0) < HEALTH_BAR.lowBelow
  return { low, pulse: low && flashing, thick: low && !flashing }
}
