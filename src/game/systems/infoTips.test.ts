import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { INFO_TIPS, INFO_TIP_KEYS } from '../../data/infoTips'
import { countSentences, placeTooltip, tipFor, type Rect } from './infoTips'
import journalSource from '../../ui/journal/Journal.tsx?raw'


/** Tab ids declared in the TABS constant of Journal.tsx. */
function journalTabIds(): string[] {
  const block = /const TABS = \[([\s\S]*?)\] as const/.exec(journalSource)
  if (!block) throw new Error('TABS not found in Journal.tsx')
  return [...block[1].matchAll(/id:\s*'([a-z-]+)'/g)].map((m) => m[1])
}

describe('countSentences', () => {
  it('counts sentences and ignores decimals and blanks', () => {
    expect(countSentences('')).toBe(0)
    expect(countSentences('One.')).toBe(1)
    expect(countSentences('One. Two!  Three?')).toBe(3)
    expect(countSentences('It costs 2.5 coins')).toBe(1)
    expect(countSentences('No end mark')).toBe(1)
  })
})

describe('tipFor', () => {
  it('returns null while info dots are off', () => {
    expect(tipFor('hud-oil', false)).toBeNull()
    expect(tipFor('hud-oil', true)).toBe(INFO_TIPS['hud-oil'])
  })
})

describe('info tips data', () => {
  // Feature: 11-horror-pass, Property 19: Info tips completeness
  it('every key has a non-empty tip of at most 2 sentences (property)', () => {
    // **Validates: Requirements 5.7, 5.8, 5.12**
    fc.assert(
      fc.property(fc.constantFrom(...INFO_TIP_KEYS), (key) => {
        const tip = tipFor(key, true)
        expect(tip).not.toBeNull()
        expect(tip!.trim().length).toBeGreaterThan(0)
        const n = countSentences(tip!)
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(2)
      }),
      { numRuns: 100 },
    )
  })

  it('has a journal-<id> key for every journal tab in Journal.tsx', () => {
    // **Validates: Requirements 5.1, 5.7**
    const ids = journalTabIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(INFO_TIP_KEYS).toContain(`journal-${id}`)
  })

  it('the coins tip mentions the vending machine', () => {
    expect(INFO_TIPS['hud-coins'].toLowerCase()).toContain('vending machine')
  })
})

describe('placeTooltip', () => {
  const viewportArb = fc.record({ width: fc.integer({ min: 640, max: 1920 }), height: fc.integer({ min: 480, max: 1080 }) })

  // Feature: 11-horror-pass, Property 19: Info tips completeness (placement part)
  it('stays inside the viewport and clear of the HUD rects (property)', () => {
    // **Validates: Requirements 5.9, 5.10**
    fc.assert(
      fc.property(
        viewportArb,
        fc.record({ width: fc.integer({ min: 100, max: 320 }), height: fc.integer({ min: 40, max: 140 }) }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        // The HUD column sits at the bottom left; keep it in the lower-left region.
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 40 }),
            y: fc.integer({ min: 340, max: 420 }),
            width: fc.integer({ min: 40, max: 280 }),
            height: fc.integer({ min: 10, max: 60 }),
          }),
          { maxLength: 3 },
        ),
        (viewport, size, fx, fy, avoid) => {
          const anchor: Rect = { x: fx * (viewport.width - 24), y: fy * (viewport.height - 24), width: 24, height: 24 }
          const p = placeTooltip(anchor, size, viewport, avoid)
          expect(p.x).toBeGreaterThanOrEqual(0)
          expect(p.y).toBeGreaterThanOrEqual(0)
          expect(p.x + size.width).toBeLessThanOrEqual(viewport.width)
          expect(p.y + size.height).toBeLessThanOrEqual(viewport.height)
          const r = { ...p, ...size }
          for (const a of avoid) {
            const hit = r.x < a.x + a.width && a.x < r.x + r.width && r.y < a.y + a.height && a.y < r.y + r.height
            expect(hit).toBe(false)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('puts the tooltip below the dot when there is room', () => {
    const p = placeTooltip({ x: 400, y: 100, width: 20, height: 20 }, { width: 200, height: 60 }, { width: 800, height: 600 }, [])
    expect(p.y).toBe(128)
  })
})
