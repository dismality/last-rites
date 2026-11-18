import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { STRANGE_NOISES, STRANGE_TIMING } from '../../data/strangeNoises'
import { createRng } from '../rng'
import { createStrangeClock, pickStrangeNoise, stepStrangeNoises, strangeGap } from './strangeNoises'
import type { Phase } from '../types'

const phases: Phase[] = ['day', 'dusk', 'night', 'dawn']

describe('strange noises', () => {
  it('stays quiet until the first gap, then plays one and waits a full gap', () => {
    const rand = createRng(1)
    let clock = createStrangeClock()
    let r = stepStrangeNoises(clock, STRANGE_TIMING.firstAfterS - 1, 'night', true, rand)
    expect(r.cue).toBeNull()
    clock = r.clock
    r = stepStrangeNoises(clock, 2, 'night', true, rand)
    expect(r.cue).not.toBeNull()
    expect(r.clock.nextIn).toBeGreaterThanOrEqual(STRANGE_TIMING.gapS.min)
    expect(r.clock.nextIn).toBeLessThanOrEqual(STRANGE_TIMING.gapS.max)
  })

  it('never plays the same noise twice running, and keeps distances in range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...phases), (seed, phase) => {
        const rand = createRng(seed)
        let clock = createStrangeClock()
        let last: string | null = null
        for (let i = 0; i < 40; i++) {
          const r = stepStrangeNoises(clock, 400, phase, true, rand)
          clock = r.clock
          if (!r.cue) continue
          expect(r.cue.noise.id).not.toBe(last)
          last = r.cue.noise.id
          if (r.cue.noise.near) expect(r.cue.distanceM).toBe(STRANGE_TIMING.nearDistanceM)
          else {
            expect(r.cue.distanceM).toBeGreaterThanOrEqual(STRANGE_TIMING.distanceM.min)
            expect(r.cue.distanceM).toBeLessThanOrEqual(STRANGE_TIMING.distanceM.max)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('plays nothing with the setting at 0, but the clock still runs', () => {
    const rand = createRng(3)
    const r = stepStrangeNoises(createStrangeClock(), STRANGE_TIMING.firstAfterS + 1, 'night', false, rand)
    expect(r.cue).toBeNull()
    expect(r.clock.nextIn).toBeGreaterThan(0)
  })

  it('waits longer by day, and every noise can be picked', () => {
    const rand = createRng(5)
    for (let i = 0; i < 50; i++) expect(strangeGap('day', rand)).toBeGreaterThanOrEqual(STRANGE_TIMING.gapS.min * STRANGE_TIMING.dayGapMult)
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) seen.add(pickStrangeNoise(null, rand).id)
    expect(seen.size).toBe(STRANGE_NOISES.length)
  })

  it('ignores a bad dt', () => {
    const c = createStrangeClock()
    expect(stepStrangeNoises(c, Number.NaN, 'night', true, Math.random).clock).toBe(c)
  })
})
