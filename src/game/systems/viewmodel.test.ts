import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  SWAP_DURATION,
  SWAY_MAX,
  createSwapState,
  swapEase,
  tickSwap,
  tickSway,
  viewmodelBob,
  SWAY_REST,
  type SwapState,
} from './viewmodel'

const DT = 1 / 60

function run(s: SwapState, target: 'rusty-shovel' | 'bone-club' | null, seconds: number): SwapState {
  let cur = s
  for (let i = 0; i < Math.round(seconds / DT); i++) cur = tickSwap(cur, target, DT)
  return cur
}

describe('tickSwap', () => {
  it('stays raised when the target is already shown', () => {
    const s = run(createSwapState('rusty-shovel'), 'rusty-shovel', 1)
    expect(s).toEqual({ shown: 'rusty-shovel', progress: 0 })
  })

  it('swaps the item at the bottom, halfway through the 0.3 s animation', () => {
    const start = createSwapState('rusty-shovel')
    const early = run(start, 'bone-club', SWAP_DURATION / 2 - 2 * DT)
    expect(early.shown).toBe('rusty-shovel')
    const late = run(start, 'bone-club', SWAP_DURATION / 2 + 2 * DT)
    expect(late.shown).toBe('bone-club')
  })

  it('is fully raised with the new item after 0.3 s (plus one frame)', () => {
    const s = run(createSwapState('rusty-shovel'), 'bone-club', SWAP_DURATION + DT)
    expect(s.shown).toBe('bone-club')
    expect(s.progress).toBe(0)
  })

  it('property: progress stays within [0, 1] for any target sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('rusty-shovel' as const, 'bone-club' as const, null), { maxLength: 40 }),
        (targets) => {
          let s = createSwapState('rusty-shovel')
          for (const t of targets) {
            s = tickSwap(s, t, DT)
            if (s.progress < 0 || s.progress > 1) return false
          }
          return true
        }
      )
    )
  })
})

describe('swapEase', () => {
  it('maps the endpoints and clamps', () => {
    expect(swapEase(0)).toBe(0)
    expect(swapEase(1)).toBe(1)
    expect(swapEase(-3)).toBe(0)
    expect(swapEase(9)).toBe(1)
  })
})

describe('tickSway', () => {
  it('pushes opposite to a left turn and settles back to rest', () => {
    let s = tickSway(SWAY_REST, 0.05, 0, DT)
    expect(s.x).toBeGreaterThan(0)
    for (let i = 0; i < 240; i++) s = tickSway(s, 0, 0, DT)
    expect(Math.abs(s.x)).toBeLessThan(1e-4)
  })

  it('property: offset never exceeds SWAY_MAX', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true })), { maxLength: 60 }), (moves) => {
        let s = SWAY_REST
        for (const [a, b] of moves) {
          s = tickSway(s, a, b, DT)
          if (Math.abs(s.x) > SWAY_MAX + 1e-12 || Math.abs(s.y) > SWAY_MAX + 1e-12) return false
        }
        return true
      })
    )
  })
})

describe('viewmodelBob', () => {
  it('is zero when amplitude is zero (head bob off or standing still)', () => {
    const o = viewmodelBob({ phase: 1.3, amplitude: 0 })
    expect(Math.abs(o.x)).toBe(0)
    expect(Math.abs(o.y)).toBe(0)
  })

  it('moves when amplitude is non-zero', () => {
    const o = viewmodelBob({ phase: Math.PI / 2, amplitude: 0.04 })
    expect(o.y).toBeLessThan(0)
  })
})
