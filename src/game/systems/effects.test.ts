// Tests for src/game/systems/effects.ts (Requirement 12).
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyEffect, tickEffects, effectMods, withSaltEffect, effectIcons } from './effects'
import type { ActiveEffect } from './effects'
import type { EffectId } from '../types'

const ids: EffectId[] = ['blessed-rounds', 'adrenaline', 'salt-circle']
const arbId = fc.constantFrom(...ids)

describe('effects', () => {
  it('applies with the full duration', () => {
    expect(applyEffect([], 'blessed-rounds')).toEqual([{ id: 'blessed-rounds', leftS: 30 }])
    expect(applyEffect([], 'adrenaline')).toEqual([{ id: 'adrenaline', leftS: 20 }])
  })

  it('refreshes instead of adding a second entry', () => {
    const list = tickEffects(applyEffect([], 'adrenaline'), 5)
    expect(applyEffect(list, 'adrenaline')).toEqual([{ id: 'adrenaline', leftS: 20 }])
  })

  it('removes an effect on the step it reaches 0 and mods revert', () => {
    const list = applyEffect([], 'adrenaline')
    const after = tickEffects(list, 20)
    expect(after).toEqual([])
    expect(effectMods(after)).toEqual({ firearmDamage: 1, moveSpeed: 1, sprintDrain: 1 })
  })

  it('mods: blessed doubles firearm damage only; adrenaline speed and drain', () => {
    expect(effectMods(applyEffect([], 'blessed-rounds'))).toEqual({ firearmDamage: 2, moveSpeed: 1, sprintDrain: 1 })
    expect(effectMods(applyEffect([], 'adrenaline'))).toEqual({ firearmDamage: 1, moveSpeed: 1.3, sprintDrain: 0.5 })
  })

  it('a zero or negative dt does not change time', () => {
    const list = applyEffect([], 'blessed-rounds')
    expect(tickEffects(list, 0)).toEqual(list)
    expect(tickEffects(list, -3)).toEqual(list)
  })

  it('salt entry shows the newest circle and is dropped with no circles', () => {
    const salts = [
      { id: 'a', pos: { x: 0, z: 0 }, remaining: 4 },
      { id: 'b', pos: { x: 1, z: 1 }, remaining: 22 },
    ]
    const withSalt = withSaltEffect([], salts)
    expect(withSalt).toEqual([{ id: 'salt-circle', leftS: 22 }])
    expect(withSaltEffect(withSalt, [])).toEqual([])
  })

  it('icons carry glyph, ring fraction and ceil seconds text, max 6', () => {
    const icons = effectIcons([{ id: 'blessed-rounds', leftS: 14.2 }])
    expect(icons).toHaveLength(1)
    expect(icons[0].glyph).toBe('✝')
    expect(icons[0].secondsText).toBe('15s')
    expect(icons[0].fraction).toBeCloseTo(14.2 / 30)
    const many: ActiveEffect[] = Array.from({ length: 9 }, () => ({ id: 'adrenaline', leftS: 1 }))
    expect(effectIcons(many).length).toBeLessThanOrEqual(6)
  })
})

// Feature: 07-combat-and-enemies, Property 21: Timed effects are unique, idempotent and non-increasing
describe('Property 21: Timed effects are unique, idempotent and non-increasing', () => {
  const arbOp = fc.oneof(
    arbId.map((id) => ({ kind: 'apply' as const, id })),
    fc.integer({ min: 0, max: 40000 }).map((ms) => ({ kind: 'tick' as const, dt: ms / 1000 })),
  )

  it('keeps one entry per id, times within 0..duration, and applying twice equals once', () => {
    // **Validates: Requirements 12.4, 12.11, 12.12, 12.13**
    fc.assert(
      fc.property(fc.array(arbOp, { maxLength: 40 }), arbId, (ops, id) => {
        let list: ActiveEffect[] = []
        for (const op of ops) {
          list = op.kind === 'apply' ? applyEffect(list, op.id) : tickEffects(list, op.dt)
          const seen = new Set(list.map((e) => e.id))
          if (seen.size !== list.length) return false
          if (list.some((e) => e.leftS <= 0 || e.leftS > 30)) return false
        }
        const once = applyEffect(list, id)
        const twice = applyEffect(once, id)
        return JSON.stringify(once) === JSON.stringify(twice)
      }),
      { numRuns: 300 },
    )
  })

  it('ticking never increases any remaining time and ignores pause (dt 0)', () => {
    // **Validates: Requirements 12.5, 12.7, 12.12**
    fc.assert(
      fc.property(
        fc.array(arbId, { maxLength: 6 }),
        fc.integer({ min: 0, max: 30000 }),
        (applied, ms) => {
          const list = applied.reduce<ActiveEffect[]>((l, i) => applyEffect(l, i), [])
          const after = tickEffects(list, ms / 1000)
          const paused = tickEffects(list, 0)
          if (JSON.stringify(paused) !== JSON.stringify(list)) return false
          return after.every((e) => {
            const before = list.find((b) => b.id === e.id)
            return before !== undefined && e.leftS <= before.leftS && e.leftS > 0
          })
        },
      ),
      { numRuns: 300 },
    )
  })
})
