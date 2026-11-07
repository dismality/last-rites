import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  MAX_PITCH,
  SPRINT_SPEED,
  WALK_SPEED,
  applyLook,
  headBobOffset,
  moveSpeed,
  moveVelocity,
  tickHeadBob,
  HEAD_BOB_AMPLITUDE,
} from './movement'

describe('movement', () => {
  it('moves forward along -Z at yaw 0', () => {
    const [x, z] = moveVelocity(0, 1, 0, WALK_SPEED)
    expect(x).toBeCloseTo(0)
    expect(z).toBeCloseTo(-WALK_SPEED)
  })

  it('strafes right along +X at yaw 0', () => {
    const [x, z] = moveVelocity(0, 0, 1, WALK_SPEED)
    expect(x).toBeCloseTo(WALK_SPEED)
    expect(z).toBeCloseTo(0)
  })

  it('sprints only with stamina', () => {
    expect(moveSpeed(true, 10)).toBe(SPRINT_SPEED)
    expect(moveSpeed(true, 0)).toBe(WALK_SPEED)
    expect(moveSpeed(false, 100)).toBe(WALK_SPEED)
  })

  it('invertY flips the pitch direction', () => {
    expect(applyLook(0, 0, 0, 10, 1, false).pitch).toBeLessThan(0)
    expect(applyLook(0, 0, 0, 10, 1, true).pitch).toBeGreaterThan(0)
  })

  it('head bob is off when disabled or still', () => {
    let s = { phase: 1, amplitude: 0 }
    for (let i = 0; i < 120; i++) s = tickHeadBob(s, 1 / 60, true, false)
    expect(headBobOffset(s)).toBe(0)
  })

  it('head bob settles near the configured amplitude while walking', () => {
    let s = { phase: 0, amplitude: 0 }
    for (let i = 0; i < 300; i++) s = tickHeadBob(s, 1 / 60, true, true)
    expect(s.amplitude).toBeCloseTo(HEAD_BOB_AMPLITUDE, 3)
  })

  it('property: pitch always stays within ±85°', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 })), {
          maxLength: 50,
        }),
        fc.double({ min: 0.1, max: 3, noNaN: true }),
        fc.boolean(),
        (moves, sens, inv) => {
          let l = { yaw: 0, pitch: 0 }
          for (const [dx, dy] of moves) {
            l = applyLook(l.yaw, l.pitch, dx, dy, sens, inv)
            if (Math.abs(l.pitch) > MAX_PITCH + 1e-12) return false
          }
          return true
        }
      )
    )
  })

  it('property: velocity magnitude never exceeds speed', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.integer({ min: -1, max: 1 }),
        fc.integer({ min: -1, max: 1 }),
        (yaw, f, s) => {
          const [x, z] = moveVelocity(yaw, f, s, SPRINT_SPEED)
          return Math.hypot(x, z) <= SPRINT_SPEED + 1e-9
        }
      )
    )
  })
})
