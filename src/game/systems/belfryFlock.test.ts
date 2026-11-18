import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { BAT } from '../../data/bats'
import {
  flockActive,
  flockCount,
  flockEffects,
  flockGlow,
  flockSeeds,
  frameAverageMs,
  pushFrame,
  shouldStartFlock,
} from './belfryFlock'

const F = BAT.belfryFlock
const PHASES = ['day', 'dusk', 'night', 'dawn'] as const

describe('belfry flock', () => {
  it('starts at dusk with fast frames and not otherwise', () => {
    const frames = Array(60).fill(10)
    expect(shouldStartFlock({ phase: 'dusk', frames, active: false })).toBe(true)
    expect(shouldStartFlock({ phase: 'night', frames, active: false })).toBe(false)
    expect(shouldStartFlock({ phase: 'dusk', frames, active: true })).toBe(false)
  })

  it('is skipped when the 60 frame average is above 22 ms, kept at exactly 22', () => {
    expect(shouldStartFlock({ phase: 'dusk', frames: Array(60).fill(22.5), active: false })).toBe(false)
    expect(shouldStartFlock({ phase: 'dusk', frames: Array(60).fill(22), active: false })).toBe(true)
  })

  it('rolls a window of 60 frames', () => {
    let w: number[] = []
    for (let i = 0; i < 100; i++) w = pushFrame(w, i)
    expect(w).toHaveLength(F.frameWindow)
    expect(w[0]).toBe(40)
    expect(frameAverageMs([])).toBe(0)
  })

  it('stops flying at maxS', () => {
    expect(flockActive(0)).toBe(true)
    expect(flockActive(F.maxS - 0.01)).toBe(true)
    expect(flockActive(F.maxS)).toBe(false)
  })

  it('never shakes the camera and goes steady with Flashing lights off', () => {
    expect(flockEffects({ cameraShake: false, flashingLights: false })).toEqual({ cameraShake: false, pulsingGlow: false })
    expect(flockGlow(0.01, false)).toBe(flockGlow(3.3, false))
    expect(flockGlow(0.01, true)).not.toBe(flockGlow(0.05, true))
  })

  it('capacity covers the largest flock', () => {
    expect(F.capacity).toBeGreaterThanOrEqual(F.max)
  })

  // Feature: 11-horror-pass, Property 31: Belfry flock count, gating and glow
  it('count stays in range, the gate follows the average, and glow stays in range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.array(fc.double({ min: 1, max: 60, noNaN: true }), { maxLength: 120 }),
        fc.constantFrom(...PHASES),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.boolean(),
        (roll, times, phase, age, flashing) => {
          const n = flockCount(roll)
          expect(n).toBeGreaterThanOrEqual(F.min)
          expect(n).toBeLessThanOrEqual(F.max)
          let w: number[] = []
          for (const t of times) w = pushFrame(w, t)
          expect(w.length).toBeLessThanOrEqual(F.frameWindow)
          const start = shouldStartFlock({ phase, frames: w, active: false })
          expect(start).toBe(phase === 'dusk' && frameAverageMs(w) <= F.frameBudgetMs)
          const g = flockGlow(age, flashing)
          expect(g).toBeGreaterThanOrEqual(F.glowPulseMin - 1e-9)
          expect(g).toBeLessThanOrEqual(F.glowPulseMax + 1e-9)
          expect(flockSeeds(n, () => roll)).toHaveLength(n)
        },
      ),
      { numRuns: 100 },
    )
  })
})
