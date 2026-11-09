import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { NIGHT_MAP, waveSize, type NightNumber } from '../../data/waves'
import { endlessNight, parseBest, updateBest } from './endless'
import { nightPlan, startNight } from './waves'

describe('endlessNight', () => {
  it('night 1 is two waves of 5 shamblers; night 6 has five waves with every type', () => {
    expect(endlessNight(1).waves).toEqual([
      { shambler: 5, wailer: 0, lurker: 0, bloater: 0, brute: 0 },
      { shambler: 5, wailer: 0, lurker: 0, bloater: 0, brute: 0 },
    ])
    const n6 = endlessNight(6)
    expect(n6.waves).toHaveLength(5)
    expect(n6.waves[0]).toEqual({ shambler: 10, wailer: 3, lurker: 2, bloater: 2, brute: 1 })
  })

  /** Feature: 08-progression-and-atmosphere, Property 21: The Endless generator is well formed */
  it('Property 21: wave count, counts and growth follow the formulas', () => {
    // **Validates: Requirements 7.8, 7.15, 7.16**
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        const { night, waves } = endlessNight(n)
        expect(night).toBe(n)
        expect(waves).toHaveLength(Math.min(2 + Math.floor(n / 2), 6))
        for (const w of waves) {
          expect(w).toEqual({
            shambler: 4 + n,
            wailer: Math.max(0, Math.floor(n / 2)),
            lurker: Math.max(0, Math.floor((n - 1) / 2)),
            bloater: Math.max(0, Math.floor((n - 2) / 2)),
            brute: Math.max(0, Math.floor((n - 3) / 3)),
          })
          for (const v of Object.values(w)) expect(Number.isInteger(v) && v >= 0).toBe(true)
        }
        if (n > 1) expect(waves[0].shambler).toBeGreaterThan(endlessNight(n - 1).waves[0].shambler)
      }),
    )
  })
})

describe('Endless best', () => {
  /** Feature: 08-progression-and-atmosphere, Property 22: The Endless best only goes up and survives bad storage */
  it('Property 22: parseBest is always a finite number >= 0 and updateBest only writes on a higher score', () => {
    // **Validates: Requirements 7.10, 7.11, 7.12, 7.13**
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.constant(null), fc.double().map(String), fc.nat().map(String)),
        fc.oneof(fc.nat(), fc.double()),
        (raw, run) => {
          const stored = parseBest(raw)
          expect(Number.isFinite(stored) && stored >= 0).toBe(true)
          const u = updateBest(stored, run)
          expect(u.write).toBe(run > stored)
          // On a failed write the shown best is still the higher of the two, never lower than stored.
          expect(u.best).toBeGreaterThanOrEqual(stored)
          expect(u.best).toBe(run > stored ? run : stored)
        },
      ),
    )
  })

  it('reads hostile text as 0 and numbers as themselves', () => {
    for (const bad of [null, '', 'abc', 'NaN', '-5', 'Infinity', '1e999', '{"a":1}']) {
      expect(parseBest(bad)).toBe(0)
    }
    expect(parseBest('1240')).toBe(1240)
  })
})

describe('nightPlan', () => {
  it('story modes give the NIGHT_MAP waves, endless gives the generator', () => {
    for (const n of [1, 2, 3, 4, 5] as NightNumber[]) {
      expect(nightPlan('hard', n)).toBe(NIGHT_MAP[n].waves)
    }
    expect(nightPlan('normal', 6)).toEqual([])
    expect(nightPlan('endless', 7)).toEqual(endlessNight(7).waves)
    expect(waveSize(nightPlan('endless', 1)[0])).toBe(5)
  })

  it('startNight in endless starts night 8 with the generated first wave', () => {
    const s = startNight(8, 'endless')
    expect(s.phase).toBe('active')
    expect(s.night).toBe(8)
    expect(s.pending).toHaveLength(waveSize(endlessNight(8).waves[0]))
  })
})
