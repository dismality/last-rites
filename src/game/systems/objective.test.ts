import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import { OBJECTIVE_MAX_LINE } from '../../data/objectiveRules'
import { FIXED_SPAWNS } from '../../data/zones'
import { buildCompassMarkers } from './compass'
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
  const rite = night && i.nightNumber === 5
  // Rite rules (3, then 2) outrank the wave line (1); the rule ids stay as in the design bible.
  if (rite && i.rite.running && i.rite.craneAlive) return 3
  if (rite && (i.rite.available || i.rite.running)) return 2
  const conds: boolean[] = [
    night && i.waves.running,
    false,
    false,
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
      expect(selectObjective({ ...base, progress: done }).main).toBe(
        'Hold out until the fifth night',
      )
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

    describe('final rite (playtest fix 10.8)', () => {
      const night5 = {
        ...base,
        phase: 'night' as const,
        nightNumber: 5,
        waves: { running: true, index: 1, total: 5, zombiesLeft: 4 },
        progress: { ...base.progress, relics: 4 },
      }

      it('rite started and Crane alive: Put Father Crane to rest, never the wave line', () => {
        const o = selectObjective({
          ...night5,
          rite: { available: false, running: true, craneAlive: true },
        })
        expect(o.main).toBe('Put Father Crane to rest')
        expect(o.position).toEqual(CHAPEL_ALTAR)
      })

      it('rite started and Crane not risen or already dead: Finish the rite with relic count', () => {
        const o = selectObjective({
          ...night5,
          rite: { available: false, running: true, craneAlive: false },
        })
        expect(o.main).toBe('Finish the rite at the altar (4/5)')
        expect(o.position).toEqual(CHAPEL_ALTAR)
      })

      it('normal night 5 before the rite still shows the wave line', () => {
        const o = selectObjective({
          ...night5,
          rite: { available: false, running: false, craneAlive: false },
        })
        expect(o.main).toBe('Survive: Wave 1 of 5')
        expect(o.position).toBeUndefined()
      })

      it('the compass shows the objective marker at night during the rite', () => {
        const o = selectObjective({
          ...night5,
          rite: { available: false, running: true, craneAlive: true },
        })
        const markers = buildCompassMarkers({
          player: { x: 0, z: 0 },
          heading: 0,
          objective: o.position,
          phase: 'night',
          bellBuilt: false,
        })
        expect(markers.some((m) => m.id === 'objective')).toBe(true)
      })
    })

    it('formats clocks and never goes negative', () => {
      expect(formatClock(30)).toBe('0:30')
      expect(formatClock(192)).toBe('3:12')
      expect(formatClock(-5)).toBe('0:00')
      expect(formatClock(Number.NaN)).toBe('0:00')
    })
  })
})

describe('selectObjective in Endless', () => {
  it('never picks story rules (2, 3, 5-10) and shows the night number', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const o = selectObjective({ ...i, story: false })
        expect([1, 4, 11]).toContain(o.rule)
        expect(o.main).not.toMatch(/Elias|rite|Crane|Crypt|relic/i)
        if (o.rule === 1 || o.rule === 11) {
          expect(o.second.startsWith('Night ')).toBe(true)
        }
      }),
      RUNS,
    )
  })

  it('reads as plain survival across the phases', () => {
    const base = {
      phase: 'day',
      nightNumber: 7,
      secondsLeft: 72,
      waves: { running: false, index: 1, total: 4, zombiesLeft: 0 },
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
      story: false,
    } as const satisfies ObjectiveInput
    expect(selectObjective(base)).toMatchObject({
      main: 'Prepare for the night',
      second: 'Night 7 \u00b7 Dusk in 1:12',
    })
    expect(selectObjective({ ...base, phase: 'dusk' }).main).toBe('Prepare for the night')
    const night = selectObjective({
      ...base,
      phase: 'night',
      waves: { running: true, index: 2, total: 4, zombiesLeft: 5 },
    })
    expect(night).toMatchObject({
      main: 'Survive: Wave 2 of 4',
      second: 'Night 7 \u00b7 Zombies left: 5',
    })
  })
})

describe('rule 12: craft a weapon before dusk (spec 09, F1)', () => {
  it('property: shows exactly when it is a story day, no weapon is owned and dusk is under 2:00', () => {
    fc.assert(
      fc.property(inputArb, fc.boolean(), (i, needsWeapon) => {
        const o = selectObjective({ ...i, needsWeapon })
        const story = selectObjective({ ...i, needsWeapon: false })
        const expected =
          needsWeapon && i.phase === 'day' && story.rule >= 5 && i.secondsLeft < 120
        expect(o.rule === 12).toBe(expected)
        if (o.rule === 12) {
          expect(o.main).toBe('Craft a weapon at the workbench (0/1)')
          // The story objective it stands above moves to the second line.
          expect(o.second).toBe(story.main)
          expect(o.position).toBeDefined()
          expect(o.marker).toBe('Workbench')
        } else {
          expect(o).toEqual(story)
        }
      }),
      RUNS,
    )
  })

  it('never shows in Endless', () => {
    fc.assert(
      fc.property(dayArb, (i) => {
        expect(selectObjective({ ...i, story: false, needsWeapon: true, secondsLeft: 30 }).rule).not.toBe(12)
      }),
      RUNS,
    )
  })
})
