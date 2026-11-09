import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { forwardFromYaw } from './melee'
import { bearingDeg, buildCompassMarkers, compassTicks, headingDeg, relativeAngle } from './compass'

const RUNS = { numRuns: 100 }
const yawArb = fc.double({ min: -20, max: 20, noNaN: true })
const coord = fc.double({ min: -60, max: 60, noNaN: true })
const posArb = fc.record({ x: coord, z: coord })
const phaseArb = fc.constantFrom('day', 'dusk', 'night', 'dawn' as const)

/** Smallest circular difference between two angles in degrees. */
const circDiff = (a: number, b: number): number => Math.abs(relativeAngle(a, b))

describe('compass conventions', () => {
  it('yaw 0 faces north, positive yaw (turn left) faces west', () => {
    expect(headingDeg(0)).toBe(0)
    expect(headingDeg(Math.PI / 2)).toBeCloseTo(270, 6)
    expect(bearingDeg({ x: 0, z: 0 }, { x: 0, z: -5 })).toBeCloseTo(0, 6)
    expect(bearingDeg({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(90, 6)
  })

  it('lists N/E/S/W at the right offsets', () => {
    const ticks = compassTicks(0)
    expect(ticks).toHaveLength(13)
    expect(ticks.find((t) => t.label === 'N')?.rel).toBe(0)
    expect(ticks.find((t) => t.label === 'E')?.rel).toBe(90)
    expect(ticks.find((t) => t.label === 'W')?.rel).toBe(-90)
  })

  it('shows whole metres on the objective marker', () => {
    const m = buildCompassMarkers({
      player: { x: 0, z: 0 },
      heading: 0,
      objective: [0, 0, -33.6],
      phase: 'day',
      bellBuilt: false,
    })
    expect(m.find((k) => k.id === 'objective')?.label).toBe('34 m')
  })
})

describe('compass properties', () => {
  it('Feature: 06-clarity-and-hud, Property 20: Relative angle range and forward target', () => {
    // **Validates: Requirements 5.12**
    fc.assert(
      fc.property(posArb, posArb, yawArb, (p, t, yaw) => {
        const r = relativeAngle(bearingDeg(p, t), headingDeg(yaw))
        expect(r).toBeGreaterThan(-180)
        expect(r).toBeLessThanOrEqual(180)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(posArb, yawArb, fc.double({ min: 1, max: 50, noNaN: true }), (p, yaw, d) => {
        const f = forwardFromYaw(yaw)
        const target = { x: p.x + f.x * d, z: p.z + f.z * d }
        const r = relativeAngle(bearingDeg(p, target), headingDeg(yaw))
        expect(Math.abs(r)).toBeLessThan(1e-6)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 21: Heading is periodic', () => {
    // **Validates: Requirements 5.13, 5.3**
    fc.assert(
      fc.property(posArb, posArb, fc.integer({ min: -72000, max: 72000 }), (p, t, hc) => {
        // Hundredths of a degree keep h and h + 360 exact enough that ticks on the +-90 edge cannot flip on rounding.
        const h = hc / 100
        const b = bearingDeg(p, t)
        expect(circDiff(relativeAngle(b, h), relativeAngle(b, h + 360))).toBeLessThan(1e-6)
        const a = compassTicks(h)
        const c = compassTicks(h + 360)
        expect(c.length).toBe(a.length)
        a.forEach((tick, i) => {
          expect(Math.abs(tick.rel - c[i].rel)).toBeLessThan(1e-6)
          expect(tick.label).toBe(c[i].label)
        })
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 22: Compass markers', () => {
    // **Validates: Requirements 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10**
    fc.assert(
      fc.property(
        posArb,
        fc.double({ min: 0, max: 359.99, noNaN: true }),
        fc.option(fc.tuple(coord, fc.constant(0), coord), { nil: undefined }),
        phaseArb,
        fc.boolean(),
        (player, heading, objective, phase, bellBuilt) => {
          const ms = buildCompassMarkers({ player, heading, objective, phase, bellBuilt })
          expect(ms.some((m) => m.id === 'chapel')).toBe(true)
          expect(ms.some((m) => m.id === 'hut')).toBe(true)
          const obj = ms.find((m) => m.id === 'objective')
          expect(obj !== undefined).toBe(objective !== undefined)
          if (obj && objective) {
            const d = Math.round(Math.hypot(objective[0] - player.x, objective[2] - player.z))
            expect(obj.label).toBe(`${d} m`)
          }
          const hasSpawn = ms.some((m) => m.id.startsWith('spawn-'))
          if (!((phase === 'dusk' || phase === 'night') && bellBuilt)) expect(hasSpawn).toBe(false)
          for (const m of ms) {
            expect(m.glyph.length).toBeGreaterThan(0)
            expect(m.label.length).toBeGreaterThan(0)
            if (Math.abs(m.rel) > 90) {
              expect(m.pinned).toBe(m.rel > 0 ? 'right' : 'left')
              expect(m.x).toBe(m.rel > 0 ? 1 : -1)
            } else {
              expect(m.pinned).toBeNull()
            }
          }
          for (const t of compassTicks(heading)) {
            expect(Math.abs(t.rel)).toBeLessThanOrEqual(90)
            const abs = (((heading + t.rel) % 360) + 360) % 360
            expect(Math.abs(Math.round(abs / 15) * 15 - abs)).toBeLessThan(1e-6)
            if (t.label) expect(['N', 'E', 'S', 'W']).toContain(t.label)
          }
        },
      ),
      RUNS,
    )
    // Spawn markers exist at night with the bell built (a far-away player sees graves).
    const night = buildCompassMarkers({
      player: { x: 0, z: 0 },
      heading: 0,
      phase: 'night',
      bellBuilt: true,
    })
    expect(night.some((m) => m.id.startsWith('spawn-'))).toBe(true)
  })
})
