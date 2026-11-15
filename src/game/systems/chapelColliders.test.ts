import { describe, expect, it } from 'vitest'
import type { ChapelBox } from '../../data/chapelScenery'
import { CHAPEL_BUTTRESS_TRIMS, CHAPEL_EXTERIOR_BOXES } from '../../data/chapelScenery'
import {
  CHAPEL_AISLE,
  chapelSceneColliders,
  clearAisle,
  clearedColliders,
  crossesAisle,
  droppedColliders,
  trimOuter,
  trimmedButtresses,
} from './chapelColliders'

const box = (cx: number, cz: number, hx: number, hz: number, note = 'test'): ChapelBox => ({
  center: [cx, 0.5, cz],
  half: [hx, 0.5, hz],
  rotY: 0,
  note,
})
const edges = (b: ChapelBox) => ({
  xMin: b.center[0] - b.half[0],
  xMax: b.center[0] + b.half[0],
  zMin: b.center[2] - b.half[2],
  zMax: b.center[2] + b.half[2],
})

describe('crossesAisle', () => {
  it('a box beside the aisle or touching its edge does not cross it', () => {
    expect(crossesAisle(box(2, 0, 1, 1))).toBe(false)
    expect(crossesAisle(box(CHAPEL_AISLE.halfWidth + 0.5, 0, 0.5, 1))).toBe(false)
  })
  it('a box reaching into the aisle does', () => {
    expect(crossesAisle(box(1.5, 0, 1, 1))).toBe(true)
    expect(crossesAisle(box(0, 0, 0.2, 0.2))).toBe(true)
  })
  it('a box past the altar end of the aisle does not', () => {
    expect(crossesAisle(box(0, CHAPEL_AISLE.zMax + 0.5, 0.5, 0.5))).toBe(false)
  })
})

describe('clearAisle', () => {
  it('leaves a clear box unchanged', () => {
    const b = box(2, 0, 0.5, 1)
    expect(clearAisle(b)).toBe(b)
  })
  it('pulls a side box inner edge to the aisle edge and keeps its outer edge', () => {
    const east = clearAisle(box(1.5, 0, 1, 0.4))!
    expect(edges(east).xMin).toBeCloseTo(CHAPEL_AISLE.halfWidth, 9)
    expect(edges(east).xMax).toBeCloseTo(2.5, 9)
    const west = clearAisle(box(-1.5, 0, 1, 0.4))!
    expect(edges(west).xMax).toBeCloseTo(-CHAPEL_AISLE.halfWidth, 9)
    expect(edges(west).xMin).toBeCloseTo(-2.5, 9)
    expect(crossesAisle(east)).toBe(false)
    expect(crossesAisle(west)).toBe(false)
  })
  it('shortens a centred box at the far end to start at the aisle end', () => {
    const altar = clearAisle(box(0, CHAPEL_AISLE.zMax + 0.2, 1, 0.6))!
    expect(edges(altar).zMin).toBeCloseTo(CHAPEL_AISLE.zMax, 9)
    expect(edges(altar).zMax).toBeCloseTo(CHAPEL_AISLE.zMax + 0.8, 9)
  })
  it('drops a centred box in the middle of the aisle', () => {
    const lectern = box(0, 0, 0.3, 0.3, 'lectern')
    expect(clearAisle(lectern)).toBeNull()
    expect(clearedColliders([lectern, box(2, 0, 0.5, 0.5)])).toHaveLength(1)
    expect(droppedColliders([lectern, box(2, 0, 0.5, 0.5)])).toEqual([lectern])
  })
})

describe('buttress trims', () => {
  it('trimOuter moves only the outer face, on either side', () => {
    const west = trimOuter(box(-3, 0, 0.36, 0.29), -3.2)
    expect(edges(west).xMin).toBeCloseTo(-3.2, 9)
    expect(edges(west).xMax).toBeCloseTo(-2.64, 9)
    const east = trimOuter(box(3, 0, 0.36, 0.29), 3.2)
    expect(edges(east).xMax).toBeCloseTo(3.2, 9)
    expect(edges(east).xMin).toBeCloseTo(2.64, 9)
    // A trim beyond the box leaves it as it was.
    expect(edges(trimOuter(box(-3, 0, 0.36, 0.29), -4)).xMin).toBeCloseTo(-3.36, 9)
  })

  it('applies every listed trim to its buttress and leaves the rest alone', () => {
    const out = trimmedButtresses()
    expect(out).toHaveLength(CHAPEL_EXTERIOR_BOXES.length)
    let trimmed = 0
    out.forEach((b, i) => {
      const t = CHAPEL_BUTTRESS_TRIMS.find((tr) => tr.x === CHAPEL_EXTERIOR_BOXES[i].center[0] && tr.z === CHAPEL_EXTERIOR_BOXES[i].center[2])
      if (t) {
        trimmed++
        expect(edges(b).xMin).toBeCloseTo(t.outerX, 9)
        expect(edges(b).xMax).toBeCloseTo(edges(CHAPEL_EXTERIOR_BOXES[i]).xMax, 9)
      } else expect(b).toBe(CHAPEL_EXTERIOR_BOXES[i])
    })
    expect(trimmed).toBe(CHAPEL_BUTTRESS_TRIMS.length)
  })

  it('the scene colliders use the trimmed buttresses', () => {
    const all = chapelSceneColliders()
    for (const t of CHAPEL_BUTTRESS_TRIMS) {
      const b = all.find((c) => c.note === 'buttress' && c.center[2] === t.z && c.center[0] < 0 === t.x < 0 && Math.abs(c.center[0] - t.x) < 0.2)!
      expect(edges(b).xMin).toBeCloseTo(t.outerX, 9)
    }
  })
})
