import { describe, expect, it } from 'vitest'
import { BELL_SWING_DEG, BELL_SWING_HZ, BELL_SWING_S, bellAngle } from './bellSwing'

describe('bell swing', () => {
  it('is a few degrees, dies out, and rests before and after', () => {
    expect(bellAngle(-1)).toBe(0)
    expect(bellAngle(BELL_SWING_S)).toBe(0)
    expect(bellAngle(BELL_SWING_S + 5)).toBe(0)
    const peak = Math.max(...Array.from({ length: 700 }, (_, i) => Math.abs(bellAngle(i / 100))))
    expect(peak).toBeLessThanOrEqual((BELL_SWING_DEG * Math.PI) / 180)
    expect(peak).toBeGreaterThan(0.05)
    expect(Math.abs(bellAngle(BELL_SWING_S - 0.1))).toBeLessThan(0.002)
  })

  it('starts at rest and swings both ways', () => {
    expect(bellAngle(0)).toBe(0)
    const quarter = 1 / (4 * BELL_SWING_HZ)
    expect(bellAngle(quarter)).toBeGreaterThan(0)
    expect(bellAngle(3 * quarter)).toBeLessThan(0)
  })

  it('each swing is smaller than the one before', () => {
    const period = 1 / BELL_SWING_HZ
    const peaks = [0, 1, 2, 3].map((n) => Math.abs(bellAngle(period / 4 + n * period)))
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1])
  })
})
