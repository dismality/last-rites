import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { STAMINA_MAX } from '../../data/balance'
import { capFraction, clampToCap, staminaCap, staminaDrainMult } from './staminaCap'
import { tickStamina } from './stamina'

describe('staminaCap (Req 26.1)', () => {
  it('100, 90 and 80 in Stages 1 to 3; Endless keeps 100', () => {
    expect([1, 2, 3].map((s) => staminaCap(s as 1 | 2 | 3, true))).toEqual([100, 90, 80])
    expect(staminaCap(3, false)).toBe(STAMINA_MAX)
  })
})

describe('staminaDrainMult (Req 26.2)', () => {
  it('Easy 0.8, Normal 1, Hard 1.2; Endless and Short Vigil 1', () => {
    expect(staminaDrainMult('easy')).toBe(0.8)
    expect(staminaDrainMult('normal')).toBe(1)
    expect(staminaDrainMult('hard')).toBe(1.2)
    expect(staminaDrainMult('endless')).toBe(1)
    expect(staminaDrainMult('short-vigil')).toBe(1)
  })
  it('Hard empties the bar sooner than Easy', () => {
    const run = (mult: number) => tickStamina({ stamina: 100, regenDelayTimer: 0 }, 1, true, mult).stamina
    expect(run(staminaDrainMult('hard'))).toBeLessThan(run(staminaDrainMult('easy')))
  })
})

describe('clampToCap and capFraction', () => {
  it('lowers stamina to a smaller cap and keeps it at or above 0', () => {
    expect(clampToCap(100, 90)).toBe(90)
    expect(clampToCap(-3, 90)).toBe(0)
    expect(clampToCap(Number.NaN, 90)).toBe(0)
    expect(capFraction(45, 90)).toBe(0.5)
    expect(capFraction(120, 80)).toBe(1)
  })
})

describe('Property 22: Stamina never exceeds a cap that never rises', () => {
  // Validates Req 26.1, 26.3, 26.4. Stages only move forward in a run, so the sequence is sorted.
  it('for any run of stages and sprint/rest ticks', () => {
    const step = fc.record({
      stageUp: fc.boolean(),
      dt: fc.double({ min: 0, max: 2, noNaN: true }),
      sprint: fc.boolean(),
      drain: fc.constantFrom(0.8, 1, 1.2),
      regen: fc.double({ min: 0.5, max: 2, noNaN: true }),
    })
    fc.assert(
      fc.property(fc.array(step, { maxLength: 60 }), fc.boolean(), (steps, story) => {
        let stage: 1 | 2 | 3 = 1
        let s = { stamina: STAMINA_MAX, regenDelayTimer: 0 }
        let lastCap = staminaCap(stage, story)
        for (const st of steps) {
          if (st.stageUp && stage < 3) stage = (stage + 1) as 1 | 2 | 3
          const cap = staminaCap(stage, story)
          expect(cap).toBeLessThanOrEqual(lastCap)
          lastCap = cap
          s = tickStamina(s, st.dt, st.sprint, st.drain, st.regen, cap)
          expect(s.stamina).toBeLessThanOrEqual(cap)
          expect(s.stamina).toBeGreaterThanOrEqual(0)
        }
      }),
    )
  })
})
