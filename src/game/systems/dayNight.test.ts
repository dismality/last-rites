import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { fogForNight, tickDayNight } from './dayNight'
import type { WorldState } from '../types'

const start: WorldState = {
  phase: 'day',
  phaseTime: 0,
  nightNumber: 1,
  fogDensity: 0.02,
  wavesCleared: false,
}
const open = { wavesCleared: false }

describe('tickDayNight', () => {
  it('stays in day before 360 s', () => {
    const r = tickDayNight(start, 359, open)
    expect(r.state.phase).toBe('day')
    expect(r.events).toEqual([])
  })

  it('moves to dusk at 360 s and night at 390 s', () => {
    const dusk = tickDayNight(start, 360, open)
    expect(dusk.state.phase).toBe('dusk')
    expect(dusk.events).toEqual([{ type: 'phaseChanged', phase: 'dusk' }])
    const night = tickDayNight(dusk.state, 30, open)
    expect(night.state.phase).toBe('night')
    expect(night.events.map((e) => e.type)).toEqual(['phaseChanged', 'nightStarted'])
  })

  it('stays in night until waves are cleared, then dawn, then next day', () => {
    const night = tickDayNight(start, 390, open).state
    expect(tickDayNight(night, 1000, open).state.phase).toBe('night')
    const dawn = tickDayNight(night, 1, { wavesCleared: true })
    expect(dawn.state.phase).toBe('dawn')
    expect(dawn.events.map((e) => e.type)).toEqual(['phaseChanged', 'dawnStarted'])
    const day = tickDayNight(dawn.state, 10, open)
    expect(day.state.phase).toBe('day')
    expect(day.state.nightNumber).toBe(2)
    expect(day.state.fogDensity).toBe(0.03)
  })

  it('matches design-bible fog per night and clamps out-of-range', () => {
    expect([1, 2, 3, 4, 5].map(fogForNight)).toEqual([0.02, 0.03, 0.04, 0.05, 0.06])
    expect(fogForNight(9)).toBe(0.06)
    expect(fogForNight(0)).toBe(0.02)
  })
})

describe('tickDayNight properties', () => {
  it('step independence while waves are not cleared', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (a, b) => {
          const two = tickDayNight(tickDayNight(start, a, open).state, b, open)
          const one = tickDayNight(start, a + b, open)
          expect(two.state.phase).toBe(one.state.phase)
          expect(two.state.nightNumber).toBe(one.state.nightNumber)
          expect(two.state.phaseTime).toBeCloseTo(one.state.phaseTime, 6)
        },
      ),
    )
  })
})

describe('Property 5: a pending pick holds dawn and nothing else', () => {
  // **Validates: Requirements 1.5, 7.7, 12.11**
  const dawnState = (phaseTime: number, nightNumber: number): WorldState => ({
    phase: 'dawn',
    phaseTime,
    nightNumber,
    fogDensity: 0.02,
    wavesCleared: true,
  })
  const steps = fc.array(fc.double({ min: 0, max: 50, noNaN: true }), {
    minLength: 1,
    maxLength: 8,
  })

  it('a held dawn never changes phase or time and emits nothing', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 9.9, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        steps,
        (t, n, dts) => {
          let s = dawnState(t, n)
          for (const dt of dts) {
            const r = tickDayNight(s, dt, { wavesCleared: true, holdDawn: true })
            expect(r.events).toEqual([])
            expect(r.state.phase).toBe('dawn')
            expect(r.state.phaseTime).toBe(t)
            s = r.state
          }
        },
      ),
    )
  })

  it('an unheld dawn ends after its duration', () => {
    const r = tickDayNight(dawnState(0, 2), 10, { wavesCleared: true, holdDawn: false })
    expect(r.state.phase).toBe('day')
    expect(r.state.nightNumber).toBe(3)
  })

  it('day lasts dayLengthS and the night number never exceeds lastNight', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 600 }), fc.integer({ min: 1, max: 8 }), (len, last) => {
        const input = { wavesCleared: false, dayLengthS: len, lastNight: last }
        expect(tickDayNight(start, len - 0.5, input).state.phase).toBe('day')
        expect(tickDayNight(start, len, input).state.phase).toBe('dusk')
        const d = tickDayNight(dawnState(0, last), 10, { ...input, wavesCleared: true })
        expect(d.state.nightNumber).toBeLessThanOrEqual(last)
      }),
    )
  })
})
