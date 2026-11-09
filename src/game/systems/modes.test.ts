import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { endlessHpScale, lanternDrainMultiplier, spawnMultipliers } from './modes'
import { MODES } from '../../data/modes'
import type { ModeId } from '../types'

const mode = fc.constantFrom<ModeId>('easy', 'normal', 'hard', 'endless')

describe('Property 20: Mode multipliers match the table', () => {
  // **Validates: Requirements 7.3, 7.4, 7.5, 7.9, 10.5**
  it('non-elite spawns use the mode HP and damage, scaled in Endless after night 5', () => {
    fc.assert(
      fc.property(mode, fc.integer({ min: 1, max: 40 }), (m, night) => {
        const r = spawnMultipliers(m, night, false)
        const scale = m === 'endless' ? Math.pow(1.08, Math.max(0, night - 5)) : 1
        expect(r.hpMult).toBeCloseTo(MODES[m].hpMult * scale, 9)
        expect(r.damageMult).toBe(MODES[m].damageMult)
        expect(r.speedMult).toBe(1)
      }),
    )
  })

  it('elites compose the 07 multipliers on top', () => {
    fc.assert(
      fc.property(mode, fc.integer({ min: 1, max: 40 }), (m, night) => {
        const base = spawnMultipliers(m, night, false)
        const e = spawnMultipliers(m, night, true)
        expect(e.hpMult).toBeCloseTo(base.hpMult * 2, 9)
        expect(e.speedMult).toBeCloseTo(1.15, 9)
        expect(e.damageMult).toBeCloseTo(base.damageMult * 1.25, 9)
      }),
    )
  })

  it('lantern drain is mode × Long Wick × storm', () => {
    fc.assert(
      fc.property(mode, fc.integer({ min: 0, max: 2 }), fc.boolean(), (m, rank, storm) => {
        const expected = MODES[m].lanternDrainMult * (1 - 0.2 * rank) * (storm ? 1.2 : 1)
        expect(lanternDrainMultiplier(m, rank, storm)).toBeCloseTo(expected, 9)
      }),
    )
  })

  it('has no Endless scaling in story modes or up to night 5', () => {
    expect(endlessHpScale('hard', 30)).toBe(1)
    expect(endlessHpScale('endless', 5)).toBe(1)
    expect(endlessHpScale('endless', 6)).toBeCloseTo(1.08, 9)
  })
})
