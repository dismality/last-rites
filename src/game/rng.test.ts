import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createRng, randInt } from './rng'

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(1891)
    const b = createRng(1891)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces different sequences for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })

  it('always returns values in [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed)
        for (let i = 0; i < 50; i++) {
          const v = rng()
          if (v < 0 || v >= 1) return false
        }
        return true
      }),
    )
  })
})

describe('randInt', () => {
  it('returns the bound when min equals max', () => {
    expect(randInt(createRng(7), 3, 3)).toBe(3)
  })

  it('stays within inclusive bounds', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: -20, max: 20 }), fc.nat(10), (seed, min, span) => {
        const max = min + span
        const rng = createRng(seed)
        for (let i = 0; i < 20; i++) {
          const v = randInt(rng, min, max)
          if (!Number.isInteger(v) || v < min || v > max) return false
        }
        return true
      }),
    )
  })
})
