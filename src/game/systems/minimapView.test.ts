import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MINIMAP } from '../../data/minimap'
import {
  bearingWord,
  minimapToWorld,
  placeMarker,
  visibleCellRange,
  worldToMinimap,
  type MinimapGeometry,
} from './minimapView'

const G: MinimapGeometry = { sizePx: MINIMAP.canvasPx, radiusM: MINIMAP.radiusM }
const INSET = MINIMAP.markerInsetPx
const coord = fc.double({ min: -300, max: 300, noNaN: true })
const player = fc.record({ x: coord, z: coord })

describe('minimap view window (40 m radius, north up)', () => {
  it('puts the player at the centre and the window edges at +/- 40 m', () => {
    const p = { x: 12, z: -30 }
    expect(worldToMinimap(G, p, 12, -30)).toEqual([96, 96])
    expect(worldToMinimap(G, p, 12 + 40, -30)).toEqual([192, 96]) // east = right
    expect(worldToMinimap(G, p, 12, -30 - 40)).toEqual([96, 0]) // north (-Z) = up
    expect(worldToMinimap(G, p, 12 - 40, -30 + 40)).toEqual([0, 192]) // west = left, south = down
  })

  it('round-trips world <-> minimap for any player and point', () => {
    fc.assert(
      fc.property(player, coord, coord, (p, x, z) => {
        const [px, py] = worldToMinimap(G, p, x, z)
        const [wx, wz] = minimapToWorld(G, p, px, py)
        expect(wx).toBeCloseTo(x, 6)
        expect(wz).toBeCloseTo(z, 6)
      }),
    )
  })

  it('covers the cells that touch the window', () => {
    const r = visibleCellRange(40, { x: 0, z: 0 })
    expect(r).toEqual({ minCx: -5, maxCx: 5, minCz: -5, maxCz: 5 })
  })
})

describe('minimap edge pinning', () => {
  it('keeps a target inside the window where it is', () => {
    const m = placeMarker(G, { x: 0, z: 0 }, { x: 10, z: -20 }, INSET)
    expect(m.pinned).toBe(false)
    expect([m.x, m.y]).toEqual(worldToMinimap(G, { x: 0, z: 0 }, 10, -20))
    expect(m.distanceM).toBeCloseTo(Math.hypot(10, 20))
  })

  it('pins any off-window target onto the border, in the right direction', () => {
    const outside = fc
      .tuple(coord, coord)
      .filter(([dx, dz]) => Math.max(Math.abs(dx), Math.abs(dz)) > MINIMAP.radiusM + 1)
    fc.assert(
      fc.property(player, outside, (p, [dx, dz]) => {
        const m = placeMarker(G, p, { x: p.x + dx, z: p.z + dz }, INSET)
        const half = G.sizePx / 2 - INSET
        expect(m.pinned).toBe(true)
        // On the inset border: the larger axis offset equals the half-extent.
        const ox = m.x - G.sizePx / 2
        const oy = m.y - G.sizePx / 2
        expect(Math.max(Math.abs(ox), Math.abs(oy))).toBeCloseTo(half, 6)
        // Same direction as the target: the pinned point and the true offset are parallel and agree in sign.
        expect(ox * dz - oy * dx).toBeCloseTo(0, 4)
        expect(ox * dx + oy * dz).toBeGreaterThan(0)
        // The arrow angle is the bearing, clockwise from north.
        // (Compared as sine and cosine so the +/-pi seam cannot trip it.)
        const len = Math.hypot(dx, dz)
        expect(Math.sin(m.angle)).toBeCloseTo(dx / len, 6)
        expect(Math.cos(m.angle)).toBeCloseTo(-dz / len, 6)
      }),
    )
  })

  it('points the arrow north, east, south and west for targets in those directions', () => {
    const at = (x: number, z: number) => placeMarker(G, { x: 0, z: 0 }, { x, z }, INSET).angle
    expect(at(0, -100)).toBeCloseTo(0)
    expect(at(100, 0)).toBeCloseTo(Math.PI / 2)
    expect(Math.abs(at(0, 100))).toBeCloseTo(Math.PI)
    expect(at(-100, 0)).toBeCloseTo(-Math.PI / 2)
  })

  it('words the bearing for the screen reader', () => {
    expect(bearingWord(0)).toBe('north')
    expect(bearingWord(Math.PI / 2)).toBe('east')
    expect(bearingWord(-Math.PI / 2)).toBe('west')
    expect(bearingWord(Math.PI)).toBe('south')
  })
})
