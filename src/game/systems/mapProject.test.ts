import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { PLAYABLE_BOUNDS } from '../../data/cemeteryLayout'
import { MAP_PX } from '../../data/mapLandmarks'
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH, clampToMap, mapToWorld, worldToMap } from './mapProject'

const RUNS = { numRuns: 100 }
const worldArb = fc.record({
  x: fc.double({ min: -PLAYABLE_BOUNDS.halfX, max: PLAYABLE_BOUNDS.halfX, noNaN: true }),
  z: fc.double({ min: -PLAYABLE_BOUNDS.halfZ, max: PLAYABLE_BOUNDS.halfZ, noNaN: true }),
})
const inside = (p: [number, number]): boolean =>
  p[0] >= 0 && p[0] <= MAP_CANVAS_WIDTH && p[1] >= 0 && p[1] <= MAP_CANVAS_HEIGHT

describe('mapProject', () => {
  it('maps the world origin past the margin', () => {
    const [px, py] = worldToMap(0, 0)
    expect(px).toBeGreaterThan(MAP_PX.marginPx)
    expect(py).toBeGreaterThan(MAP_PX.marginPx)
  })

  it('clamps far-away and non-finite points onto the canvas', () => {
    expect(clampToMap(-500, 9999)).toEqual([0, MAP_CANVAS_HEIGHT])
    expect(inside(clampToMap(NaN, Infinity))).toBe(true)
  })

  // Feature: 06-clarity-and-hud, Property 23: World–map transform
  // **Validates: Requirements 6.6, 6.7, 6.8, 6.9**
  it('Property 23: stays on canvas, round-trips and clamps anything', () => {
    fc.assert(
      fc.property(worldArb, ({ x, z }) => {
        const p = worldToMap(x, z)
        expect(inside(p)).toBe(true)
        const [wx, wz] = mapToWorld(p[0], p[1])
        expect(Math.abs(wx - x)).toBeLessThan(0.01)
        expect(Math.abs(wz - z)).toBeLessThan(0.01)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(fc.double({ noNaN: false }), fc.double({ noNaN: false }), (px, py) => {
        expect(inside(clampToMap(px, py))).toBe(true)
      }),
      RUNS,
    )
  })
})
