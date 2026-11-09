import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { TOAST } from '../../data/achievements'
import { MIN_TOAST_S, splitToasts, toastDurationS, toastExpired, toastOpacity } from './achievementToastTiming'

describe('achievement toast timing', () => {
  it('a batch of 5 shows 3 and queues 2, in order', () => {
    const { visible, queued } = splitToasts(['a', 'b', 'c', 'd', 'e'])
    expect(visible).toEqual(['a', 'b', 'c'])
    expect(queued).toEqual(['d', 'e'])
    expect(visible.length).toBe(TOAST.maxVisible)
  })

  it('toasts show with Subtitles off for at least 3 s', () => {
    // The duration takes no Subtitles input, so turning them off cannot shorten a toast.
    expect(toastDurationS()).toBeGreaterThanOrEqual(MIN_TOAST_S)
    expect(toastExpired(MIN_TOAST_S - 0.1, toastDurationS())).toBe(false)
  })

  it('fades in and out over 0.5 s and holds in between', () => {
    expect(toastOpacity(0)).toBe(0)
    expect(toastOpacity(TOAST.fadeS / 2)).toBeCloseTo(0.5)
    expect(toastOpacity(2)).toBe(1)
    expect(toastOpacity(TOAST.showS - TOAST.fadeS / 2)).toBeCloseTo(0.5)
    expect(toastOpacity(TOAST.showS)).toBe(0)
    expect(toastExpired(TOAST.showS)).toBe(true)
  })

  it('opacity stays within 0..1', () => {
    fc.assert(
      fc.property(fc.double({ min: -2, max: 10, noNaN: true }), (age) => {
        const o = toastOpacity(age)
        return o >= 0 && o <= 1
      }),
    )
  })
})
