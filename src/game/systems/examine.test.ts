import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  INITIAL_CLUE_STATE,
  REVEAL_HOLD_S,
  isMarkFacing,
  stepClueReveal,
  type ClueRevealState,
} from './examine'

describe('isMarkFacing', () => {
  it('is true when the mark points straight back at the camera', () => {
    expect(isMarkFacing([0, 0, -1], [0, 0, 1])).toBe(true)
  })
  it('is false when the mark points away or sideways', () => {
    expect(isMarkFacing([0, 0, -1], [0, 0, -1])).toBe(false)
    expect(isMarkFacing([0, 0, -1], [1, 0, 0])).toBe(false)
  })
  it('is false exactly at the -0.9 threshold', () => {
    expect(isMarkFacing([1, 0, 0], [-0.9, Math.sqrt(1 - 0.81), 0])).toBe(false)
  })
})

describe('stepClueReveal', () => {
  it('reveals after 1 s of continuous facing', () => {
    let s: ClueRevealState = INITIAL_CLUE_STATE
    for (let i = 0; i < 59; i++) s = stepClueReveal(s, true, 1 / 60)
    expect(s.revealed).toBe(false)
    s = stepClueReveal(s, true, 1 / 60)
    s = stepClueReveal(s, true, 1 / 60)
    expect(s.revealed).toBe(true)
  })
  it('resets the timer when the mark turns away', () => {
    let s = stepClueReveal(INITIAL_CLUE_STATE, true, 0.9)
    s = stepClueReveal(s, false, 0.016)
    expect(s.facingTime).toBe(0)
    s = stepClueReveal(s, true, 0.2)
    expect(s.revealed).toBe(false)
  })
  it('keeps the clue revealed once shown', () => {
    const s = stepClueReveal({ facingTime: 0, revealed: true }, false, 1)
    expect(s.revealed).toBe(true)
  })

  /** **Validates: Requirements 4.3** */
  it('property: reveals iff some facing run reaches the hold time', () => {
    const frame = fc.record({ facing: fc.boolean(), dt: fc.double({ min: 0, max: 0.5, noNaN: true }) })
    fc.assert(
      fc.property(fc.array(frame, { maxLength: 80 }), (frames) => {
        let s: ClueRevealState = INITIAL_CLUE_STATE
        let run = 0
        let expected = false
        for (const f of frames) {
          s = stepClueReveal(s, f.facing, f.dt)
          run = f.facing ? run + f.dt : 0
          if (run >= REVEAL_HOLD_S) expected = true
        }
        // Tolerate float summation differences only at the exact boundary.
        return s.revealed === expected || Math.abs(run - REVEAL_HOLD_S) < 1e-9
      }),
    )
  })
})
