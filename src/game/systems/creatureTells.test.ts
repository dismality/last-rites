import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CAPTIONS } from '../../data/captions'
import { CREATURE_SOUNDS, type CreatureId } from '../../data/creatures'
import { createRng } from '../rng'
import { createBride, brideTouch, spawnBride, stepBride } from './bride'
import { createCrawler, stepCrawler } from './crawler'
import { soundsFor, tellElapsed, tellLead } from './creatureTells'
import { createPack, stepPack } from './hounds'

const DT = 1 / 60
const IDS: CreatureId[] = ['crawler', 'bride', 'hound']

describe('tellLead', () => {
  it('is always within 0.5 to 1.5 s', () => {
    // Feature: 11-horror-pass, Property 9: Creature tells precede attacks
    // **Validates: Requirements 2.14, 2.15**
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed)
        for (let i = 0; i < 20; i++) {
          const lead = tellLead(rng)
          expect(lead).toBeGreaterThanOrEqual(0.5)
          expect(lead).toBeLessThanOrEqual(1.5)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('handles the extremes of the stream', () => {
    expect(tellLead(() => 0)).toBe(0.5)
    expect(tellLead(() => 0.999999)).toBeLessThanOrEqual(1.5)
  })
})

describe('creature sounds', () => {
  it('give every creature a tell and an attack sound, each with a caption', () => {
    for (const id of IDS) {
      const s = soundsFor(id)
      expect(s).toBe(CREATURE_SOUNDS[id])
      for (const sound of [s.tell, s.attack]) expect(CAPTIONS.some((c) => c.event === sound)).toBe(true)
    }
  })
})

describe('Property 9: no creature damage applies before its tell lead has run', () => {
  const seedArb = fc.integer()

  it('crawler', () => {
    // Feature: 11-horror-pass, Property 9: Creature tells precede attacks
    // **Validates: Requirements 2.15**
    fc.assert(
      fc.property(seedArb, (seed) => {
        const rng = createRng(seed)
        let c = createCrawler({ x: 0, z: 0 })
        let tell: { at: number; lead: number } | null = null
        for (let i = 0; i < 900; i++) {
          const t = i * DT
          const r = stepCrawler(c, { x: 1, z: 0 }, DT, rng)
          c = r.crawler
          for (const e of r.events) {
            if (e.type === 'tell') tell = { at: t, lead: e.lead }
            if (e.type === 'grab') {
              expect(tell).not.toBeNull()
              expect(tellElapsed(tell!.at, tell!.lead - DT, t)).toBe(true)
            }
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('bride', () => {
    // Feature: 11-horror-pass, Property 9: Creature tells precede attacks
    // **Validates: Requirements 2.15**
    fc.assert(
      fc.property(seedArb, (seed) => {
        const rng = createRng(seed)
        let b = spawnBride(createBride(), { stage: 2 }, { x: 8, z: 0 })
        let tell: { at: number; lead: number } | null = null
        for (let i = 0; i < 900 && b.alive; i++) {
          const t = i * DT
          const r = stepBride(b, { x: 0, z: 0 }, DT, rng)
          b = r.bride
          for (const e of r.events) {
            if (e.type === 'tell') tell = { at: t, lead: e.lead }
            if (e.type === 'touch') {
              expect(tell).not.toBeNull()
              expect(tellElapsed(tell!.at, tell!.lead - DT, t)).toBe(true)
              b = brideTouch(b, 100, rng).bride
            }
          }
        }
        expect(b.alive).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('hound', () => {
    // Feature: 11-horror-pass, Property 9: Creature tells precede attacks
    // **Validates: Requirements 2.15**
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 2, max: 3 }), (seed, size) => {
        const rng = createRng(seed)
        const player = { x: 0, z: 0 }
        let pack = createPack(player, size, rng)
        const tells = new Map<string, { at: number; lead: number }>()
        let bites = 0
        for (let i = 0; i < 1800; i++) {
          const t = i * DT
          const r = stepPack(pack, player, null, DT, rng)
          pack = r.pack
          for (const e of r.events) {
            if (e.type === 'tell') tells.set(e.houndId, { at: t, lead: e.lead })
            if (e.type === 'bite') {
              bites++
              const tell = tells.get(e.houndId)
              expect(tell).toBeDefined()
              expect(tellElapsed(tell!.at, tell!.lead - DT, t)).toBe(true)
            }
          }
        }
        expect(bites).toBeGreaterThan(0)
      }),
      { numRuns: 100 },
    )
  })
})
