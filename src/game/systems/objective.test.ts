import { CASE_2_LOCKER_POSITION, CASE_3_CRYPT_PROPS } from '../../data/cases'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import {
  CASE_ALTAR_LINE,
  CASE_LINK_LINE,
  JOURNAL_KEY_LINES,
  JOURNAL_KEY_WORD,
  OBJECTIVE_MAX_LINE,
  STAGE_DAY_RULES,
} from '../../data/objectiveRules'
import { FIXED_SPAWNS } from '../../data/zones'
import { buildCompassMarkers } from './compass'
import {
  stageReadyForDusk,
  composeSecondLine,
  formatClock,
  selectObjective,
  type ObjectiveInput,
  type Vec3,
  journalKeyWord,
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

describe('selectObjective in story stages (spec 10)', () => {
  const stageArb = fc.record({
    stage: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    curseLinks: fc.integer({ min: -2, max: 14 }),
    altarLockedS: fc.integer({ min: 0, max: 30 }),
  })
  const stageInputArb = fc.tuple(inputArb, stageArb).map(([i, stage]) => ({ ...i, stage }))

  it('Feature: 10-curse-stages, Property 26: Objective follows the rule table', () => {
    // **Validates: Requirements 6.2-6.7**
    fc.assert(
      fc.property(stageInputArb, (i) => {
        const o = selectObjective(i)
        const riteOnLastStage = i.phase === 'night' && i.stage.stage === 3 && (i.rite.available || i.rite.running)
        if (i.phase === 'night' && !riteOnLastStage) {
          // Night, before the rite: the curse line, never a wave count.
          expect(o.rule).toBe(1)
          expect(o.main).toBe('The curse holds. Solve the case at the altar.')
          expect(o.main).not.toMatch(/Wave|Zombies left/)
          expect(o.curse?.max).toBe(10)
          expect(o.curse?.value).toBeGreaterThanOrEqual(0)
          expect(o.curse?.value).toBeLessThanOrEqual(10)
          expect(o.position).toEqual(CHAPEL_ALTAR)
          if (i.stage.altarLockedS > 0) expect(o.second).toMatch(/^The altar is silent: \d+:\d\d$/)
          else expect(o.second).toBe('')
        } else if (i.phase === 'day' && o.rule === 11) {
          expect(o.main).toMatch(/^Solve the case: /)
        }
        // Only the night curse line carries the meter.
        expect(o.curse !== undefined).toBe(o.rule === 1)
        expect(selectObjective(i)).toEqual(o)
      }),
      RUNS,
    )
  })

  it('the meter falls one per link and stops at zero', () => {
    const base = fc.sample(stageInputArb, 1)[0]
    const at = (curseLinks: number) =>
      selectObjective({ ...base, phase: 'night', stage: { stage: 1, curseLinks, altarLockedS: 0 } }).curse?.value
    expect([at(0), at(3), at(10), at(25)]).toEqual([10, 7, 0, 0])
  })

  it('shows the altar-locked line with a m:ss clock', () => {
    const base = fc.sample(inputArb, 1)[0]
    const o = selectObjective({ ...base, phase: 'night', stage: { stage: 2, curseLinks: 0, altarLockedS: 24 } })
    expect(o.second).toBe('The altar is silent: 0:24')
  })

  it('names the case and its clue count by day once nothing else is missing', () => {
    const base = fc.sample(inputArb, 1)[0]
    const day = {
      ...base,
      phase: 'day' as const,
      needsWeapon: false,
      progress: { page1Read: true, cryptKey: true, whistle: true, stairRevealed: true, ossuaryKey: true, relics: 5 },
    }
    const o = selectObjective({ ...day, stage: { stage: 1, curseLinks: 0, altarLockedS: 0, clues: { found: 2, total: 7 } } })
    expect(o.main).toBe('Solve the case: Saved by the Bell, clues 2/7')
  })

  it('by day shows the first unfinished step of the stage, with its count and place (§11)', () => {
    const base = fc.sample(inputArb, 1)[0]
    const day = {
      ...base,
      phase: 'day' as const,
      needsWeapon: false,
      story: true,
      progress: { page1Read: true, cryptKey: true, whistle: false, stairRevealed: false, ossuaryKey: false, relics: 0 },
    }
    const st = (stage: 1 | 2 | 3, steps: { count: number; done: boolean; at?: readonly (readonly [number, number, number])[] }[]) =>
      selectObjective({ ...day, stage: { stage, curseLinks: 0, altarLockedS: 0, clues: { found: 1, total: 6 }, day: steps } })
    const open = { count: 0, done: false }
    const done = { count: 1, done: true }
    // Stage 2: the Row gate first (the altar gave its key at the end of Case 1).
    const o7 = () => [open, open, open, open, open, open, open]
    const upTo = (n: number) => o7().map((x, i) => (i < n ? done : x))
    const gate = st(2, o7())
    expect(gate.main).toBe('Open the Mausoleum Row gate (0/1)')
    expect(gate.areaM).toBeUndefined()
    // Then the three fresh graves, pointing at the nearest one not yet seen.
    const far: [number, number, number] = [99, 0, 99]
    const s2 = upTo(1)
    s2[1] = { count: 1, done: false, at: [far, base.playerPos] } as never
    const graves = st(2, s2)
    expect(graves.main).toBe('Look at the three fresh graves by the lodge (1/3)')
    expect(graves.position).toEqual(base.playerPos)
    expect(st(2, upTo(2)).main).toBe('Check the fresh graves against the register (0/3)')
    expect(st(2, upTo(3)).main).toBe('Read the watch log for the night of the 14th (0/1)')
    expect(st(2, upTo(4)).main).toBe('Take the boot print at Arthur Finch’s grave (0/1)')
    expect(st(2, upTo(5)).main).toBe('Compare the boots by the lodge with the print (0/1)')
    const o = st(2, upTo(6))
    expect(o.main).toBe('Open Kerr’s locker (0/1)')
    expect(o.marker).toBe('Locker')
    expect(o.position).toEqual(CASE_2_LOCKER_POSITION)
    expect(st(2, upTo(7)).main).toBe('Solve the case: The Resurrection Men, clues 1/6')
    // Stage 1: the three stones, the ledger, then the bell cords.
    expect(st(1, [{ count: 1, done: false }, open, open]).main).toBe('Read the stones of Pell, Ames and Hale (1/3)')
    expect(st(1, [done, { count: 2, done: false }, open]).main).toBe('Check the ledger against the stones (2/3)')
    expect(st(1, [done, done, { count: 2, done: false }]).main).toBe('Pull the bell cords at the three graves (2/3)')
    // All three pulled but the journal question not yet answered: say what is left, not a stuck 3/3.
    expect(st(1, [done, done, { count: 3, done: false }]).main).toBe('In your journal: which bell was cut?')
    // Stage 3: the hymn board, the ruts, the crypt pin, Elias, the handwriting, the relics.
    expect(st(3, [done, open, open, open, open, open]).main).toBe('Follow the cart ruts from the Row gate (0/1)')
    const pin = st(3, [done, done, open, open, open, open])
    expect(pin.main).toBe('Open the Crane crypt door (0/1)')
    expect(pin.position).toEqual(CASE_3_CRYPT_PROPS.pin)
    expect(st(3, [done, done, done, open, open, open]).main).toBe('Search Elias (0/1)')
    expect(st(3, [done, done, done, done, { count: 2, done: false }, open]).main).toBe('In your journal: compare the handwriting (2/4)')
    expect(st(3, [done, done, done, done, done, { count: 3, done: false }]).main).toBe('Gather the relics of the rite (3/5)')
    // The weapon rule keeps the step on its second line; night keeps the curse line.
    const armed = selectObjective({
      ...day,
      needsWeapon: true,
      secondsLeft: 30,
      stage: { stage: 2, curseLinks: 0, altarLockedS: 0, day: [done, done, open, open, open, open, open] },
    })
    expect(armed.second).toBe('Check the fresh graves against the register (0/3)')
    const night = selectObjective({ ...day, phase: 'night', stage: { stage: 2, curseLinks: 0, altarLockedS: 0, day: [open, open, open] } })
    expect(night.rule).toBe(1)
  })

  it('once the day steps are done, leads to the case board and then the altar', () => {
    const base = fc.sample(inputArb, 1)[0]
    const day = {
      ...base,
      phase: 'day' as const,
      needsWeapon: false,
      story: true,
      progress: { page1Read: true, cryptKey: true, whistle: false, stairRevealed: false, ossuaryKey: false, relics: 0 },
    }
    const done = { count: 1, done: true }
    const steps = [done, done, done, done, done, done]
    const at = (curseLinks: number) =>
      selectObjective({ ...day, stage: { stage: 3, curseLinks, altarLockedS: 0, linksTotal: 5, day: steps } })
    expect(at(2).main).toBe('Link clues on the case board in your journal (2/5)')
    expect(at(2).position).toBeUndefined()
    expect(at(2).why).toMatch(/curse/)
    const altar = at(5)
    expect(altar.main).toBe('At dusk, give your answer at the chapel altar')
    expect(altar.marker).toBe('Altar')
    expect(altar.position).toEqual(CHAPEL_ALTAR)
    // Still unarmed: the craft rule leads, the next case step sits on the second line.
    const armed = selectObjective({
      ...day,
      needsWeapon: true,
      secondsLeft: 30,
      stage: { stage: 3, curseLinks: 1, altarLockedS: 0, linksTotal: 5, day: steps },
    })
    expect(armed.second).toBe('Link clues on the case board in your journal (1/5)')
    // A case with no links (Case 1) goes straight to the altar, to type the name.
    const typed = selectObjective({ ...day, stage: { stage: 1, curseLinks: 0, altarLockedS: 0, linksTotal: 0, day: [done, done, done] } })
    expect(typed.main).toBe('At dusk, name who did it at the chapel altar')
    expect(typed.position).toEqual(CHAPEL_ALTAR)
    expect(stageReadyForDusk({ stage: 1, curseLinks: 0, altarLockedS: 0, linksTotal: 0, day: [done, done, done] })).toBe(true)
  })

  it('is ready for an early dusk only with every day step done and every clue linked', () => {
    const done = { count: 1, done: true }
    const open = { count: 0, done: false }
    const st = (day: { count: number; done: boolean }[], curseLinks: number) => ({ stage: 1 as const, curseLinks, altarLockedS: 0, linksTotal: 5, day })
    expect(stageReadyForDusk(st([done, done], 5))).toBe(true)
    expect(stageReadyForDusk(st([done, done], 4))).toBe(false)
    expect(stageReadyForDusk(st([done, open], 5))).toBe(false)
    expect(stageReadyForDusk({ stage: 1, curseLinks: 5, altarLockedS: 0 })).toBe(false)
  })

  it('shows the journal key under any objective that needs the journal', () => {
    expect(journalKeyWord({ main: CASE_LINK_LINE.replace('{n}', '1').replace('{m}', '5') })).toBe(JOURNAL_KEY_WORD)
    expect(journalKeyWord({ main: CASE_ALTAR_LINE })).toBe(JOURNAL_KEY_LINES[CASE_ALTAR_LINE])
    expect(journalKeyWord({ main: 'Gather the relics of the rite (0/5)', why: 'Journal pages 4 and 5 give the order.' })).toBe(
      JOURNAL_KEY_WORD,
    )
    expect(journalKeyWord({ main: 'Examine the three bells (0/3)', why: 'A cord rang a bell above.' })).toBeNull()
    // Every stage step that names the journal in its line or why line gets the key.
    for (const rules of Object.values(STAGE_DAY_RULES)) {
      for (const r of rules) {
        const names = /journal|case tab|case board/i.test(`${r.main} ${r.why}`)
        expect(journalKeyWord({ main: r.main, why: r.why }) !== null, r.main).toBe(names)
      }
    }
  })
})
