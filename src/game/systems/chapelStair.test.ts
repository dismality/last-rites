import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { ALTAR_SLIDE, CHAPEL_INTERIOR_BOXES, CHAPEL_STAIR } from '../../data/chapelScenery'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { CHAPEL_AISLE, chapelSceneColliders } from './chapelColliders'
import {
  altarRestOffset,
  altarSlideOffset,
  splitAroundHole,
  stairAngle,
  stairColliders,
  stairOpening,
  stairOpeningWorld,
  stairSurfaceY,
  type GroundRect,
} from './chapelStair'

const area = (r: GroundRect) => (r.xMax - r.xMin) * (r.zMax - r.zMin)

describe('the chapel stair', () => {
  it('opens over the generator\u2019s opening, x -0.65..0.65 from z 4.75 to the end wall', () => {
    expect(stairOpening()).toEqual({ xMin: -0.65, xMax: 0.65, zMin: 4.75, zMax: 5.85 })
    const w = stairOpeningWorld(CHAPEL_CENTER)
    expect(w.xMin).toBeCloseTo(9.35, 9)
    expect(w.zMax).toBeCloseTo(10.85, 9)
  })

  it('falls 0.19 per 0.27 of run, from 0 at the top edge, and stops after the last step', () => {
    expect(stairSurfaceY(CHAPEL_STAIR.z0)).toBe(-0)
    expect(stairSurfaceY(CHAPEL_STAIR.z0 + CHAPEL_STAIR.run)).toBeCloseTo(-CHAPEL_STAIR.rise, 9)
    const bottom = -CHAPEL_STAIR.rise * CHAPEL_STAIR.steps
    expect(stairSurfaceY(50)).toBeCloseTo(bottom, 9)
    expect(stairAngle()).toBeLessThan(Math.PI / 4) // under the controller's 45 degree climb limit
  })

  it('has a ramp whose top face runs along the step nosings', () => {
    const { ramp } = stairColliders()
    const a = ramp.rotX
    const n = [0, Math.cos(a), Math.sin(a)]
    const d = [0, -Math.sin(a), Math.cos(a)]
    // Top-face point at a distance s along the slope from the ramp's centre.
    const topAt = (s: number) => [ramp.center[1] + n[1] * ramp.half[1] + d[1] * s, ramp.center[2] + n[2] * ramp.half[1] + d[2] * s]
    for (const s of [-ramp.half[2], 0, ramp.half[2] * 0.5]) {
      const [y, z] = topAt(s)
      expect(y).toBeCloseTo(stairSurfaceY(z), 6)
    }
    const [yStart, zStart] = topAt(-ramp.half[2])
    expect(zStart).toBeCloseTo(CHAPEL_STAIR.z0, 6)
    expect(yStart).toBeCloseTo(0, 6)
    expect(ramp.half[0]).toBeCloseTo((CHAPEL_STAIR.x1 - CHAPEL_STAIR.x0) / 2, 9)
  })

  it('walls the shaft on both sides, flush with the opening', () => {
    const { walls } = stairColliders()
    expect(walls).toHaveLength(2)
    const [west, east] = walls
    expect(west.center[0] + west.half[0]).toBeCloseTo(CHAPEL_STAIR.x0, 9)
    expect(east.center[0] - east.half[0]).toBeCloseTo(CHAPEL_STAIR.x1, 9)
    for (const w of walls) expect(w.center[1] + w.half[1]).toBeCloseTo(0, 9)
  })
})

describe('the floor with a hole in it', () => {
  const outer: GroundRect = { xMin: -40, xMax: 40, zMin: -36, zMax: 36 }

  it('covers the outer rectangle minus the hole, with no overlaps', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: 0.1, max: 5, noNaN: true }),
        fc.double({ min: 0.1, max: 5, noNaN: true }),
        (x, z, w, d) => {
          const hole = { xMin: x, xMax: x + w, zMin: z, zMax: z + d }
          const parts = splitAroundHole(outer, hole)
          const total = parts.reduce((s, p) => s + area(p), 0)
          expect(total).toBeCloseTo(area(outer) - area(hole), 6)
          // No part reaches into the hole.
          for (const p of parts) {
            const overlapX = Math.min(p.xMax, hole.xMax) - Math.max(p.xMin, hole.xMin)
            const overlapZ = Math.min(p.zMax, hole.zMax) - Math.max(p.zMin, hole.zMin)
            expect(overlapX <= 1e-9 || overlapZ <= 1e-9).toBe(true)
          }
        },
      ),
    )
  })

  it('leaves the floor whole when the hole is outside it', () => {
    expect(splitAroundHole(outer, { xMin: 50, xMax: 51, zMin: 0, zMax: 1 })).toEqual([outer])
  })
})

describe('the altar slides toward the door when the stair opens', () => {
  it('eases from 0 to -0.6 m over 2 s and stays there', () => {
    expect(altarSlideOffset(0)).toBe(0)
    expect(altarSlideOffset(ALTAR_SLIDE.seconds)).toBeCloseTo(-ALTAR_SLIDE.distance, 9)
    expect(altarSlideOffset(10)).toBeCloseTo(-ALTAR_SLIDE.distance, 9)
    let last = 0
    for (let t = 0; t <= ALTAR_SLIDE.seconds; t += 0.1) {
      const o = altarSlideOffset(t)
      expect(o).toBeLessThanOrEqual(last + 1e-12)
      last = o
    }
    expect(altarRestOffset(false)).toBe(0)
    expect(altarRestOffset(true)).toBe(-ALTAR_SLIDE.distance)
  })

  it('moves the altar collider off the opening and keeps the shortened aisle clear', () => {
    const before = chapelSceneColliders(0).find((b) => b.note === 'altar')!
    const after = chapelSceneColliders(-ALTAR_SLIDE.distance).find((b) => b.note === 'altar')!
    expect(before.center[2] + before.half[2]).toBeGreaterThan(CHAPEL_STAIR.z0)
    expect(after.center[2] + after.half[2]).toBeLessThanOrEqual(CHAPEL_STAIR.z0 + 1e-9)
    // It begins where the altar trigger now is, 0.6 m nearer the door.
    expect(after.center[2] - after.half[2]).toBeCloseTo(CHAPEL_AISLE.zMax - ALTAR_SLIDE.distance, 9)
    const raw = CHAPEL_INTERIOR_BOXES.find((b) => b.note === 'altar')!
    expect(after.center[2] + after.half[2]).toBeCloseTo(raw.center[2] + raw.half[2] - ALTAR_SLIDE.distance, 9)
    // Nothing else moved.
    const others = (dz: number) => chapelSceneColliders(dz).filter((b) => b.note !== 'altar')
    expect(others(-ALTAR_SLIDE.distance)).toEqual(others(0))
  })
})