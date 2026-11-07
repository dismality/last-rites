import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LANDMARKS } from '../../data/mapLandmarks'
import {
  EMPTY_MAP,
  cellAt,
  deserializeMap,
  discoveredLandmarks,
  exploredCells,
  isExplored,
  revealAt,
  serializeMap,
} from './mapReveal'

const pos = fc.tuple(
  fc.double({ min: -100, max: 100, noNaN: true }),
  fc.double({ min: 0, max: 3, noNaN: true }),
  fc.double({ min: -100, max: 100, noNaN: true }),
)

describe('revealAt', () => {
  it('uses an 8 m grid and handles negative coordinates', () => {
    expect(cellAt(0, 0)).toEqual({ cx: 0, cz: 0 })
    expect(cellAt(7.9, 8)).toEqual({ cx: 0, cz: 1 })
    expect(cellAt(-0.1, -8.1)).toEqual({ cx: -1, cz: -2 })
  })

  it('reports a cell only the first time it is entered', () => {
    const first = revealAt(EMPTY_MAP, [3, 0, 3])
    expect(first.newlyRevealed).toEqual([{ cx: 0, cz: 0 }])
    const again = revealAt(first.map, [5, 0, 1])
    expect(again.newlyRevealed).toEqual([])
    expect(revealAt(again.map, [9, 0, 1]).newlyRevealed).toEqual([{ cx: 1, cz: 0 }])
  })

  it('ignores non-finite positions', () => {
    expect(revealAt(EMPTY_MAP, [NaN, 0, 0])).toEqual({ map: EMPTY_MAP, newlyRevealed: [] })
  })

  // **Validates: Requirements 6.1**
  it('property: revealAt is idempotent', () => {
    fc.assert(
      fc.property(fc.array(pos, { maxLength: 8 }), pos, (history, p) => {
        const base = history.reduce((m, h) => revealAt(m, h).map, EMPTY_MAP)
        const once = revealAt(base, p)
        const twice = revealAt(once.map, p)
        expect(twice.map).toEqual(once.map)
        expect(twice.newlyRevealed).toEqual([])
        expect(isExplored(once.map, cellAt(p[0], p[2]).cx, cellAt(p[0], p[2]).cz)).toBe(true)
      }),
    )
  })
})

describe('landmarks', () => {
  it('appear only once their cell is explored', () => {
    expect(discoveredLandmarks(EMPTY_MAP, LANDMARKS)).toEqual([])
    const bench = LANDMARKS.find((l) => l.id === 'workbench')!
    const map = revealAt(EMPTY_MAP, bench.position).map
    expect(discoveredLandmarks(map, LANDMARKS).map((l) => l.id)).toContain('workbench')
  })

  it('cover workbench, chapel, both gates and every relic site', () => {
    const kinds = LANDMARKS.map((l) => l.kind)
    expect(kinds.filter((k) => k === 'gate')).toHaveLength(2)
    expect(kinds.filter((k) => k === 'relic')).toHaveLength(5)
    expect(kinds).toContain('workbench')
    expect(kinds).toContain('chapel')
  })
})

describe('save data', () => {
  // **Validates: Requirements 6.4**
  it('property: serialize then deserialize round-trips through JSON', () => {
    fc.assert(
      fc.property(fc.array(pos, { maxLength: 20 }), (ps) => {
        const map = ps.reduce((m, p) => revealAt(m, p).map, EMPTY_MAP)
        const restored = deserializeMap(JSON.parse(JSON.stringify(serializeMap(map))))
        expect(exploredCells(restored)).toEqual(exploredCells(map))
      }),
    )
  })

  it('drops malformed entries and tolerates garbage', () => {
    expect(deserializeMap(null)).toEqual(EMPTY_MAP)
    expect(deserializeMap({ cells: 'x' })).toEqual(EMPTY_MAP)
    const m = deserializeMap({ cells: [[1, 2], [1.5, 2], ['a', 0], [3]] })
    expect(exploredCells(m)).toEqual([{ cx: 1, cz: 2 }])
  })
})
