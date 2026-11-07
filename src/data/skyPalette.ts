// Sky / light targets per phase. Values are visual-tuning knobs, not game rules.

import type { Phase } from '../game/types'

/** Seconds to blend from one phase's look to the next. */
export const SKY_TRANSITION_S = 5

export interface SkyLook {
  sky: string
  ambientColor: string
  ambientIntensity: number
  /** Directional moonlight; never casts shadows (shadow budget: 4 lights, lantern is one). */
  moonIntensity: number
}

export const SKY_LOOKS: Readonly<Record<Phase, SkyLook>> = {
  day: { sky: '#6a7d8f', ambientColor: '#b8c4d0', ambientIntensity: 0.9, moonIntensity: 0.3 },
  dusk: { sky: '#8b3a1f', ambientColor: '#c07a58', ambientIntensity: 0.45, moonIntensity: 0.2 },
  // Night keeps a faint rim so the path never goes fully black (horror-design rule).
  night: { sky: '#0a0c12', ambientColor: '#4a5a80', ambientIntensity: 0.12, moonIntensity: 0.25 },
  dawn: { sky: '#4a5560', ambientColor: '#8a95a5', ambientIntensity: 0.4, moonIntensity: 0.2 },
}

export const MOON_COLOR = '#9db4ff'
export const MOON_POSITION: readonly [number, number, number] = [-30, 50, -20]
