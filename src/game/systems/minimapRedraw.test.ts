import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MINIMAP } from '../../data/minimap'
import { stepRedraw, type RedrawSample, type RedrawState } from './minimapRedraw'

const T = { moveM: MINIMAP.redrawMoveM, turnDeg: MINIMAP.redrawTurnDeg, maxHz: MINIMAP.maxRedrawHz }
const MAP = {}
const base: RedrawSample = { x: 0, z: 0, yaw: 0, mapRef: MAP, contentKey: 'd|', animating: false }

/** Runs the gate frame by frame; returns the times at which it redrew. */
function run(frames: Array<{ t: number; s: RedrawSample }>): number[] {
  let state: RedrawState | null = null
  const drawn: number[] = []
  for (const { t, s } of frames) {
    const r = stepRedraw(state, t, s, T)
    state = r.state
    if (r.redraw) drawn.push(t)
  }
  return drawn
}

const still = (n: number, dt: number) => Array.from({ length: n }, (_, i) => ({ t: i * dt, s: base }))

describe('minimap redraw gate', () => {
  it('draws once, then stays idle while nothing changes', () => {
    expect(run(still(120, 1000 / 60))).toEqual([0])
  })

  it('redraws after moving more than 0.25 m, not for less', () => {
    expect(run([...still(1, 0), { t: 100, s: { ...base, x: 0.2 } }])).toEqual([0])
    expect(run([...still(1, 0), { t: 100, s: { ...base, x: 0.26 } }])).toEqual([0, 100])
  })

  it('redraws after turning more than 3 degrees, not for less (also across the +/-pi seam)', () => {
    const deg = (d: number) => (d * Math.PI) / 180
    expect(run([...still(1, 0), { t: 100, s: { ...base, yaw: deg(2.5) } }])).toEqual([0])
    expect(run([...still(1, 0), { t: 100, s: { ...base, yaw: deg(3.5) } }])).toEqual([0, 100])
    const seam = { ...base, yaw: deg(179) }
    expect(run([{ t: 0, s: seam }, { t: 100, s: { ...seam, yaw: deg(-179) } }])).toEqual([0])
  })

  it('redraws when a cell is revealed or the objective changes', () => {
    expect(run([...still(1, 0), { t: 100, s: { ...base, mapRef: {} } }])).toEqual([0, 100])
    expect(run([...still(1, 0), { t: 100, s: { ...base, contentKey: 'd|3,4' } }])).toEqual([0, 100])
  })

  it('keeps redrawing while cells ink in', () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ t: i * 100, s: { ...base, animating: true } }))
    expect(run(frames)).toHaveLength(10)
  })

  it('holds a change back until the rate limit allows it, then draws it', () => {
    const drawn = run([
      { t: 0, s: base },
      { t: 20, s: { ...base, x: 5 } }, // changed, but only 20 ms after the last draw
      { t: 40, s: { ...base, x: 5 } },
      { t: 70, s: { ...base, x: 5 } },
    ])
    expect(drawn).toEqual([0, 70])
  })

  it('never exceeds 15 redraws in any one second, even when every frame changes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 40 }), { minLength: 60, maxLength: 400 }),
        (gaps) => {
          let t = 0
          const frames = gaps.map((g, i) => {
            t += g
            return { t, s: { ...base, x: i, yaw: i } } // moves and turns every frame
          })
          const drawn = run(frames)
          for (let i = 0; i + MINIMAP.maxRedrawHz < drawn.length; i++) {
            // Any 16 consecutive draws take longer than one second.
            expect(drawn[i + MINIMAP.maxRedrawHz] - drawn[i]).toBeGreaterThanOrEqual(1000)
          }
        },
      ),
    )
  })

  it('draws at most 15 times in a second of 60 fps walking', () => {
    const frames = Array.from({ length: 60 }, (_, i) => ({
      t: i * (1000 / 60),
      s: { ...base, x: i * 0.09 },
    }))
    const n = run(frames).length
    expect(n).toBeLessThanOrEqual(15)
    expect(n).toBeGreaterThan(5)
  })
})
