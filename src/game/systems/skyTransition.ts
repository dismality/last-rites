// Pure helpers for blending the sky look between phases. No three.js imports so they run in Node tests.

import { SKY_LOOKS, SKY_TRANSITION_S } from '../../data/skyPalette'
import type { Phase } from '../types'

export type Rgb = readonly [number, number, number]

export interface SkyBlend {
  sky: Rgb
  ambientColor: Rgb
  ambientIntensity: number
  moonIntensity: number
  fogDensity: number
}

export function lerp(a: number, b: number, k: number): number {
  // Exact at k=0 and k=1 (a + (b-a)*k is not, due to float rounding).
  return a * (1 - k) + b * k
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function lerpRgb(a: Rgb, b: Rgb, k: number): Rgb {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
}

/** Blend progress in [0, 1] after `elapsed` seconds. */
export function transitionProgress(elapsed: number, duration = SKY_TRANSITION_S): number {
  return Math.min(Math.max(elapsed / duration, 0), 1)
}

export function lerpBlend(a: SkyBlend, b: SkyBlend, k: number): SkyBlend {
  return {
    sky: lerpRgb(a.sky, b.sky, k),
    ambientColor: lerpRgb(a.ambientColor, b.ambientColor, k),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, k),
    moonIntensity: lerp(a.moonIntensity, b.moonIntensity, k),
    fogDensity: lerp(a.fogDensity, b.fogDensity, k),
  }
}

export function targetBlend(phase: Phase, fogDensity: number): SkyBlend {
  const look = SKY_LOOKS[phase]
  return {
    sky: hexToRgb(look.sky),
    ambientColor: hexToRgb(look.ambientColor),
    ambientIntensity: look.ambientIntensity,
    moonIntensity: look.moonIntensity,
    fogDensity,
  }
}
