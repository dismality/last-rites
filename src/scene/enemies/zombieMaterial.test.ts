import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  ZOMBIE_MAX_SATURATION,
  ZOMBIE_MAX_VALUE,
  adjustZombieColor,
  zombieColdFill,
  type Rgb,
} from './zombieMaterial'

const hsv = ([r, g, b]: Rgb) => {
  const max = Math.max(r, g, b)
  return { s: max === 0 ? 0 : (max - Math.min(r, g, b)) / max, v: max }
}
const rgb = fc.tuple(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.double({ min: 0, max: 1, noNaN: true }),
)

describe('zombieColdFill', () => {
  it('is a faint cool fill that scales with the skin', () => {
    fc.assert(
      fc.property(rgb, (skin) => {
        const [r, , b] = zombieColdFill(skin)
        expect(b).toBeGreaterThanOrEqual(r)
        expect(Math.max(...zombieColdFill(skin))).toBeLessThanOrEqual(0.35 * Math.max(...skin) + 1e-9)
      }),
    )
    expect(zombieColdFill([0.1, 0.1, 0.1])[2]).toBeLessThan(zombieColdFill([0.6, 0.6, 0.6])[2])
  })
})

describe('adjustZombieColor', () => {
  it('caps saturation and brightness for any base and tint', () => {
    fc.assert(
      fc.property(rgb, rgb, (base, tint) => {
        const { s, v } = hsv(adjustZombieColor(base, tint))
        expect(s).toBeLessThanOrEqual(ZOMBIE_MAX_SATURATION + 1e-9)
        expect(v).toBeLessThanOrEqual(ZOMBIE_MAX_VALUE + 1e-9)
      }),
    )
  })

  it('turns a bright orange skin pale', () => {
    const out = adjustZombieColor([1, 0.55, 0.2], [1, 1, 1])
    expect(hsv(out).s).toBeLessThanOrEqual(ZOMBIE_MAX_SATURATION + 1e-9)
  })

  it('keeps tints distinct: lurker is darker than wailer', () => {
    const base: Rgb = [0.6, 0.55, 0.5]
    const lurker = adjustZombieColor(base, [0.42, 0.44, 0.48])
    const wailer = adjustZombieColor(base, [0.79, 0.84, 0.9])
    expect(hsv(lurker).v).toBeLessThan(hsv(wailer).v)
  })

  it('leaves the elite ember aura brighter and more saturated than any skin', () => {
    const ember: Rgb = [0xe8 / 255, 0x91 / 255, 0x3a / 255]
    const e = hsv(ember)
    expect(e.v).toBeGreaterThan(ZOMBIE_MAX_VALUE)
    expect(e.s).toBeGreaterThan(ZOMBIE_MAX_SATURATION)
  })
})
