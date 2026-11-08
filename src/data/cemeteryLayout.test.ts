import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  GROUNDS_HALF,
  TREE,
  craneCryptPosition,
  generateTrees,
  panelRun,
  buildFenceSegments,
} from './cemeteryLayout'
import { FIXED_SPAWNS, SPAWN_POINTS } from './zones'
import { allModelUrls, assetUrl, DRACO_PATH, itemModelUrls } from './assets'

describe('panelRun', () => {
  it('tiles a run exactly: panels are contiguous and cover from..to', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -60, max: 0 }),
        fc.integer({ min: 1, max: 80 }),
        fc.double({ min: 0.5, max: 3, noNaN: true }),
        (from, len, width) => {
          const to = from + len
          const panels = panelRun('x', 0, from, to, width)
          const w = panels[0].scale[0] * width
          expect(w * panels.length).toBeCloseTo(len, 6)
          expect(panels[0].position[0] - w / 2).toBeCloseTo(from, 6)
          expect(panels[panels.length - 1].position[0] + w / 2).toBeCloseTo(to, 6)
        },
      ),
    )
  })

  it('fences every perimeter segment', () => {
    for (const s of buildFenceSegments()) expect(panelRun(s.axis, s.fixed, s.from, s.to, 1.5).length).toBeGreaterThan(0)
  })
})

describe('trees', () => {
  const avoid = [...SPAWN_POINTS, ...FIXED_SPAWNS].map((p) => p.position)
  const trees = generateTrees(avoid)

  it('is deterministic and inside the grounds', () => {
    expect(generateTrees(avoid)).toEqual(trees)
    for (const t of trees) {
      expect(Math.abs(t.position[0])).toBeLessThanOrEqual(GROUNDS_HALF)
      expect(Math.abs(t.position[2])).toBeLessThanOrEqual(GROUNDS_HALF)
    }
  })

  it('never stands on a pickup', () => {
    for (const t of trees.slice(1)) {
      for (const a of avoid) {
        expect(Math.hypot(a[0] - t.position[0], a[2] - t.position[2])).toBeGreaterThanOrEqual(TREE.clearance)
      }
    }
  })
})

describe('assets', () => {
  it('lists all 8 hero item models under /assets and uses the local Draco path', () => {
    const urls = itemModelUrls()
    expect(urls).toHaveLength(8)
    for (const u of urls) expect(u).toMatch(/^\/assets\/models\/items\/[a-z-]+\.glb$/)
    expect(allModelUrls().every((u) => u.startsWith('/'))).toBe(true)
    expect(DRACO_PATH).toBe('/draco/')
    expect(assetUrl('assets/x.glb')).toBe('/assets/x.glb')
  })

  it('places the crypt behind the Mausoleum Row end wall', () => {
    expect(craneCryptPosition()[2]).toBeLessThan(-60)
  })
})
