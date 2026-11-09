import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  HEARTBEAT_FAST_S,
  HEARTBEAT_SLOW_S,
  HIT_FEEDBACK_MS,
  desaturation,
  heartbeatInterval,
  vignetteOpacity,
} from './damageFeedback'

describe('damageFeedback', () => {
  it('shows no vignette when flashing lights are off', () => {
    expect(vignetteOpacity(0, false)).toBe(0)
    expect(vignetteOpacity(0, true)).toBeGreaterThan(0)
  })

  it('fades out after the feedback window', () => {
    expect(vignetteOpacity(HIT_FEEDBACK_MS, true)).toBe(0)
  })

  it('heartbeat and desaturation only start below 30 HP', () => {
    expect(heartbeatInterval(30)).toBeNull()
    expect(desaturation(30)).toBe(0)
    expect(heartbeatInterval(29)).not.toBeNull()
    expect(desaturation(29)).toBeLessThan(0)
    expect(heartbeatInterval(0)).toBeNull()
  })

  it('stays within bounds for any input', () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 200, noNaN: true }), fc.double({ min: -1000, max: 5000, noNaN: true }), (hp, ms) => {
        const v = vignetteOpacity(ms, true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
        expect(desaturation(hp)).toBeLessThanOrEqual(0)
        const i = heartbeatInterval(hp)
        if (i !== null) {
          expect(i).toBeGreaterThanOrEqual(HEARTBEAT_FAST_S)
          expect(i).toBeLessThanOrEqual(HEARTBEAT_SLOW_S)
        }
      }),
    )
  })
})
