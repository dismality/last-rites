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
      fc.property(fc.double({ min: 0, max: 600, noNaN: true }), fc.double({ min: 0, max: 600, noNaN: true }), (a, b) => {
        const two = tickDayNight(tickDayNight(start, a, open).state, b, open)
        const one = tickDayNight(start, a + b, open)
        expect(two.state.phase).toBe(one.state.phase)
        expect(two.state.nightNumber).toBe(one.state.nightNumber)
        expect(two.state.phaseTime).toBeCloseTo(one.state.phaseTime, 6)
      }),
    )
  })
})
