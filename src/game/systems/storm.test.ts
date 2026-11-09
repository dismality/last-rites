import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { STORM, STORM_CHANCE_NIGHT } from '../../data/storms'
import { createRng } from '../rng'
import {
  rollStorm,
  startStorm,
  stormChance,
  tickStorm,
  type StormEvent,
  type StormState,
} from './storm'

const seedArb = fc.integer({ min: 0, max: 0xffffffff })
const nightArb = fc.integer({ min: 1, max: 12 })

interface Run {
  strikes: number[]
  thunders: number[]
}

/** Runs a storm for `total` seconds; `beat(t)` says whether a beat is pending at time t. */
function run(
  seed: number,
  night: number,
  total: number,
  beat: (t: number) => boolean = () => false,
  dt = 0.1,
): Run {
  let state: StormState = startStorm(seed, night)
  const out: Run = { strikes: [], thunders: [] }
  const steps = Math.round(total / dt)
  for (let i = 1; i <= steps; i++) {
    const t = i * dt
    const r = tickStorm(state, dt, { seed, night, beatPending: beat(t), flashingLights: true })
    state = r.state
    r.events.forEach((e: StormEvent) => {
      if (e.type === 'strike') out.strikes.push(t)
      if (e.type === 'thunder') out.thunders.push(t)
    })
  }
  return out
}

describe('stormChance', () => {
  it('matches the table and treats unknown nights as 0', () => {
    expect(stormChance('night', 1)).toBe(0)
    expect(stormChance('night', 5)).toBe(1)
    expect(stormChance('night', 9)).toBe(0)
    expect(stormChance('day', 3)).toBe(0.15)
  })
})

describe('Property 28: Storm rolls follow the table', () => {
  // **Validates: Requirements 10.1, 10.2, 10.4, 10.17**
  it('chance 0 never rolls, chance 1 always rolls, same seed same roll', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(rollStorm(createRng(seed), 0)).toBe(false)
        expect(rollStorm(createRng(seed), 1)).toBe(true)
        expect(rollStorm(createRng(seed), 0.4)).toBe(rollStorm(createRng(seed), 0.4))
      }),
    )
  })

  it('unconfigured nights have chance 0 and configured nights follow the table', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 40 }), (night) => {
        const expected = STORM_CHANCE_NIGHT[night] ?? 0
        expect(stormChance('night', night)).toBe(expected)
      }),
    )
  })
})

describe('Property 29: Lightning and thunder timing is seeded and bounded', () => {
  // **Validates: Requirements 10.3, 10.6, 10.16, 10.18**
  it('first strike and gaps are 20 to 45 s and thunder is 1 to 4 s after its strike', () => {
    fc.assert(
      fc.property(seedArb, nightArb, (seed, night) => {
        const r = run(seed, night, 400)
        expect(r.strikes.length).toBeGreaterThan(0)
        const eps = 0.11
        let prev = 0
        for (const t of r.strikes) {
          expect(t - prev).toBeGreaterThanOrEqual(STORM.gapMinS - eps)
          expect(t - prev).toBeLessThanOrEqual(STORM.gapMaxS + eps)
          prev = t
        }
        // Thunder follows each strike by 1 to 4 s (gaps are longer than 4 s, so they pair up).
        r.thunders.forEach((th, i) => {
          const d = th - r.strikes[i]
          expect(d).toBeGreaterThanOrEqual(STORM.thunderMinS - eps)
          expect(d).toBeLessThanOrEqual(STORM.thunderMaxS + eps)
        })
      }),
      { numRuns: 30 },
    )
  })

  it('the same seed and night give identical strikes and thunder', () => {
    fc.assert(
      fc.property(seedArb, nightArb, (seed, night) => {
        expect(run(seed, night, 200)).toEqual(run(seed, night, 200))
      }),
      { numRuns: 30 },
    )
  })

  it('slow flashes are used when flashing lights are off', () => {
    const s = startStorm(1, 5)
    const r = tickStorm(s, s.strikeIn ?? 0, {
      seed: 1,
      night: 5,
      beatPending: false,
      flashingLights: false,
    })
    expect(r.events[0]).toEqual({ type: 'strike', slow: true })
  })
})

describe('Property 30: Lightning never starts within 1.5 s before a beat', () => {
  // **Validates: Requirements 13.6, 13.7, 13.8**
  it('no strike while a beat is pending; a due strike fires right after, keeping its thunder delay', () => {
    fc.assert(
      fc.property(
        seedArb,
        nightArb,
        fc.array(fc.tuple(fc.integer({ min: 0, max: 300 }), fc.integer({ min: 1, max: 30 })), {
          maxLength: 6,
        }),
        (seed, night, windows) => {
          const beat = (t: number) => windows.some(([a, len]) => t > a && t <= a + len)
          const free = run(seed, night, 400)
          const held = run(seed, night, 400, beat)
          for (const t of held.strikes) expect(beat(t)).toBe(false)
          // The first strike is only ever delayed, never moved earlier.
          if (held.strikes.length > 0) {
            expect(held.strikes[0]).toBeGreaterThanOrEqual(free.strikes[0] - 1e-9)
          }
          // Each thunder still arrives 1 to 4 s after its (possibly delayed) strike.
          held.thunders.forEach((th, i) => {
            const d = th - held.strikes[i]
            expect(d).toBeGreaterThanOrEqual(STORM.thunderMinS - 0.11)
            expect(d).toBeLessThanOrEqual(STORM.thunderMaxS + 0.11)
          })
        },
      ),
      { numRuns: 30 },
    )
  })

  it('a due strike waits at 0 and fires on the first tick after the beat', () => {
    const ctx = { seed: 7, night: 3, flashingLights: true }
    const s0 = startStorm(7, 3)
    const waiting = tickStorm(s0, (s0.strikeIn ?? 0) + 5, { ...ctx, beatPending: true })
    expect(waiting.events).toEqual([])
    expect(waiting.state.strikeIn).toBe(0)
    const fired = tickStorm(waiting.state, 0.016, { ...ctx, beatPending: false })
    expect(fired.events[0]).toEqual({ type: 'strike', slow: false })
    expect(fired.state.thunder).toHaveLength(1)
  })
})
