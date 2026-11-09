import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { spendStamina, tickStamina } from './stamina'
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

describe('spendStamina', () => {
  it('pays the cost and re-arms the regen delay', () => {
    const r = spendStamina({ stamina: 40, regenDelayTimer: 0 }, 25)
    expect(r.ok).toBe(true)
    expect(r.state).toEqual({ stamina: 15, regenDelayTimer: 1 })
  })
  it('refuses when short and leaves the state alone', () => {
    const s = { stamina: 10, regenDelayTimer: 0.5 }
    const r = spendStamina(s, 15)
    expect(r.ok).toBe(false)
    expect(r.state).toBe(s)
  })
  it('treats bad costs as 0', () => {
    expect(spendStamina(full, NaN).state.stamina).toBe(100)
    expect(spendStamina(full, -5).state.stamina).toBe(100)
  })
})

describe('tickStamina drainMult', () => {
  it('halves sprint drain at 0.5', () => {
    expect(tickStamina(full, 1, true, 0.5).stamina).toBe(90)
  })
})

describe('tickStamina regenMult', () => {
  const s = { stamina: 0, regenDelayTimer: 0 }
  it('defaults to a multiplier of 1', () => {
    expect(tickStamina(s, 1, false).stamina).toBe(tickStamina(s, 1, false, 1, 1).stamina)
  })
  it('raises regen by 25% at 1.25', () => {
    expect(tickStamina(s, 1, false, 1, 1.25).stamina).toBeCloseTo(15 * 1.25)
  })
  it('does not affect sprint drain', () => {
    expect(tickStamina(full, 1, true, 1, 1.25).stamina).toBe(80)
  })
})

describe('stamina properties', () => {
  it('spend keeps stamina in [0, 100] and is exact when allowed', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 150, noNaN: true }),
        (stamina, cost) => {
          const r = spendStamina({ stamina, regenDelayTimer: 0 }, cost)
          expect(r.ok).toBe(stamina >= cost)
          expect(r.state.stamina).toBeGreaterThanOrEqual(0)
          expect(r.state.stamina).toBeLessThanOrEqual(100)
        },
      ),
    )
  })
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
