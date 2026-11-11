import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createSpikeFilter } from './lookFilter'

function run(events: [number, number][]): { dx: number; dy: number } {
  const f = createSpikeFilter()
  let dx = 0
  let dy = 0
  for (const [x, y] of events) {
    const d = f.push(x, y)
    dx += d.dx
    dy += d.dy
  }
  f.endFrame()
  f.endFrame()
  return { dx, dy }
}

describe('spike filter', () => {
  it('drops one huge event between slow ones', () => {
    expect(run([[2, 1], [3, 0], [4000, -2500], [2, 1], [3, 1]])).toEqual({ dx: 10, dy: 3 })
  })

  it('drops a spike that ends the frame with no follow-up', () => {
    const f = createSpikeFilter()
    expect(f.push(5000, 0)).toEqual({ dx: 0, dy: 0 })
    f.endFrame()
    f.endFrame()
    expect(f.push(1, 1)).toEqual({ dx: 1, dy: 1 })
  })

  it('keeps a genuine flick: a run of large consistent events is not eaten', () => {
    const flick: [number, number][] = [[60, 0], [200, 0], [450, 0], [480, 0], [500, 0], [300, 0], [80, 0]]
    expect(run(flick).dx).toBe(2070)
  })

  it('keeps a flick that starts abruptly with consecutive large events', () => {
    expect(run([[500, 0], [520, 0], [510, 0]]).dx).toBe(1530)
  })

  it('leaves normal motion unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: -150, max: 150 }), fc.integer({ min: -150, max: 150 })), { maxLength: 60 }),
        (events) => {
          const sum = events.reduce((a, [x, y]) => ({ dx: a.dx + x, dy: a.dy + y }), { dx: 0, dy: 0 })
          expect(run(events)).toEqual(sum)
        },
      ),
    )
  })

  it('reset forgets a held spike', () => {
    const f = createSpikeFilter()
    f.push(5000, 0)
    f.reset()
    expect(f.push(100, 0)).toEqual({ dx: 100, dy: 0 })
  })
})
