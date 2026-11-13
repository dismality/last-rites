import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { createRng } from '../rng'
import { SCARE_ZONES } from '../../data/scares'
import {
  FIRST_SCARE_ZONE_ID,
  MAJOR_COOLDOWN_S,
  MAX_CHANCE,
  capScareDamage,
  createScareDirectorState,
  intensityProfile,
  scareChance,
  tickScares,
  type ScareContext,
} from './scareDirector'
import { SCARE_EVENT_MAP } from '../../data/scares'

const baseCtx: ScareContext = {
  enteredZones: [],
  lanternFuel: 100,
  phase: 'day',
  nearCandle: false,
  uiBlocking: false,
  intensity: 'full',
}

const zoneIds = SCARE_ZONES.map((z) => z.id)
const stepArb = fc.record({
  dt: fc.double({ min: 0, max: 30, noNaN: true }),
  zones: fc.array(fc.constantFrom(...zoneIds), { maxLength: 3 }),
  fuel: fc.integer({ min: 0, max: 100 }),
  phase: fc.constantFrom('day', 'dusk', 'night', 'dawn' as const),
  nearCandle: fc.boolean(),
  uiBlocking: fc.boolean(),
  dig: fc.boolean(),
})

type Step = typeof stepArb extends fc.Arbitrary<infer T> ? T : never

function run(seed: number, steps: Step[]) {
  const rng = createRng(seed)
  let state = createScareDirectorState()
  const log: { ui: boolean; cues: ReturnType<typeof tickScares>['cues']; zones: string[] }[] = []
  for (const s of steps) {
    const r = tickScares(
      state,
      s.dt,
      {
        ...baseCtx,
        enteredZones: s.zones,
        lanternFuel: s.fuel,
        phase: s.phase,
        nearCandle: s.nearCandle,
        uiBlocking: s.uiBlocking,
        digCompleted: s.dig,
      },
      rng,
    )
    state = r.state
    log.push({ ui: s.uiBlocking, cues: r.cues, zones: s.zones })
  }
  return log
}

