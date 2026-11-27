import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  BEACON_FULL_M,
  BEACON_HIDE_M,
  flatDistance,
  objectiveInHutFromOutside,
  objectiveBeaconFade,
  objectiveBeaconLabel,
} from './objectiveBeacon'

describe('objectiveBeaconFade', () => {
  it('is gone up close and full from afar', () => {
    expect(objectiveBeaconFade(0)).toBe(0)
    expect(objectiveBeaconFade(BEACON_HIDE_M)).toBe(0)
    expect(objectiveBeaconFade(BEACON_FULL_M)).toBe(1)
    expect(objectiveBeaconFade(80)).toBe(1)
    expect(objectiveBeaconFade(Number.NaN)).toBe(1)
  })

  it('stays in 0..1 and never falls as the player walks away', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (d, more) => {
        const a = objectiveBeaconFade(d)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1)
        expect(objectiveBeaconFade(d + more)).toBeGreaterThanOrEqual(a)
      }),
    )
  })
})

describe('objectiveBeaconLabel', () => {
  it('names the place and rounds the distance', () => {
    expect(objectiveBeaconLabel('Ledger', 23.6)).toBe('Ledger · 24 m')
    expect(objectiveBeaconLabel(undefined, 5)).toBe('Objective · 5 m')
    expect(objectiveBeaconLabel('Bells', Number.POSITIVE_INFINITY)).toBe('Bells')
  })

  it('says when the objective is inside the hut', () => {
    expect(objectiveBeaconLabel('Page', 25.2, true)).toBe('Page · in the hut · 25 m')
  })
})

describe('objectiveInHutFromOutside', () => {
  it('is true only from outside the hut looking at something inside it', () => {
    const inside: [number, number, number] = [0, 0.8, 0]
    const outside: [number, number, number] = [0, 0, 30]
    expect(objectiveInHutFromOutside(outside, inside)).toBe(true)
    expect(objectiveInHutFromOutside(inside, inside)).toBe(false)
    expect(objectiveInHutFromOutside(outside, outside)).toBe(false)
    expect(objectiveInHutFromOutside(inside, outside)).toBe(false)
  })
})

describe('flatDistance', () => {
  it('ignores height', () => {
    expect(flatDistance([0, 0, 0], [3, 9, 4])).toBe(5)
  })
})
