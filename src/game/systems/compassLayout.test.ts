import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { layoutCompassLabels, spanOf, type LabelBox } from './compassLayout'

const visibleOverlaps = (boxes: LabelBox[]): number => {
  const out = layoutCompassLabels(boxes)
  const items = boxes.map((b, i) => {
    const p = out[i]!
    const [a, z] = spanOf(b)
    return { lane: p.lane, hidden: p.hidden, a: a + p.shiftPx, z: z + p.shiftPx }
  })
  let n = 0
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const p = items[i]!
      const q = items[j]!
      if (!p.hidden && !q.hidden && p.lane === q.lane && p.a < q.z && p.z > q.a) n++
    }
  return n
}

describe('compass label layout', () => {
  it('objective distance and Hut in the same direction go on separate rows', () => {
    const out = layoutCompassLabels([
      { id: 'objective', centerPx: 200, widthPx: 60, pinned: null },
      { id: 'hut', centerPx: 204, widthPx: 56, pinned: null },
    ])
    expect(out.map((p) => p.lane)).toEqual([0, 1])
    expect(out[1]?.shiftPx).toBe(0)
  })

  it('a third label slides aside instead of drawing over the second row', () => {
    const boxes: LabelBox[] = [
      { id: 'objective', centerPx: 200, widthPx: 60, pinned: null },
      { id: 'hut', centerPx: 200, widthPx: 56, pinned: null },
      { id: 'chapel', centerPx: 200, widthPx: 80, pinned: null },
    ]
    expect(visibleOverlaps(boxes)).toBe(0)
    expect(layoutCompassLabels(boxes)[2]?.shiftPx).not.toBe(0)
  })

  it('drops a skull rather than stack it on a full strip', () => {
    const out = layoutCompassLabels([
      { id: 'a', centerPx: 100, widthPx: 60, pinned: null },
      { id: 'b', centerPx: 100, widthPx: 60, pinned: null },
      { id: 'spawn-1', centerPx: 100, widthPx: 60, pinned: null, droppable: true },
    ])
    expect(out[2]?.hidden).toBe(true)
  })

  it('labels far apart all stay on the bottom row', () => {
    const out = layoutCompassLabels([
      { id: 'a', centerPx: 50, widthPx: 40, pinned: null },
      { id: 'b', centerPx: 300, widthPx: 40, pinned: null },
    ])
    expect(out.every((p) => p.lane === 0 && p.shiftPx === 0)).toBe(true)
  })

  it('property: no two visible labels overlap on a row', () => {
    const box = fc.record({
      centerPx: fc.integer({ min: 0, max: 400 }),
      widthPx: fc.integer({ min: 20, max: 110 }),
      pinned: fc.constantFrom<'left' | 'right' | null>(null, null, 'left', 'right'),
      droppable: fc.boolean(),
    })
    fc.assert(
      fc.property(fc.array(box, { maxLength: 8 }), (arr) => {
        const boxes = arr.map((b, i) => ({ id: `m${i}`, ...b }))
        expect(visibleOverlaps(boxes)).toBe(0)
      }),
    )
  })
})
