import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import { OBJECTIVE_MAX_LINE } from '../../data/objectiveRules'
import { FIXED_SPAWNS } from '../../data/zones'
import {
  composeSecondLine,
  formatClock,
  selectObjective,
  type ObjectiveInput,
  type Vec3,
} from './objective'

const RUNS = { numRuns: 100 }

const vec3Arb: fc.Arbitrary<Vec3> = fc.tuple(
  fc.double({ min: -80, max: 80, noNaN: true }),
  fc.constant(0),
  fc.double({ min: -80, max: 80, noNaN: true }),
)

const inputArb: fc.Arbitrary<ObjectiveInput> = fc.record({
  phase: fc.constantFrom('day', 'dusk', 'night', 'dawn'),
  nightNumber: fc.integer({ min: 1, max: 5 }),
  secondsLeft: fc.double({ min: -50, max: 400, noNaN: true }),
  waves: fc.record({
    running: fc.boolean(),
    index: fc.integer({ min: -2, max: 9 }),
    total: fc.integer({ min: 1, max: 6 }),
    zombiesLeft: fc.integer({ min: -3, max: 30 }),
  }),
  rite: fc.record({ available: fc.boolean(), running: fc.boolean(), craneAlive: fc.boolean() }),
  progress: fc.record({
    page1Read: fc.boolean(),
    cryptKey: fc.boolean(),
    whistle: fc.boolean(),
    stairRevealed: fc.boolean(),
    ossuaryKey: fc.boolean(),
    relics: fc.integer({ min: 0, max: 5 }),
  }),
  relicSites: fc.array(vec3Arb, { maxLength: 5 }),
  playerPos: vec3Arb,
})

const dayArb = inputArb.map((i) => ({ ...i, phase: 'day' as const }))

/** Reference: a flat list of (condition, rule) pairs, scanned for the lowest match. */
const referenceRule = (i: ObjectiveInput): number => {
  const night = i.phase === 'night'
  const day = i.phase === 'day'
  const p = i.progress
  const conds: boolean[] = [
    night && i.waves.running,
    night && i.nightNumber === 5 && i.rite.available,
    night && i.nightNumber === 5 && i.rite.running && i.rite.craneAlive,
    i.phase === 'dusk',
    day && !p.page1Read,
    day && !p.cryptKey,
    day && !p.whistle,
    day && !p.stairRevealed,
    day && !p.ossuaryKey,
    day && p.relics < 5,
  ]
  const idx = conds.findIndex(Boolean)
  return idx === -1 ? 11 : idx + 1
}

