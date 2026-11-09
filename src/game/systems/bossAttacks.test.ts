import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BOSS } from '../../data/boss'
import {
  bossHitDamage,
  initialBoss,
  swingHits,
  tickBoss,
  tollHits,
  type BossEvent,
  type BossState,
} from './bossDirector'
import type { Vec2 } from './combat'

const DT = 1 / 60
const MAX = 1500
const POS: Vec2 = { x: 0, z: 0 }

const risen = (over: Partial<BossState> = {}): BossState => ({
  ...initialBoss(),
  stage: 'risen',
  congregationIn: 25,
  ...over,
})

interface Logged {
  t: number
  e: BossEvent
}

/** Runs `secs` of sim at a fixed HP and player position, logging events with their time. */
function run(s: BossState, hp: number, player: Vec2, secs: number): { s: BossState; log: Logged[] } {
  const log: Logged[] = []
  const n = Math.round(secs / DT)
  for (let k = 0; k < n; k++) {
    const r = tickBoss(s, {
      dt: DT,
      riteStarted: true,
      playerDead: false,
      player,
      crane: { hp, maxHp: MAX, pos: POS, inSalt: false },
    })
    s = r.state
    for (const e of r.events) log.push({ t: (k + 1) * DT, e })
  }
  return { s, log }
}

const times = (log: Logged[], type: BossEvent['type']) => log.filter((l) => l.e.type === type).map((l) => l.t)

