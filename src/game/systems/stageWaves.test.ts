import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DOUBT_MAX, STAGE_MAP, type StageNumber } from '../../data/stages'
import { waveSize } from '../../data/waves'
import {
  addDoubt,
  aliveCap,
  nextWaveDelay,
  shouldDespawnStuck,
  updateStuck,
  bellDue,
  type StuckMark,
  stageFog,
  stageWaveComposition,
  waveStrength,
} from './stageWaves'

const stageArb = fc.constantFrom<StageNumber>(1, 2, 3)
const KINDS = ['shambler', 'wailer', 'lurker', 'bloater', 'brute'] as const

describe('stageWaveComposition', () => {
  it('stage 1 uses row 1 for waves 1-3 and row 2 from wave 4', () => {
    expect(stageWaveComposition(1, 0)).toMatchObject({ shambler: 4, wailer: 0 })
    expect(stageWaveComposition(1, 2)).toMatchObject({ shambler: 4, wailer: 0 })
    expect(stageWaveComposition(1, 3)).toMatchObject({ shambler: 5, wailer: 0 })
    expect(stageWaveComposition(1, 5)).toMatchObject({ shambler: 5, wailer: 1 })
  })

  it('stage 3 starts on the row 5 composition', () => {
    expect(stageWaveComposition(3, 0)).toMatchObject({ shambler: 8, wailer: 2, lurker: 2 })
  })

  it('past the last row adds a shambler a wave and a wailer/lurker every third wave', () => {
    // Stage 3 row 5 has 5 waves; wave index 5 is the first further wave.
    expect(stageWaveComposition(3, 5).shambler).toBe(9)
    expect(stageWaveComposition(3, 7)).toMatchObject({ shambler: 11, wailer: 3, lurker: 2 })
    expect(stageWaveComposition(3, 10)).toMatchObject({ shambler: 14, wailer: 3, lurker: 3 })
  })

  it('Property 2: wave difficulty never decreases', () => {
    // Feature: 10-curse-stages, Property 2: Wave difficulty never decreases
    // **Validates: Requirements 2.5**
    fc.assert(
      fc.property(stageArb, fc.integer({ min: 0, max: 120 }), (stage, n) => {
        const a = stageWaveComposition(stage, n)
        const b = stageWaveComposition(stage, n + 1)
        expect(waveSize(b)).toBeGreaterThanOrEqual(waveSize(a))
        expect(waveStrength(b)).toBeGreaterThanOrEqual(waveStrength(a))
        for (const k of KINDS) expect(b[k]).toBeGreaterThanOrEqual(a[k])
      }),
      { numRuns: 100 },
    )
  })
})

describe('stage helpers', () => {
  it('Property 3: the alive cap is 12 / 16 / 20', () => {
    // Feature: 10-curse-stages, Property 3: Alive cap holds
    // **Validates: Requirements 2.6**
    expect([1, 2, 3].map((s) => aliveCap(s as StageNumber))).toEqual([12, 16, 20])
  })

  it('weighs enemies shambler 1, wailer 2, lurker 2, bloater 3, brute 6', () => {
    expect(waveStrength({ shambler: 1, wailer: 1, lurker: 1, bloater: 1, brute: 1 })).toBe(14)
  })

  it('Property 4: the next wave comes at min(20 s after the last fall, 60 s after the start)', () => {
    // Feature: 10-curse-stages, Property 4: Wave pacing
    // **Validates: Requirements 2.8**
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 200, noNaN: true }), { nil: null }),
        (start, fall) => {
          const d = nextWaveDelay(start, fall)
          expect(d).toBeGreaterThanOrEqual(0)
          const expected = Math.max(0, Math.min(60 - start, fall === null ? Infinity : 20 - fall))
          expect(d).toBe(expected)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Doubt adds shamblers to the first wave, capped at 3', () => {
    const base = stageWaveComposition(1, 0)
    expect(addDoubt(base, 2).shambler).toBe(base.shambler + 2)
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 50 }), (d) => {
        const extra = addDoubt(base, d).shambler - base.shambler
        expect(extra).toBe(Math.min(DOUBT_MAX, Math.max(0, d)))
      }),
    )
  })

  it('fog follows the stage rows', () => {
    expect(stageFog(1, 0)).toBe(0.02)
    expect(stageFog(1, 3)).toBe(0.03)
    expect(stageFog(2, 0)).toBe(0.04)
    expect(stageFog(3, 50)).toBe(0.06)
    expect(STAGE_MAP[3].fog).toEqual([0.06])
  })

  it('stuck clock grows only for a far chaser that stays put', () => {
    const p = { x: 0, z: 0 }
    let m: StuckMark = updateStuck(undefined, p, true, 10, 1)
    m = updateStuck(m, p, true, 10, 5)
    expect(m.s).toBe(5)
    expect(updateStuck(m, { x: 5, z: 0 }, true, 10, 1).s).toBe(0)
    expect(updateStuck(m, p, false, 10, 1).s).toBe(0)
    expect(updateStuck(m, p, true, 2, 1).s).toBe(0)
  })

  it('rings the bell once, 20 s before the wave', () => {
    expect(bellDue(30, null, false)).toBe(false)
    expect(bellDue(40, null, false)).toBe(true)
    expect(bellDue(40, null, true)).toBe(false)
    expect(bellDue(5, 0, false)).toBe(true)
  })

  it('despawns a stuck zombie after 20 s', () => {
    expect(shouldDespawnStuck(19.9)).toBe(false)
    expect(shouldDespawnStuck(20)).toBe(true)
  })
})
