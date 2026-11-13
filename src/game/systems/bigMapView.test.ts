import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { PLAYABLE_BOUNDS } from '../../data/cemeteryLayout'
import {
  BIG_MAP_MIN_SPAN_M,
  clampView,
  fitView,
  panBy,
  screenToWorld,
  spanMetres,
  worldToScreen,
  zoomAt,
  type BigMapView,
  type Viewport,
} from './bigMapView'

const viewportArb = fc.record({
  width: fc.integer({ min: 640, max: 2560 }),
  height: fc.integer({ min: 480, max: 1440 }),
})

const worldArb = fc.record({
  x: fc.double({ min: -PLAYABLE_BOUNDS.halfX, max: PLAYABLE_BOUNDS.halfX, noNaN: true }),
  z: fc.double({ min: -PLAYABLE_BOUNDS.halfZ, max: PLAYABLE_BOUNDS.halfZ, noNaN: true }),
})

/** A view reached by real zooms and pans, so it is always one the player could have. */
const viewArb = (vp: Viewport): fc.Arbitrary<BigMapView> =>
  fc
    .array(
      fc.oneof(
        fc.record({ kind: fc.constant('zoom' as const), px: fc.double({ min: 0, max: vp.width, noNaN: true }), py: fc.double({ min: 0, max: vp.height, noNaN: true }), f: fc.double({ min: 0.4, max: 2.5, noNaN: true }) }),
        fc.record({ kind: fc.constant('pan' as const), dx: fc.double({ min: -900, max: 900, noNaN: true }), dy: fc.double({ min: -900, max: 900, noNaN: true }) }),
      ),
      { maxLength: 12 },
    )
    .map((ops) =>
      ops.reduce<BigMapView>(
        (v, op) => (op.kind === 'zoom' ? zoomAt(v, vp, op.px, op.py, op.f) : panBy(v, vp, op.dx, op.dy)),
        fitView(vp),
      ),
    )

describe('big map view transform', () => {
  // Validates: the click-to-world maths is the exact inverse of the draw transform.
  it('world -> screen -> world returns the same point at every zoom and pan', () => {
    fc.assert(
      fc.property(
        viewportArb.chain((vp) => fc.tuple(fc.constant(vp), viewArb(vp), worldArb)),
        ([, view, w]) => {
          const [sx, sy] = worldToScreen(view, w.x, w.z)
          const [x, z] = screenToWorld(view, sx, sy)
          expect(x).toBeCloseTo(w.x, 6)
          expect(z).toBeCloseTo(w.z, 6)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('zooming keeps the world point under the cursor in place', () => {
    const vp = { width: 1280, height: 720 }
    const start = zoomAt(fitView(vp), vp, 600, 300, 3)
    const [wx, wz] = screenToWorld(start, 640, 360)
    const next = zoomAt(start, vp, 640, 360, 1.5)
    const [sx, sy] = worldToScreen(next, wx, wz)
    // The clamp may shift the sheet at its edges; away from them the point holds still.
    if (next.k !== start.k && next.ox < 0 && next.oy < 0) {
      expect(Math.abs(sx - 640)).toBeLessThan(1)
      expect(Math.abs(sy - 360)).toBeLessThan(1)
    }
  })

  it('zoom ranges from the whole grounds to about 30 m across', () => {
    const vp = { width: 1280, height: 720 }
    const wide = fitView(vp)
    const tight = zoomAt(wide, vp, 640, 360, 1000)
    expect(spanMetres(tight, vp)).toBeCloseTo(BIG_MAP_MIN_SPAN_M, 3)
    expect(zoomAt(tight, vp, 640, 360, 1e-6).k).toBeCloseTo(wide.k, 9)
    expect(spanMetres(wide, vp)).toBeGreaterThan(spanMetres(tight, vp))
  })

  it('pan never leaves the sheet', () => {
    const vp = { width: 800, height: 600 }
    const zoomed = zoomAt(fitView(vp), vp, 400, 300, 4)
    const far = panBy(zoomed, vp, 1e6, 1e6)
    expect(far.ox).toBeLessThanOrEqual(0)
    expect(far).toEqual(clampView(far, vp))
  })
})