describe('Father Crane attacks', () => {
  it('starts the Toll first when Toll and Congregation are both due', () => {
    const { log } = run(risen({ phase: 2, tollIn: 0, congregationIn: 0 }), 800, { x: 50, z: 0 }, 1)
    expect(log.map((l) => l.e.type)).toEqual(['tollStart'])
  })

  it('starts the Congregation before a Swing when both are due', () => {
    const { log } = run(risen({ congregationIn: 0 }), 1500, { x: 1, z: 0 }, 0.1)
    expect(log.map((l) => l.e.type)).toEqual(['congregationStart'])
  })

  it('locks the swing aim at wind-up start', () => {
    const start = tickBoss(risen(), {
      dt: DT,
      riteStarted: true,
      playerDead: false,
      player: { x: 2, z: 0 },
      crane: { hp: 1500, maxHp: MAX, pos: POS, inSalt: false },
    })
    const first = start.events.find((e) => e.type === 'swingStart')
    expect(first).toEqual({ type: 'swingStart', dir: { x: 1, z: 0 } })
    const { log } = run(start.state, 1500, { x: 0, z: 2 }, 1.1)
    const hit = log.find((l) => l.e.type === 'swingHit')
    expect(hit?.e).toMatchObject({ dir: { x: 1, z: 0 } })
  })

  it('chains two swings 0.3 s apart in phase 3, then rests 2 s', () => {
    const { log } = run(risen({ phase: 3, congregationIn: 99, tollIn: 99 }), 100, { x: 1, z: 0 }, 6)
    const starts = times(log, 'swingStart')
    const hits = times(log, 'swingHit')
    expect(hits.length).toBeGreaterThanOrEqual(3)
    expect(starts[1] - hits[0]).toBeCloseTo(BOSS_GAP, 1)
    expect(starts[2] - hits[1]).toBeCloseTo(2, 1)
  })

  it('hit tests use 3 m / 120 degrees and 8 m', () => {
    const dir = { x: 1, z: 0 }
    expect(swingHits(POS, dir, { x: 3, z: 0 })).toBe(true)
    expect(swingHits(POS, dir, { x: 3.01, z: 0 })).toBe(false)
    expect(swingHits(POS, dir, { x: -1, z: 0 })).toBe(false)
    expect(swingHits(POS, dir, { x: 1, z: 1.7 })).toBe(true)
    expect(swingHits(POS, dir, { x: 0.5, z: 2 })).toBe(false)
    expect(tollHits(POS, { x: 8, z: 0 })).toBe(true)
    expect(tollHits(POS, { x: 8.01, z: 0 })).toBe(false)
  })

  it('Property 27: attacks fire at their intervals, telegraph first, and damage is bounded', () => {
    // **Validates: Requirements 17.6, 17.7, 17.8, 17.19, 23.1, 23.2, 23.5**
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 3),
        fc.double({ min: 6, max: 30, noNaN: true }),
        (phase, far) => {
          const hp = phase === 1 ? 1500 : phase === 2 ? 800 : 100
          const base = risen({
            phase,
            tollIn: phase >= 2 ? BOSS.toll.everyS : 0,
            congregationIn: BOSS.congregation.everyS[phase],
          })
          const { log } = run(base, hp, { x: far, z: 0 }, 80)
          const tollStarts = times(log, 'tollStart')
          const tolls = times(log, 'tollRing')
          const congStarts = times(log, 'congregationStart')
          const rises = times(log, 'congregationRise')
          expect(tollStarts.length > 0).toBe(phase >= 2)
          tolls.forEach((t, k) => {
            expect(t - tollStarts[k]).toBeGreaterThanOrEqual(BOSS.toll.telegraphS - 1e-6)
          })
          rises.forEach((t, k) => {
            expect(t - congStarts[k]).toBeGreaterThanOrEqual(BOSS.congregation.telegraphS - 1e-6)
          })
          // Starts are spaced by the interval plus the telegraph that was running.
          for (let k = 1; k < tollStarts.length; k++) {
            expect(tollStarts[k] - tollStarts[k - 1]).toBeGreaterThanOrEqual(BOSS.toll.everyS - 0.05)
          }
          for (let k = 1; k < congStarts.length; k++) {
            expect(congStarts[k] - congStarts[k - 1]).toBeGreaterThanOrEqual(
              BOSS.congregation.everyS[phase] - 0.05,
            )
          }
          expect(congStarts.length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 12 },
    )
  })

  it('Property 27: a swing telegraphs at least 1 s and no hit exceeds its damage bound', () => {
    // **Validates: Requirements 17.6, 17.7, 17.8, 23.1, 23.2, 23.5**
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 3),
        fc.double({ min: 0, max: 3, noNaN: true }),
        (phase, dist) => {
          const { log } = run(risen({ phase, congregationIn: 999, tollIn: 999 }), 100, { x: dist, z: 0 }, 12)
          const starts = times(log, 'swingStart')
          const hits = times(log, 'swingHit')
          hits.forEach((t, k) => expect(t - starts[k]).toBeGreaterThanOrEqual(BOSS.censer.windupS - 1e-6))
          expect(bossHitDamage('swing')).toBeLessThanOrEqual(30)
          expect(bossHitDamage('toll')).toBeLessThanOrEqual(20)
          // Never two attacks at once: every start is followed by its finish before the next start.
          const merged = log
            .filter((l) => l.e.type === 'swingStart' || l.e.type === 'swingHit')
            .map((l) => l.e.type)
          merged.forEach((t, k) => expect(t).toBe(k % 2 === 0 ? 'swingStart' : 'swingHit'))
        },
      ),
      { numRuns: 15 },
    )
  })

  it('Property 27: swingHits implies within 3 m and tollHits within 8 m', () => {
    // **Validates: Requirements 17.6, 17.7**
    const coord = fc.double({ min: -12, max: 12, noNaN: true })
    fc.assert(
      fc.property(coord, coord, coord, coord, (px, pz, dx, dz) => {
        const p = { x: px, z: pz }
        if (swingHits(POS, { x: dx, z: dz }, p)) expect(Math.hypot(px, pz)).toBeLessThanOrEqual(3)
        expect(tollHits(POS, p)).toBe(Math.hypot(px, pz) <= 8)
      }),
    )
  })
})

const BOSS_GAP = 0.3
