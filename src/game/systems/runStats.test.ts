import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LAST_NIGHT } from '../../data/balance'
import {
  createRunStats,
  finalizeStats,
  recordBanished,
  recordBoard,
  recordCoins,
  recordCombo,
  recordDig,
  recordKill,
  recordMeleeHit,
  recordNightSurvived,
  recordShot,
  recordTime,
  accuracyPercent,
  formatAccuracy,
  formatTime,
  parseStats,
  serializeStats,
  statRows,
  summaryRows,
  type RunStats,
} from './runStats'
import type { EnemyId } from '../../data/enemies'

describe('runStats', () => {
  it('counts banished zombies without mutating the input', () => {
    const s = createRunStats()
    expect(recordBanished(s).zombiesBanished).toBe(1)
    expect(s.zombiesBanished).toBe(0)
  })

  it('never lowers nights survived and clamps to the last night', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3, max: 12 }), fc.integer({ min: -3, max: 12 }), (a, b) => {
        const once = recordNightSurvived(createRunStats(), a)
        const twice = recordNightSurvived(once, b)
        expect(twice.nightsSurvived).toBeGreaterThanOrEqual(once.nightsSurvived)
        expect(twice.nightsSurvived).toBeLessThanOrEqual(LAST_NIGHT)
      }),
      { numRuns: 100 },
    )
  })

  it('finalizes every ending except taken as having survived the last night', () => {
    expect(finalizeStats(createRunStats(), 'rest').nightsSurvived).toBe(LAST_NIGHT)
    expect(finalizeStats(createRunStats(), 'uneasy-peace').nightsSurvived).toBe(LAST_NIGHT)
    expect(finalizeStats(createRunStats(), 'taken').nightsSurvived).toBe(0)
  })

  it('writes four summary rows', () => {
    const rows = summaryRows(
      { ...createRunStats(), nightsSurvived: 3, zombiesBanished: 17 },
      4,
      6,
      9,
    )
    expect(rows.map((r) => r.value)).toEqual([`3 of ${LAST_NIGHT}`, '17', '4 of 5', '6 of 9'])
  })
})

const ENEMY_IDS: EnemyId[] = ['shambler', 'lurker', 'wailer', 'bloater', 'brute', 'father-crane']

type Ev =
  | { t: 'kill'; id: EnemyId }
  | { t: 'shot'; hit: boolean }
  | { t: 'melee' }
  | { t: 'combo'; v: number }
  | { t: 'time'; dt: number }
  | { t: 'coins'; e: number; s: number }
  | { t: 'dig' }
  | { t: 'board' }

const evArb: fc.Arbitrary<Ev> = fc.oneof(
  fc.constantFrom(...ENEMY_IDS).map((id): Ev => ({ t: 'kill', id })),
  fc.boolean().map((hit): Ev => ({ t: 'shot', hit })),
  fc.constant<Ev>({ t: 'melee' }),
  fc.double({ min: 1, max: 3, noNaN: true }).map((v): Ev => ({ t: 'combo', v })),
  fc.double({ min: 0, max: 1, noNaN: true }).map((dt): Ev => ({ t: 'time', dt })),
  fc.record({ e: fc.nat(10), s: fc.nat(10) }).map(({ e, s }): Ev => ({ t: 'coins', e, s })),
  fc.constant<Ev>({ t: 'dig' }),
  fc.constant<Ev>({ t: 'board' }),
)

function apply(s: RunStats, e: Ev): RunStats {
  switch (e.t) {
    case 'kill':
      return recordKill(s, e.id)
    case 'shot':
      return recordShot(s, e.hit)
    case 'melee':
      return recordMeleeHit(s)
    case 'combo':
      return recordCombo(s, e.v)
    case 'time':
      return recordTime(s, e.dt)
    case 'coins':
      return recordCoins(s, e.e, e.s)
    case 'dig':
      return recordDig(s)
    case 'board':
      return recordBoard(s)
  }
}

const fold = (evs: Ev[]): RunStats => evs.reduce(apply, createRunStats())

describe('run stats properties', () => {
  // Feature: progression-and-atmosphere, Property 9: Repeated and unknown events are ignored
  it('Property 9: unknown or malformed events leave the stats unchanged', () => {
    /** Validates: Requirements 3.9 */
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 30 }), fc.anything(), (evs, junk) => {
        const s = fold(evs)
        const before = JSON.stringify(s)
        expect(recordKill(s, junk as EnemyId)).toBe(
          ENEMY_IDS.includes(junk as EnemyId) ? recordKill(s, junk as EnemyId) : s,
        )
        expect(recordCombo(s, junk as number)).toSatisfy(
          (r: RunStats) => r.bestCombo >= s.bestCombo,
        )
        recordTime(s, NaN)
        recordCoins(s, NaN, -4)
        expect(recordTime(s, NaN)).toBe(s)
        expect(recordCoins(s, Infinity, -4)).toBe(s)
        expect(JSON.stringify(s)).toBe(before)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: progression-and-atmosphere, Property 11: Run stats are consistent
  it('Property 11: run stats stay consistent over any event sequence', () => {
    /** Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.10 */
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 60 }), (evs) => {
        let s = createRunStats()
        let best = 0
        let time = 0
        for (const e of evs) {
          s = apply(s, e)
          expect(s.bestCombo).toBeGreaterThanOrEqual(best)
          best = s.bestCombo
          if (e.t === 'time') time += e.dt
          expect(s.shotsHit).toBeLessThanOrEqual(s.shotsFired)
        }
        const acc = accuracyPercent(s)
        expect(acc).toBeGreaterThanOrEqual(0)
        expect(acc).toBeLessThanOrEqual(100)
        expect(acc).toBe(s.shotsFired === 0 ? 0 : Math.floor((100 * s.shotsHit) / s.shotsFired))
        expect(Object.values(s.kills).reduce((a, b) => a + b, 0)).toBe(s.zombiesBanished)
        expect(s.timeS).toBeCloseTo(time, 6)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: progression-and-atmosphere, Property 12: Stats formatting and round trip
  it('Property 12: time and accuracy formats, and the serialize/parse round trip', () => {
    /** Validates: Requirements 3.6, 3.9, 3.11 */
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), (t) => {
        const text = formatTime(t)
        expect(text).toMatch(/^\d+:\d{2}$/)
        const [m, sec] = text.split(':').map(Number)
        expect(m * 60 + sec).toBe(Math.floor(t))
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (p) => {
        expect(formatAccuracy(p)).toBe(`${p}%`)
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(fc.array(evArb, { maxLength: 60 }), (evs) => {
        const s = fold(evs)
        expect(parseStats(JSON.parse(JSON.stringify(serializeStats(s))))).toEqual(s)
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(fc.anything(), (junk) => {
        const p = parseStats(junk)
        expect(p.shotsHit).toBeLessThanOrEqual(p.shotsFired)
        expect(Number.isFinite(p.timeS)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('statRows shows zeros for an empty run', () => {
    const rows = statRows(createRunStats(), { score: 0, relics: 0 })
    expect(rows.find((r) => r.label === 'Time survived')?.value).toBe('0:00')
    expect(rows.find((r) => r.label === 'Accuracy')?.value).toBe('0%')
    expect(rows.find((r) => r.label === 'Melee hits')?.value).toBe('0')
    expect(rows.find((r) => r.label === 'Best combo')?.value.startsWith('\u00d7')).toBe(true)
  })

  it('recordNightSurvived honours the cap', () => {
    expect(recordNightSurvived(createRunStats(), 9, 12).nightsSurvived).toBe(9)
  })
})
