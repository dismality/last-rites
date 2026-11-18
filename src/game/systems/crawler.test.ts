import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CRAWLER } from '../../data/creatures'
import { createRng } from '../rng'
import type { AttackKind } from './combat'
import {
  crawlerHit,
  swingIsDownward,
  createCrawler,
  faceTriggerApplies,
  pickCrawlerSpots,
  stepCrawler,
  type CrawlerEvent,
} from './crawler'

const DT = 1 / 60
const spotsArb = fc
  .integer({ min: 0, max: 20 })
  .map((n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, x: i * 3, z: -i })))

describe('pickCrawlerSpots', () => {
  it('returns 3 to 6 distinct spots, or all when fewer exist', () => {
    // Feature: 11-horror-pass, Property 6: Crawler rules
    // **Validates: Requirements 2.2**
    fc.assert(
      fc.property(spotsArb, fc.integer(), fc.integer({ min: -3, max: 12 }), (spots, seed, count) => {
        const picked = pickCrawlerSpots(spots, seed, count)
        const want = Math.min(6, Math.max(3, count))
        expect(picked).toHaveLength(Math.min(want, spots.length))
        expect(new Set(picked.map((s) => s.id)).size).toBe(picked.length)
        picked.forEach((s) => expect(spots).toContainEqual(s))
        expect(pickCrawlerSpots(spots, seed, count)).toEqual(picked)
      }),
      { numRuns: 100 },
    )
  })
})

describe('stepCrawler', () => {
  it('stays hidden until the player is within 2 m', () => {
    const rng = createRng(1)
    const hidden = createCrawler({ x: 0, z: 0 })
    expect(stepCrawler(hidden, { x: 2.01, z: 0 }, DT, rng).crawler.phase).toBe('hidden')
    const r = stepCrawler(hidden, { x: 2, z: 0 }, DT, rng)
    expect(r.crawler.phase).toBe('emerged')
    expect(r.events.map((e) => e.type)).toEqual(['burst', 'tell'])
  })

  it('bursts only within 2 m, grabs for 8, and at most once per 1.5 s', () => {
    // Feature: 11-horror-pass, Property 6: Crawler rules
    // **Validates: Requirements 2.3, 2.4**
    const stepArb = fc.record({ x: fc.double({ min: -6, max: 6, noNaN: true }), z: fc.double({ min: -6, max: 6, noNaN: true }) })
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 1, maxLength: 120 }), fc.integer(), (path, seed) => {
        const rng = createRng(seed)
        let c = createCrawler({ x: 0, z: 0 })
        const grabs: number[] = []
        // Hold each waypoint for half a second so grabs have time to land.
        path.forEach((p, i) => {
          for (let k = 0; k < 30; k++) {
            const t = (i * 30 + k) * DT
            const wasHidden = c.phase === 'hidden'
            const farBefore = Math.hypot(p.x - c.x, p.z - c.z) > CRAWLER.burstRangeM
            const r = stepCrawler(c, p, DT, rng)
            if (wasHidden && farBefore) expect(r.crawler.phase).toBe('hidden')
            r.events.forEach((e: CrawlerEvent) => {
              if (e.type === 'grab') {
                expect(e.damage).toBe(8)
                grabs.push(t)
              }
            })
            c = r.crawler
          }
        })
        for (let i = 1; i < grabs.length; i++) expect(grabs[i] - grabs[i - 1]).toBeGreaterThanOrEqual(1.5 - 1e-9)
      }),
      { numRuns: 100 },
    )
  })

  it('grabs a player who stands still, after its warning', () => {
    const rng = createRng(4)
    let c = createCrawler({ x: 0, z: 0 })
    let tellAt = -1
    let grabAt = -1
    for (let i = 0; i < 400 && grabAt < 0; i++) {
      const r = stepCrawler(c, { x: 1, z: 0 }, DT, rng)
      c = r.crawler
      if (tellAt < 0 && r.events.some((e) => e.type === 'tell')) tellAt = i * DT
      if (r.events.some((e) => e.type === 'grab')) grabAt = i * DT
    }
    expect(grabAt).toBeGreaterThanOrEqual(tellAt + 0.5 - DT)
  })
})

describe('crawlerHit', () => {
  it('misses a level swing and takes every other kind of hit', () => {
    // Feature: 11-horror-pass, Property 6: Crawler rules
    // **Validates: Requirements 2.4, 2.5**
    const kinds: AttackKind[] = ['melee-horizontal', 'melee-down', 'bullet', 'fire']
    fc.assert(
      fc.property(fc.constantFrom(...kinds), fc.double({ min: 0, max: 500, noNaN: true }), (kind, dmg) => {
        const r = crawlerHit(kind, dmg)
        if (kind === 'melee-horizontal') expect(r).toEqual({ damage: 0, miss: true })
        else expect(r).toEqual({ damage: dmg, miss: false })
      }),
      { numRuns: 100 },
    )
  })
})

describe('faceTriggerApplies', () => {
  const player = { x: 0, z: 0, fx: 0, fz: 1 }
  it('needs a burst within 1.5 m and in front', () => {
    expect(faceTriggerApplies({ x: 0, z: 1.4 }, player)).toBe(true)
    expect(faceTriggerApplies({ x: 0, z: 1.6 }, player)).toBe(false)
    expect(faceTriggerApplies({ x: 0, z: -1 }, player)).toBe(false)
  })
})

describe('swingIsDownward', () => {
  it('a heavy swing is always downward; a light one only while looking down far enough', () => {
    fc.assert(
      fc.property(fc.double({ min: -1.5, max: 1.5, noNaN: true }), (pitch) => {
        expect(swingIsDownward(true, pitch)).toBe(true)
        expect(swingIsDownward(false, pitch)).toBe(pitch <= CRAWLER.downSwingPitchRad)
      }),
      { numRuns: 100 },
    )
    expect(swingIsDownward(false, Number.NaN)).toBe(false)
  })
})