describe('scareDirector', () => {
  it('first scare is statue-turn in the first grounds zone; other zones stay quiet before it', () => {
    const rng = createRng(1)
    const quiet = tickScares(
      createScareDirectorState(),
      1,
      { ...baseCtx, enteredZones: ['row-alley-middle'] },
      rng,
    )
    expect(quiet.cues).toHaveLength(0)
    const first = tickScares(
      quiet.state,
      1,
      { ...baseCtx, enteredZones: [FIRST_SCARE_ZONE_ID] },
      rng,
    )
    expect(first.cues.map((c) => [c.eventId, c.phase])).toEqual([
      ['statue-turn', 'telegraph'],
      ['statue-turn', 'beat'],
    ])
    expect(first.cues[1].at - first.cues[0].at).toBeGreaterThanOrEqual(0.5)
  })

  it('uiBlocking suppresses rolls and does not queue them', () => {
    const rng = createRng(1)
    const blocked = tickScares(
      createScareDirectorState(),
      1,
      { ...baseCtx, enteredZones: [FIRST_SCARE_ZONE_ID], uiBlocking: true },
      rng,
    )
    expect(blocked.cues).toHaveLength(0)
    expect(blocked.state.firstScareDone).toBe(false)
    expect(tickScares(blocked.state, 1, baseCtx, rng).cues).toHaveLength(0)
  })

  it('digCompleted rolls hand-from-grave at 20% by day and 40% by night', () => {
    const count = (phase: 'day' | 'night') => {
      let hits = 0
      for (let i = 0; i < 2000; i++) {
        const rng = createRng(i)
        const state = { ...createScareDirectorState(), firstScareDone: true }
        const r = tickScares(state, 1, { ...baseCtx, phase, digCompleted: true }, rng)
        if (r.cues.some((c) => c.eventId === 'hand-from-grave')) hits++
      }
      return hits / 2000
    }
    expect(count('day')).toBeGreaterThan(0.16)
    expect(count('day')).toBeLessThan(0.24)
    expect(count('night')).toBeGreaterThan(0.36)
    expect(count('night')).toBeLessThan(0.44)
  })

  it('intensity profiles scale down and Off keeps the subtitle', () => {
    expect(intensityProfile('full').stingerVolume).toBe(1)
    expect(intensityProfile('reduced')).toMatchObject({ stingerVolume: 0.4, cameraShake: false })
    expect(intensityProfile('off')).toMatchObject({
      stingerVolume: 0,
      cameraShake: false,
      subtitle: 'always',
    })
  })

  it('scare damage never reduces health to 0', () => {
    expect(capScareDamage(20, 50)).toBe(19)
    expect(capScareDamage(1, 20)).toBe(0)
  })

  it('every beat follows its telegraph by 0.5-1.5 s', () => {
    for (const id of zoneIds) {
      const state = { ...createScareDirectorState(), firstScareDone: true }
      const r = tickScares(
        state,
        1,
        { ...baseCtx, enteredZones: [id], lanternFuel: 0, phase: 'night' },
        createRng(5),
      )
      for (let i = 0; i < r.cues.length; i += 2) {
        const lead = r.cues[i + 1].at - r.cues[i].at
        expect(lead).toBeGreaterThanOrEqual(0.5)
        expect(lead).toBeLessThanOrEqual(1.5)
      }
    }
  })
  describe('properties', () => {
    it('chance stays within [0, 0.95]', () => {
      // **Validates: Requirements 4.1**
      fc.assert(
        fc.property(
          fc.double({ min: -50, max: 200, noNaN: true }),
          fc.constantFrom('day', 'dusk', 'night', 'dawn' as const),
          fc.boolean(),
          (fuel, phase, candle) => {
            const c = scareChance(fuel, phase, candle)
            return c >= 0 && c <= MAX_CHANCE
          },
        ),
      )
    })

    it('major scares are at least 45 s apart, minor at least 15 s, and none fire while uiBlocking', () => {
      // **Validates: Requirements 4.2, 4.6**
      fc.assert(
        fc.property(fc.integer(), fc.array(stepArb, { maxLength: 60 }), (seed, steps) => {
          const log = run(seed, steps)
          const telegraphs = log.flatMap((l) => l.cues).filter((c) => c.phase === 'telegraph')
          const lastAt: { major?: number; minor?: number } = {}
          for (const c of telegraphs) {
            const key = SCARE_EVENT_MAP[c.eventId].tier === 'major' ? 'major' : 'minor'
            const gap = key === 'major' ? MAJOR_COOLDOWN_S : 15
            const prev = lastAt[key]
            if (prev !== undefined && c.at - prev < gap) return false
            lastAt[key] = c.at
          }
          return log.every((l) => !l.ui || l.cues.length === 0)
        }),
        { numRuns: 200 },
      )
    })

    it('a zone never repeats the same event consecutively', () => {
      // **Validates: Requirements 4.3**
      fc.assert(
        fc.property(
          fc.integer(),
          fc.array(
            fc.record({
              zone: fc.constantFrom(...zoneIds),
              dt: fc.double({ min: 0, max: 60, noNaN: true }),
            }),
            { maxLength: 80 },
          ),
          (seed, steps) => {
            const rng = createRng(seed)
            let state = { ...createScareDirectorState(), firstScareDone: true }
            const lastByZone = new Map<string, string>()
            for (const s of steps) {
              const r = tickScares(
                state,
                s.dt,
                { ...baseCtx, enteredZones: [s.zone], phase: 'night' },
                rng,
              )
              state = r.state
              const fired = r.cues.find((c) => c.phase === 'telegraph')
              if (fired) {
                if (lastByZone.get(s.zone) === fired.eventId) return false
                lastByZone.set(s.zone, fired.eventId)
              }
            }
            return true
          },
        ),
        { numRuns: 200 },
      )
    })
  })
})

describe('no lurker lunge by day (spec 10)', () => {
  const lungeZones = SCARE_ZONES.filter((z) => z.events.includes('lurker-lunge')).map((z) => z.id)

  it('Property 5: a day roll never yields lurker-lunge', () => {
    // Feature: 10-curse-stages, Property 5: No zombie and no lurker lunge by day
    // **Validates: Requirements 6.1, 6.9**
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed)
        let state = { ...createScareDirectorState(), firstScareDone: true }
        for (let i = 0; i < 80; i++) {
          const r = tickScares(state, 50, { ...baseCtx, phase: 'day', enteredZones: lungeZones }, rng)
          state = r.state
          r.cues.forEach((c) => expect(c.eventId).not.toBe('lurker-lunge'))
        }
      }),
      { numRuns: 100 },
    )
  })

  it('still allows lurker-lunge at night', () => {
    let seen = false
    for (let seed = 0; seed < 60 && !seen; seed++) {
      const rng = createRng(seed)
      let state = { ...createScareDirectorState(), firstScareDone: true }
      for (let i = 0; i < 40; i++) {
        const r = tickScares(state, 50, { ...baseCtx, phase: 'night', enteredZones: lungeZones }, rng)
        state = r.state
        if (r.cues.some((c) => c.eventId === 'lurker-lunge')) seen = true
      }
    }
    expect(seen).toBe(true)
  })
})
