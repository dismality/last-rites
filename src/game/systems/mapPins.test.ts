import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { PLAYABLE_BOUNDS } from '../../data/cemeteryLayout'
import {
  PIN_LIMIT,
  PIN_REACH_M,
  addPin,
  beaconFade,
  clampToBounds,
  nearestWithin,
  reachPins,
  removePin,
  restorePins,
  serializePins,
  type Pin,
} from './mapPins'

const at = (x: number, z: number, name?: string) => ({ x, z, name })

describe('mapPins', () => {
  it('numbers pins 1..3 and names them "Pin n" unless a name is given', () => {
    let pins: Pin[] = []
    pins = addPin(pins, at(1, 1))
    pins = addPin(pins, at(2, 2, 'Chapel'))
    expect(pins.map((p) => [p.slot, p.name])).toEqual([
      [1, 'Pin 1'],
      [2, 'Chapel'],
    ])
  })

  it('a 4th pin replaces the oldest and takes its number', () => {
    let pins: Pin[] = []
    for (let i = 0; i < 4; i++) pins = addPin(pins, at(i * 10, 0))
    expect(pins).toHaveLength(PIN_LIMIT)
    expect(pins.map((p) => p.x)).toEqual([10, 20, 30])
    expect(pins.map((p) => p.slot)).toEqual([2, 3, 1])
  })

  it('a removed number is reused first', () => {
    let pins = [at(0, 0), at(5, 5), at(9, 9)].reduce<Pin[]>((p, t) => addPin(p, t), [])
    pins = removePin(pins, 2)
    pins = addPin(pins, at(7, 7))
    expect(pins.find((p) => p.x === 7)?.slot).toBe(2)
  })

  it('clamps pins into the playable bounds', () => {
    const [x, z] = clampToBounds(1e9, -1e9)
    expect(x).toBe(PLAYABLE_BOUNDS.halfX)
    expect(z).toBe(-PLAYABLE_BOUNDS.halfZ)
    expect(addPin([], at(NaN, 5))[0].x).toBe(0)
  })

  it('reaching a pin within 2 m clears only that pin', () => {
    const pins = [at(0, 0), at(10, 0)].reduce<Pin[]>((p, t) => addPin(p, t), [])
    const r = reachPins(pins, { x: 10 - PIN_REACH_M, z: 0 })
    expect(r.reached.map((p) => p.x)).toEqual([10])
    expect(r.pins.map((p) => p.x)).toEqual([0])
    expect(reachPins(pins, { x: 10 - PIN_REACH_M - 0.01, z: 0 }).reached).toHaveLength(0)
  })

  it('save and restore round-trips, and bad data is dropped', () => {
    const pins = [at(3, 4, 'Gate'), at(-8, 20)].reduce<Pin[]>((p, t) => addPin(p, t), [])
    expect(restorePins(JSON.parse(JSON.stringify(serializePins(pins))))).toEqual(pins)
    expect(restorePins('nope')).toEqual([])
    const messy = restorePins([
      { slot: 1, x: 1, z: 1, name: 'a' },
      { slot: 1, x: 2, z: 2, name: 'dup' },
      { slot: 9, x: 3, z: 3 },
      { slot: 2, x: 'x', z: 3 },
      null,
      { slot: 3, x: 5, z: 5 },
    ])
    expect(messy.map((p) => [p.slot, p.name])).toEqual([
      [1, 'a'],
      [3, 'Pin 3'],
    ])
  })

  it('the world beacon fades out between 4 m and the 2 m reach', () => {
    expect(beaconFade(50)).toBe(1)
    expect(beaconFade(4)).toBe(1)
    expect(beaconFade(3)).toBeCloseTo(0.5)
    expect(beaconFade(2)).toBe(0)
    expect(beaconFade(0)).toBe(0)
  })

  it('nearestWithin picks the closest hit inside the radius', () => {
    const items = [
      { id: 'a', p: [0, 0] as const },
      { id: 'b', p: [5, 0] as const },
    ]
    expect(nearestWithin(items, (i) => i.p, 4, 0, 3)?.id).toBe('b')
    expect(nearestWithin(items, (i) => i.p, 20, 0, 3)).toBeUndefined()
  })

  // Validates: never more than 3 pins, numbers unique, always inside the bounds.
  it('any sequence of adds and removes keeps the invariants', () => {
    const op = fc.oneof(
      fc.record({ add: fc.record({ x: fc.double({ noNaN: true, min: -500, max: 500 }), z: fc.double({ noNaN: true, min: -500, max: 500 }) }) }),
      fc.record({ remove: fc.constantFrom(1 as const, 2 as const, 3 as const) }),
    )
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
        let pins: Pin[] = []
        for (const o of ops) pins = 'add' in o ? addPin(pins, o.add) : removePin(pins, o.remove)
        expect(pins.length).toBeLessThanOrEqual(PIN_LIMIT)
        expect(new Set(pins.map((p) => p.slot)).size).toBe(pins.length)
        for (const p of pins) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(PLAYABLE_BOUNDS.halfX)
          expect(Math.abs(p.z)).toBeLessThanOrEqual(PLAYABLE_BOUNDS.halfZ)
        }
      }),
    )
  })
})
