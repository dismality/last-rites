import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { SCARE_STAGING } from '../../data/scares'
import {
  DOOR_IDLE,
  type DoorState,
  STATUE_IDLE,
  behindPoint,
  candleLit,
  doorAngle,
  isInView,
  pickBehind,
  sidePoint,
  slowFactor,
  snuffSchedule,
  startSnuff,
  tickCandles,
  tickDoor,
  tickStatue,
  triggerStatue,
} from './scareStaging'
import { SCARE_EVENTS, TELEGRAPH_LEAD_MAX_S, TELEGRAPH_LEAD_MIN_S } from '../../data/scares'

const origin = { x: 0, z: 0 }

describe('scareStaging', () => {
  it('yaw 0 looks toward -Z; behind is +Z and right is +X', () => {
    expect(isInView(origin, 0, { x: 0, z: -5 })).toBe(true)
    expect(isInView(origin, 0, { x: 0, z: 5 })).toBe(false)
    expect(behindPoint(origin, 0, 2).z).toBeCloseTo(2)
    expect(sidePoint(origin, 0, 1, 2).x).toBeCloseTo(2)
    expect(sidePoint(origin, 0, -1, 2).x).toBeCloseTo(-2)
  })

  it('statue turns only once the player looks away, and gives up if watched', () => {
    const statue = { x: 0, z: -6 }
    let s = triggerStatue(STATUE_IDLE)
    s = tickStatue(s, 1, origin, 0, statue) // looking at it
    expect(s.status).toBe('waiting')
    s = tickStatue(s, 1, origin, Math.PI, statue) // looked away
    expect(s.status).toBe('turned')

    let watched = triggerStatue(STATUE_IDLE)
    for (let i = 0; i < 20; i++) watched = tickStatue(watched, 1, origin, 0, statue)
    expect(watched.status).toBe('away')
  })

  it('door creaks open over the telegraph, then slams shut', () => {
    let d: DoorState = { ...DOOR_IDLE, phase: 'creak' }
    d = tickDoor(d, 0.5)
    expect(doorAngle(d, 1)).toBeCloseTo(SCARE_STAGING.doorCreakAngle / 2)
    d = { phase: 'slam', t: 0 }
    d = tickDoor(d, SCARE_STAGING.doorSlamS + 0.01)
    expect(doorAngle(d, 1)).toBe(0)
  })

  it('candles go out farthest first and relight later', () => {
    const candles = [
      { x: 0, z: -1 },
      { x: 0, z: -9 },
      { x: 0, z: -5 },
    ]
    const sched = snuffSchedule(candles, origin)
    expect(sched[1]).toBe(0)
    expect(sched[0]).toBeGreaterThan(sched[2])
    let c = startSnuff(candles, origin)
    c = tickCandles(c, 1)
    expect(candleLit(c, 0)).toBe(false)
    c = tickCandles(c, SCARE_STAGING.candleRelightAfterS + 5)
    expect(candleLit(c, 0)).toBe(true)
  })

  it('hand slows to half speed only while it holds', () => {
    expect(slowFactor(1)).toBe(SCARE_STAGING.handSlowFactor)
    expect(slowFactor(0)).toBe(1)
  })

  it('picks the door behind the player when there is one', () => {
    const doors = [
      { position: [0, 0, -4] as const },
      { position: [0, 0, 4] as const },
    ]
    expect(pickBehind(origin, 0, doors)?.position[2]).toBe(4)
  })

  it('every event stages with a telegraph lead of 0.5-1.5 s', () => {
    for (const e of SCARE_EVENTS) {
      expect(e.telegraph.lead).toBeGreaterThanOrEqual(TELEGRAPH_LEAD_MIN_S)
      expect(e.telegraph.lead).toBeLessThanOrEqual(TELEGRAPH_LEAD_MAX_S)
    }
  })

  it('property: a statue never turns while the player is looking at it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        fc.double({ min: 2, max: 10, noNaN: true }),
        (angle, d) => {
          // Statue placed exactly where the player looks (yaw), so it is always in view.
          const yaw = angle
          const statue = { x: -Math.sin(yaw) * d, z: -Math.cos(yaw) * d }
          let s = triggerStatue(STATUE_IDLE)
          for (let i = 0; i < 30; i++) {
            s = tickStatue(s, 0.1, origin, yaw, statue)
            expect(s.status).not.toBe('turned')
          }
        },
      ),
    )
  })
})

