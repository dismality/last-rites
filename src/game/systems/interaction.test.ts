import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  isInteractRange,
  isWithinLantern,
  keyLabel,
  pickHoverTarget,
  promptText,
} from './interaction'
import { lanternRadius } from './lantern'

describe('interaction rules', () => {
  it('formats prompts with key and action', () => {
    expect(promptText('dig', 'KeyE')).toBe('E: Dig')
    expect(promptText('pickup', 'MouseLeft')).toBe('LMB: Take')
    expect(keyLabel('ShiftLeft')).toBe('Shift')
  })

  it('pulses only inside the lantern radius and only when lit', () => {
    expect(isWithinLantern(7.9, 100, true)).toBe(true)
    expect(isWithinLantern(8.1, 100, true)).toBe(false)
    expect(isWithinLantern(1, 100, false)).toBe(false)
  })

  it('range is 2.5 m inclusive', () => {
    expect(isInteractRange(2.5)).toBe(true)
    expect(isInteractRange(2.51)).toBe(false)
  })

  it('picks the nearest in-range hit', () => {
    expect(pickHoverTarget([{ id: 'far', distance: 3 }])).toBeNull()
    expect(
      pickHoverTarget([
        { id: 'b', distance: 2 },
        { id: 'a', distance: 1 },
      ])?.id
    ).toBe('a')
  })

  it('pulse gating matches lanternRadius for any fuel', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (fuel) => {
        const r = lanternRadius(fuel)
        return isWithinLantern(r, fuel, true) && !isWithinLantern(r + 0.01, fuel, true)
      })
    )
  })
})
