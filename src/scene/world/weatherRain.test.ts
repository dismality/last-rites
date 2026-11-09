import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { getRainLevel, setRainLevel } from '../../audio/rain'
import { RAIN } from '../../data/storms'
import {
  RAIN_DRAW_CALLS,
  createRainField,
  stepRain,
  stepRainLevel,
  thunderResponse,
} from './weatherRain'

describe('rain field', () => {
  it('a storm adds exactly one draw call and 600 streaks', () => {
    expect(RAIN_DRAW_CALLS).toBe(1)
    expect(createRainField(() => 0.5).x.length).toBe(RAIN.count)
  })

  it('does not move while frozen', () => {
    const f = createRainField(Math.random)
    const before = Array.from(f.y)
    stepRain(f, 0.016, true)
    expect(Array.from(f.y)).toEqual(before)
  })

  it('falls with a slant and stays inside the box', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 0.1, noNaN: true }), (dt) => {
        const f = createRainField(Math.random)
        const y0 = f.y[0]
        stepRain(f, dt, false)
        const fell = (y0 - f.y[0] + RAIN.boxM[1]) % RAIN.boxM[1]
        expect(fell).toBeCloseTo(((RAIN.speedMps * Math.cos((8 * Math.PI) / 180) * dt) % RAIN.boxM[1]), 3)
        expect(f.x.every((v) => v >= 0 && v < RAIN.boxM[0])).toBe(true)
        expect(f.y.every((v) => v >= 0 && v < RAIN.boxM[1])).toBe(true)
      }),
    )
  })
})

describe('rain level', () => {
  it('fades in and out over 3 seconds', () => {
    expect(stepRainLevel(0, true, 1.5)).toBeCloseTo(0.5)
    expect(stepRainLevel(0.5, true, 5)).toBe(1)
    expect(stepRainLevel(1, false, 3)).toBe(0)
  })

  it('setRainLevel clamps and ignores non-finite input', () => {
    setRainLevel(2)
    expect(getRainLevel()).toBe(1)
    setRainLevel(NaN)
    expect(getRainLevel()).toBe(0)
  })
})

describe('thunder response', () => {
  const modes = ['full', 'reduced', 'off'] as const
  it('shakes only for close thunder with Camera shake on and Scare intensity full', () => {
    for (const scareIntensity of modes) {
      for (const cameraShake of [true, false]) {
        const r = thunderResponse(true, { cameraShake, scareIntensity })
        expect(r.shake).toBe(cameraShake && scareIntensity === 'full')
        expect(r.sound).toBe('thunder-close')
      }
    }
  })

  it('far thunder never shakes', () => {
    const r = thunderResponse(false, { cameraShake: true, scareIntensity: 'full' })
    expect(r).toEqual({ sound: 'thunder-far', shake: false })
  })
})
