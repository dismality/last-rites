import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BAT } from '../../data/bats'
import { choosePerches, qualifyingBoxes, topHeight, type PerchBox } from './batPerches'

const boxArb = fc.record({
  center: fc.tuple(
    fc.double({ min: -50, max: 50, noNaN: true }),
    fc.double({ min: 0, max: 2, noNaN: true }),
    fc.double({ min: -50, max: 50, noNaN: true }),
  ),
  half: fc.tuple(
    fc.double({ min: 0.1, max: 1, noNaN: true }),
    fc.double({ min: 0.05, max: 1, noNaN: true }),
    fc.double({ min: 0.1, max: 1, noNaN: true }),
  ),
}) as fc.Arbitrary<PerchBox>

/** Boxes with a top face in the qualifying band. */
const goodBox = (i: number): PerchBox => ({ center: [i, 0.5, 0], half: [0.3, 0.5, 0.3] })

describe('qualifyingBoxes', () => {
  it('keeps the band edges and drops outside them', () => {
    const mk = (top: number): PerchBox => ({ center: [0, top / 2, 0], half: [1, top / 2, 1] })
    const out = qualifyingBoxes([mk(0.59), mk(0.6), mk(1.6), mk(1.61)])
    expect(out).toEqual([1, 2])
  })
})

describe('stone above a perch', () => {
  const plinth: PerchBox = { center: [-24, 0.42, 18], half: [0.9, 0.42, 0.9], rotY: 1.5708 }
  const shaft: PerchBox = { center: [-24, 2.4, 18], half: [0.66, 1.6, 0.15], rotY: 1.5708 }

  it('rejects a cross plinth whose shaft stands on it', () => {
    expect(qualifyingBoxes([plinth, shaft])).toEqual([])
    expect(qualifyingBoxes([plinth])).toEqual([0])
  })

  it('keeps a box with a shaft beside it', () => {
    const beside: PerchBox = { ...shaft, center: [-20, 2.4, 18] }
    expect(qualifyingBoxes([plinth, beside])).toEqual([0])
  })
})

describe('choosePerches', () => {
  it('returns top-face centres', () => {
    const boxes = Array.from({ length: 20 }, (_, i) => goodBox(i))
    const spots = choosePerches(boxes, 7)
    expect(spots[0].position[1]).toBe(1)
  })

  it('skips occupied and excluded boxes', () => {
    const boxes = Array.from({ length: 9 }, (_, i) => goodBox(i))
    const spots = choosePerches(boxes, 3, [0, 1], [2])
    expect(spots.every((s) => s.boxIndex > 2)).toBe(true)
  })

  // Feature: 11-horror-pass, Property 16: Bat perch selection
  it('Property 16: picks distinct qualifying boxes in range', () => {
    fc.assert(
      fc.property(fc.array(boxArb, { maxLength: 60 }), fc.integer(), (boxes, seed) => {
        const qual = new Set(qualifyingBoxes(boxes))
        const spots = choosePerches(boxes, seed)
        const idx = spots.map((s) => s.boxIndex)
        expect(new Set(idx).size).toBe(idx.length)
        for (const s of spots) {
          expect(qual.has(s.boxIndex)).toBe(true)
          const h = topHeight(boxes[s.boxIndex])
          expect(h).toBeGreaterThanOrEqual(BAT.boxHeightMinM)
          expect(h).toBeLessThanOrEqual(BAT.boxHeightMaxM)
        }
        if (qual.size >= BAT.perchedMin) {
          expect(spots.length).toBeGreaterThanOrEqual(BAT.perchedMin)
          expect(spots.length).toBeLessThanOrEqual(BAT.perchedMax)
        } else {
          expect(spots.length).toBe(qual.size)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('Property 16: qualifying-rich lists reach the 8 to 12 band', () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 80 }), fc.integer(), (n, seed) => {
        const boxes = Array.from({ length: n }, (_, i) => goodBox(i))
        const c = choosePerches(boxes, seed).length
        expect(c).toBeGreaterThanOrEqual(8)
        expect(c).toBeLessThanOrEqual(12)
      }),
      { numRuns: 100 },
    )
  })
})
