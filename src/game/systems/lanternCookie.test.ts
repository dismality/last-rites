import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { COOKIE_PLACEHOLDER_SIZE, cookieFalloff, softRoundCookie } from './lanternCookie'

describe('lanternCookie', () => {
  it('is full at the centre and zero at and beyond the edge', () => {
    expect(cookieFalloff(0)).toBe(1)
    expect(cookieFalloff(1)).toBe(0)
    expect(cookieFalloff(3)).toBe(0)
    expect(cookieFalloff(Number.NaN)).toBe(0)
  })

  it('falloff stays in 0..1 and never rises with distance', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1.5, noNaN: true }), fc.double({ min: 0, max: 1.5, noNaN: true }), (a, b) => {
        const [near, far] = a <= b ? [a, b] : [b, a]
        const n = cookieFalloff(near)
        const f = cookieFalloff(far)
        return n >= 0 && n <= 1 && f >= 0 && f <= 1 && f <= n
      }),
    )
  })

  it('builds opaque RGBA bytes, brightest in the middle, dark in the corners', () => {
    const size = COOKIE_PLACEHOLDER_SIZE
    const data = softRoundCookie()
    expect(data.length).toBe(size * size * 4)
    const at = (x: number, y: number) => data[(y * size + x) * 4]
    expect(at(size / 2, size / 2)).toBeGreaterThan(240)
    expect(at(0, 0)).toBe(0)
    expect(data[3]).toBe(255)
  })
})
