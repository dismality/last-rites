import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { STAGE_DAY_RULES } from '../../data/objectiveRules'
import { NIGHT_RELIC_WHY, selectObjective, type ObjectiveInput, type Vec3 } from './objective'

// Playtest, 2026-11-28: a player was stuck on "Gather the relics (1/5)" with no marker at all. This
// guards the rule that no day step of any stage ever leaves the player with nowhere to go: the
// objective either points somewhere, or (once every step is done) says plainly what to do next.

const point: fc.Arbitrary<Vec3> = fc.tuple(
  fc.integer({ min: -80, max: 80 }),
  fc.constant(0),
  fc.integer({ min: -80, max: 80 }),
)

const base = (stage: 1 | 2 | 3, doneUpTo: number, relicSites: Vec3[], nightRelicSites: Vec3[], player: Vec3): ObjectiveInput => ({
  phase: 'day',
  nightNumber: stage,
  secondsLeft: 200,
  waves: { running: false, index: 1, total: 1, zombiesLeft: 0 },
  rite: { available: false, running: false, craneAlive: false },
  progress: { page1Read: true, cryptKey: true, whistle: true, stairRevealed: true, ossuaryKey: true, relics: 0 },
  relicSites,
  nightRelicSites,
  playerPos: player,
  story: true,
  stage: {
    stage,
    curseLinks: 0,
    altarLockedS: 0,
    linksTotal: 3,
    day: STAGE_DAY_RULES[stage].map((_, k) => ({ count: 0, done: k < doneUpTo })),
  },
})

describe('day guidance never leaves the player without a next step', () => {
  it('every unfinished day step points somewhere, and a finished day says what to do', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<1 | 2 | 3>(1, 2, 3),
        fc.nat({ max: 8 }),
        fc.array(point, { maxLength: 4 }),
        fc.array(point, { maxLength: 1 }),
        point,
        (stage, upTo, relicSites, nightSites, player) => {
          const steps = STAGE_DAY_RULES[stage].length
          const doneUpTo = Math.min(upTo, steps)
          const relicStep = doneUpTo === steps - 1 && STAGE_DAY_RULES[stage][doneUpTo].place.kind === 'nearest-relic'
          // A relic is still missing at the relic step, so it lies out by day or by night.
          if (relicStep && relicSites.length === 0 && nightSites.length === 0) nightSites = [player]
          const o = selectObjective(base(stage, doneUpTo, relicSites, nightSites, player))
          expect(o.main.length).toBeGreaterThan(0)
          if (doneUpTo < steps) expect(o.position, `stage ${stage} step ${doneUpTo + 1}`).toBeDefined()
          else expect(o.position !== undefined || (o.why ?? '').length > 0).toBe(true)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('with only the night relic left, the relic step points at it and says to come back after dusk', () => {
    const grave: Vec3 = [-60, 0, 10]
    const steps = STAGE_DAY_RULES[3].length
    const o = selectObjective(base(3, steps - 1, [], [grave], [0, 0, 0]))
    expect(o.position).toEqual(grave)
    expect(o.why).toBe(NIGHT_RELIC_WHY)
  })
})