describe('objective', () => {
  it('Feature: 06-clarity-and-hud, Property 11: Objective selector is total, idempotent and first-match', () => {
    // Validates: Requirements 3.2, 3.3, 3.4, 3.14, 3.15
    fc.assert(
      fc.property(inputArb, (i) => {
        const a = selectObjective(i)
        expect(a.rule).toBeGreaterThanOrEqual(1)
        expect(a.rule).toBeLessThanOrEqual(11)
        expect(selectObjective(i)).toEqual(a)
        expect(a.rule).toBe(referenceRule(i))
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 12: Objective text shape', () => {
    // Validates: Requirements 3.1, 3.5, 3.6, 3.7, 3.8
    fc.assert(
      fc.property(inputArb, (i) => {
        const o = selectObjective(i)
        expect(o.main.length).toBeLessThanOrEqual(OBJECTIVE_MAX_LINE)
        expect(o.second.length).toBeLessThanOrEqual(OBJECTIVE_MAX_LINE)
        const progress = /\((\d+)\/(\d+)\)$/.exec(o.main)
        if (progress) {
          const r = Number(progress[1])
          expect(r).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThanOrEqual(Number(progress[2]))
          expect(['1', '5']).toContain(progress[2])
        }
        if (o.rule === 1) {
          const m = /^Survive: Wave (\d+) of (\d+)$/.exec(o.main)
          expect(m).not.toBeNull()
          expect(Number(m![1])).toBeGreaterThanOrEqual(1)
          expect(Number(m![1])).toBeLessThanOrEqual(Number(m![2]))
          expect(Number(m![2])).toBe(i.waves.total)
          const k = /^Zombies left: (\d+)$/.exec(o.second)
          expect(k).not.toBeNull()
          expect(Number(k![1])).toBeGreaterThanOrEqual(0)
        }
        const clock = /(\d+:\d\d)$/.exec(o.second)
        if (o.rule === 4) expect(o.second).toMatch(/^Night falls in \d+:[0-5]\d$/)
        if (o.rule >= 5 && o.rule <= 11) expect(o.second).toMatch(/^Dusk in \d+:[0-5]\d$/)
        if (clock) expect(clock[1]).toMatch(/^\d+:[0-5]\d$/)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 13: Objective position', () => {
    // Validates: Requirements 3.13
    fc.assert(
      fc.property(inputArb, (i) => {
        const o = selectObjective(i)
        if (o.rule === 1 || o.rule === 4 || o.rule === 11) {
          expect(o.position).toBeUndefined()
        } else if (o.rule === 10) {
          expect(o.position !== undefined).toBe(i.relicSites.length > 0)
          if (o.position) {
            const d = (s: Vec3) => (s[0] - i.playerPos[0]) ** 2 + (s[2] - i.playerPos[2]) ** 2
            const best = Math.min(...i.relicSites.map(d))
            expect(d(o.position)).toBe(best)
          }
        } else {
          expect(o.position).toBeDefined()
        }
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 14: Collecting an item advances the day objective', () => {
    // Validates: Requirements 3.12
    const collects: ((i: ObjectiveInput) => ObjectiveInput)[] = [
      (i) => ({ ...i, progress: { ...i.progress, cryptKey: true } }),
      (i) => ({ ...i, progress: { ...i.progress, whistle: true } }),
      (i) => ({ ...i, progress: { ...i.progress, ossuaryKey: true } }),
      (i) => ({ ...i, progress: { ...i.progress, relics: Math.min(5, i.progress.relics + 1) } }),
    ]
    fc.assert(
      fc.property(dayArb, fc.constantFrom(...collects), (i, collect) => {
        expect(selectObjective(collect(i)).rule).toBeGreaterThanOrEqual(selectObjective(i).rule)
      }),
      RUNS,
    )
  })

  it('Feature: 06-clarity-and-hud, Property 15: Tutorial prompt replaces the countdown', () => {
    // Validates: Requirements 3.9, 4.11
    fc.assert(
      fc.property(inputArb, fc.string({ minLength: 1, maxLength: 40 }), (i, prompt) => {
        const o = selectObjective(i)
        expect(composeSecondLine(o, prompt)).toBe(prompt)
        expect(composeSecondLine(o, null)).toBe(o.second)
      }),
      RUNS,
    )
  })

  describe('examples', () => {
    const base: ObjectiveInput = {
      phase: 'day',
      nightNumber: 1,
      secondsLeft: 192,
      waves: { running: false, index: 1, total: 2, zombiesLeft: 0 },
      rite: { available: false, running: false, craneAlive: false },
      progress: {
        page1Read: false,
        cryptKey: false,
        whistle: false,
        stairRevealed: false,
        ossuaryKey: false,
        relics: 0,
      },
      relicSites: [],
      playerPos: [0, 0, 0],
    }

    it('shows the first objective with its place', () => {
      const o = selectObjective(base)
      expect(o.main).toBe('Read the page Elias left in the hut (0/1)')
      expect(o.second).toBe('Dusk in 3:12')
      expect(o.position).toEqual(FIXED_SPAWNS.find((f) => f.id === 'fx-page-1')?.position)
    })

    it('uses the fallback rule when everything is done', () => {
      const done = {
        page1Read: true,
        cryptKey: true,
        whistle: true,
        stairRevealed: true,
        ossuaryKey: true,
        relics: 5,
      }
      expect(selectObjective({ ...base, progress: done }).main).toBe('Hold out until the fifth night')
    })

    it('rite rules point at the altar and carry a second line', () => {
      const night5 = { ...base, phase: 'night' as const, nightNumber: 5 }
      const r2 = selectObjective({
        ...night5,
        rite: { available: true, running: false, craneAlive: false },
        progress: { ...base.progress, relics: 3 },
      })
      expect(r2.main).toBe('Finish the rite at the altar (3/5)')
      expect(r2.second.length).toBeGreaterThan(0)
      expect(r2.position).toEqual(CHAPEL_ALTAR)
      const r3 = selectObjective({
        ...night5,
        rite: { available: false, running: true, craneAlive: true },
      })
      expect(r3.rule).toBe(3)
      expect(r3.second.length).toBeGreaterThan(0)
    })

    it('formats clocks and never goes negative', () => {
      expect(formatClock(30)).toBe('0:30')
      expect(formatClock(192)).toBe('3:12')
      expect(formatClock(-5)).toBe('0:00')
      expect(formatClock(Number.NaN)).toBe('0:00')
    })
  })
})
