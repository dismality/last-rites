import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  ZOMBIE_MAX_SATURATION,
  ZOMBIE_MAX_VALUE,
  ZOMBIE_MIN_VALUE,
  TEXTURED_COLD_FILL_SCALE,
  texturedColdFill,
  texturedZombieColor,
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

describe('textured skins (spec 09 task 11p)', () => {
  it('leaves the shambler white so the texture shows as painted', () => {
    expect(texturedZombieColor([1, 1, 1])).toEqual([1, 1, 1])
  })
  it('blends a tint half-way toward white and keeps the lurker above the floor', () => {
    fc.assert(
      fc.property(rgb, (tint) => {
        const c = texturedZombieColor(tint)
        c.forEach((x, i) => {
          expect(x).toBeGreaterThanOrEqual(Math.min(tint[i], 1) - 1e-9)
          expect(x).toBeLessThanOrEqual(1)
        })
        expect(Math.max(...c)).toBeGreaterThanOrEqual(ZOMBIE_MIN_VALUE - 1e-9)
      }),
    )
    const lurker = texturedZombieColor([0.42, 0.435, 0.478])
    expect(lurker[0]).toBeCloseTo(0.71, 2)
  })
  it('keeps the looks apart: the lurker darker than the wailer, the wailer bluer than the shambler', () => {
    const lurker = texturedZombieColor([0.42, 0.435, 0.478])
    const wailer = texturedZombieColor([0.788, 0.839, 0.902])
    expect(Math.max(...lurker)).toBeLessThan(Math.max(...wailer))
    expect(wailer[2] - wailer[0]).toBeGreaterThan(0)
  })
  it('gives a textured skin a quarter of the flat cold fill', () => {
    fc.assert(
      fc.property(rgb, (c) => {
        const t = texturedColdFill(c)
        const f = zombieColdFill(c)
        t.forEach((x, i) => expect(x).toBeCloseTo(f[i] * TEXTURED_COLD_FILL_SCALE, 9))
      }),
    )
  })
})
