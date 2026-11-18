import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BAT } from '../../data/bats'
import { freshBatSave, sanitizeBatSave } from './batSave'
import { bearingDeg, fleePosition, wingAngle } from './bats'

const batArb = fc.record({
  phase: fc.constantFrom('perched' as const, 'gone' as const),
  boxIndex: fc.integer({ min: 0, max: 99 }),
  previousBox: fc.option(fc.integer({ min: 0, max: 99 }), { nil: null }),
  t: fc.integer({ min: 0, max: 200 }),
  restYaw: fc.integer({ min: -180, max: 180 }).map((n) => n + 0.5),
  yaw: fc.integer({ min: -180, max: 180 }).map((n) => n + 0.5),
})

describe('sanitizeBatSave', () => {
  it('loads junk as no bats', () => {
    expect(sanitizeBatSave(undefined, 100)).toEqual(freshBatSave())
    expect(sanitizeBatSave('x', 100)).toEqual(freshBatSave())
  })

  it('turns a bat in flight into a gone bat', () => {
    const s = sanitizeBatSave(
      { seededNight: 1, simTime: 5, bats: [{ phase: 'fleeing', boxIndex: 2, previousBox: null, t: 3, restYaw: 10, yaw: 40 }] },
      10,
    )
    expect(s.bats[0]).toMatchObject({ phase: 'gone', boxIndex: 2, t: 0, yaw: 10 })
  })

  it('Feature: 11-horror-pass, bat save: valid saves round-trip, with unique boxes and at most perchedMax bats', () => {
    fc.assert(
      fc.property(fc.array(batArb, { maxLength: 30 }), (bats) => {
        const s = sanitizeBatSave({ seededNight: 2, simTime: 50, lastChitter: 10, bats }, 100)
        expect(s.bats.length).toBeLessThanOrEqual(BAT.perchedMax)
        expect(new Set(s.bats.map((b) => b.boxIndex)).size).toBe(s.bats.length)
        expect(sanitizeBatSave(JSON.parse(JSON.stringify(s)), 100)).toEqual(s)
      }),
      { numRuns: 100 },
    )
  })

  it('drops bats on boxes that no longer exist', () => {
    const s = sanitizeBatSave({ bats: [{ phase: 'perched', boxIndex: 50, t: 0, restYaw: 0, yaw: 0 }] }, 10)
    expect(s.bats).toEqual([])
  })
})

describe('flight helpers', () => {
  it('flees away from the start, climbing and curving', () => {
    const a = fleePosition([0, 1, 0], 0, 0)
    const b = fleePosition([0, 1, 0], 0, 3)
    expect(a.position).toEqual([0, 1, 0])
    expect(b.position[2]).toBeGreaterThan(10)
    expect(b.position[1]).toBeGreaterThan(1)
    expect(Math.abs(b.position[0])).toBeGreaterThan(0.5)
  })

  it('flaps eight times a second', () => {
    expect(wingAngle(0)).toBe(0)
    expect(wingAngle(1 / 32)).toBeCloseTo(BAT.flapAmpRad, 5)
    expect(wingAngle(1 / 8)).toBeCloseTo(0, 5)
  })

  it('bearing 0 is +z', () => {
    expect(bearingDeg(0, 0, 0, 5)).toBe(0)
    expect(bearingDeg(0, 0, 5, 0)).toBe(90)
  })
})
