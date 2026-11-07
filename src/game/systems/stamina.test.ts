import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { tickStamina } from './stamina'
import type { StaminaState } from '../types'

const full: StaminaState = { stamina: 100, regenDelayTimer: 0 }

describe('tickStamina', () => {
  it('drains 20/s while sprinting and arms the 1 s delay', () => {
    const r = tickStamina(full, 1, true)
    expect(r.stamina).toBe(80)
    expect(r.regenDelayTimer).toBe(1)
  })
  it('does not regen during the first second after sprinting', () => {
    const r = tickStamina({ stamina: 50, regenDelayTimer: 1 }, 1, false)
    expect(r.stamina).toBe(50)
    expect(r.regenDelayTimer).toBe(0)
  })
  it('regens 15/s after the delay', () => {
    expect(tickStamina({ stamina: 50, regenDelayTimer: 0 }, 2, false).stamina).toBe(80)
  })
  it('clamps to [0, 100]', () => {
    expect(tickStamina({ stamina: 5, regenDelayTimer: 0 }, 10, true).stamina).toBe(0)
    expect(tickStamina({ stamina: 95, regenDelayTimer: 0 }, 10, false).stamina).toBe(100)
  })
})

describe('stamina properties', () => {
  it('stays in [0, 100] and ticks are step independent when not sprinting', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.boolean(),
        (stamina, timer, a, b, sprint) => {
          const s = { stamina, regenDelayTimer: timer }
          const two = tickStamina(tickStamina(s, a, sprint), b, sprint)
          const one = tickStamina(s, a + b, sprint)
          expect(one.stamina).toBeGreaterThanOrEqual(0)
          expect(one.stamina).toBeLessThanOrEqual(100)
          expect(two.stamina).toBeCloseTo(one.stamina, 6)
        },
      ),
    )
  })
})
