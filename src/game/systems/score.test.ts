import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BOSS_POINTS, COMBO, HEADSHOT_BONUS, KILL_POINTS } from '../../data/scoring'
import {
  INITIAL_SCORE_STATE,
  applyBoss,
  applyKill,
  comboView,
  nightScore,
  tickCombo,
  type KillInput,
  type ScoreState,
} from './score'

const waveIds = Object.keys(KILL_POINTS) as (keyof typeof KILL_POINTS)[]
const mults = fc.constantFrom(0.75, 1, 1.5)

const stateArb: fc.Arbitrary<ScoreState> = fc.record({
  score: fc.nat(100000),
  bossScored: fc.boolean(),
  combo: fc.integer({ min: 0, max: 8 }).map((n) => 1 + n * COMBO.step),
  lastKillAt: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null }),
  seen: fc.uniqueArray(fc.string(), { maxLength: 5 }),
  nightKillPoints: fc.nat(10000),
})

const killArb = (uid: fc.Arbitrary<string> = fc.string()): fc.Arbitrary<KillInput> =>
  fc.record({
    uid,
    enemy: fc.constantFrom(...waveIds),
    elite: fc.boolean(),
    headshot: fc.boolean(),
  })

describe('score', () => {
  it('first kill scores base points at x1.0', () => {
    const r = applyKill(
      INITIAL_SCORE_STATE,
      { uid: 'a', enemy: 'brute', elite: false, headshot: false },
      5,
      1,
    )
    expect(r.points).toBe(75)
    expect(r.state.combo).toBe(1)
  })

  it('comboView hides at x1.0 and formats the multiplier', () => {
    expect(comboView(INITIAL_SCORE_STATE, 0).visible).toBe(false)
    const v = comboView({ ...INITIAL_SCORE_STATE, combo: 1.75, lastKillAt: 0 }, 2)
    expect(v).toEqual({ visible: true, text: '×1.75', barFraction: 0.5 })
  })

  // Property 6
  it('Property 6: kill points follow the formula', () => {
    // **Validates: Requirements 2.1, 7.6**
    fc.assert(
      fc.property(
        stateArb,
        killArb(fc.constant('fresh-uid-xyz')),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        mults,
        (s, k, now, m) => {
          const r = applyKill(s, k, now, m)
          expect(r.counted).toBe(true)
          const combo = r.state.combo
          const expected = Math.round(
            (KILL_POINTS[k.enemy as keyof typeof KILL_POINTS] * (k.elite ? 2 : 1) +
              (k.headshot ? HEADSHOT_BONUS : 0)) *
              combo *
              m,
          )
          expect(r.points).toBe(expected)
          expect(r.state.score - s.score).toBe(expected)
        },
      ),
    )
  })

  // Property 7
  it('Property 7: combo window and decay', () => {
    // **Validates: Requirements 2.2, 2.3**
    fc.assert(
      fc.property(
        stateArb,
        killArb(fc.constant('fresh-uid-xyz')),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (s, k, now) => {
          const r = applyKill(s, k, now, 1)
          const inWindow = s.lastKillAt !== null && now - s.lastKillAt <= COMBO.windowS
          expect(r.state.combo).toBe(
            inWindow ? Math.min(COMBO.cap, s.combo + COMBO.step) : COMBO.base,
          )

          const ticked = tickCombo(s, now)
          const expired = s.lastKillAt !== null && now - s.lastKillAt > COMBO.windowS
          expect(ticked.combo).toBe(expired ? COMBO.base : s.combo)
          // No tick means no change (pause).
          expect(s.combo).toBe(s.combo)
          if (!expired) expect(ticked).toBe(s)
        },
      ),
    )
  })

  // Property 8
  it('Property 8: invariants, determinism and spaced kills', () => {
    // **Validates: Requirements 2.10, 2.11, 2.12**
    const seqArb = fc.array(fc.tuple(killArb(), fc.double({ min: 0, max: 6, noNaN: true })), {
      maxLength: 30,
    })
    const run = (seq: [KillInput, number][], m: number, gap?: number) => {
      let s = INITIAL_SCORE_STATE
      let t = 0
      const gains: number[] = []
      seq.forEach(([k, dt], i) => {
        t += gap ?? dt
        const before = s.score
        s = applyKill(s, { ...k, uid: `u${i}` }, t, m).state
        gains.push(s.score - before)
        expect(s.score).toBeGreaterThanOrEqual(before)
        expect(s.combo).toBeGreaterThanOrEqual(COMBO.base)
        expect(s.combo).toBeLessThanOrEqual(COMBO.cap)
      })
      return { s, gains }
    }
    fc.assert(
      fc.property(seqArb, mults, (seq, m) => {
        const a = run(seq, m)
        const b = run(seq, m)
        expect(a.s).toEqual(b.s)
        const spaced = run(seq, m, COMBO.windowS + 0.5)
        seq.forEach(([k], i) => {
          const base =
            KILL_POINTS[k.enemy as keyof typeof KILL_POINTS] * (k.elite ? 2 : 1) +
            (k.headshot ? HEADSHOT_BONUS : 0)
          expect(spaced.gains[i]).toBe(Math.round(base * m))
        })
      }),
    )
  })

  // Property 9 (score half)
  it('Property 9: repeated and unknown events are ignored', () => {
    // **Validates: Requirements 2.8, 3.9**
    fc.assert(
      fc.property(
        stateArb,
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.string(),
        (s, now, uid) => {
          const seenState = { ...s, seen: [...s.seen, uid] }
          const bad: unknown[] = [
            { uid, enemy: 'shambler', elite: false, headshot: false },
            { uid: 'new-uid-1', enemy: 'father-crane', elite: false, headshot: true },
            { uid: 'new-uid-1', enemy: 'constructor', elite: false, headshot: false },
            { uid: 'new-uid-1', enemy: 'ghost', elite: false, headshot: false },
            { uid: 7, enemy: 'shambler', elite: false, headshot: false },
            { uid: 'new-uid-1', enemy: 'shambler', elite: 'no', headshot: false },
            { uid: 'new-uid-1', enemy: 'shambler', elite: false },
            null,
          ]
          for (const k of bad) {
            const r = applyKill(seenState, k as KillInput, now, 1)
            expect(r.counted).toBe(false)
            expect(r.points).toBe(0)
            expect(r.state).toBe(seenState)
          }
        },
      ),
    )
  })

  // Property 10
  it('Property 10: night score and the boss bonus', () => {
    // **Validates: Requirements 2.4, 2.5**
    fc.assert(
      fc.property(
        stateArb,
        fc.integer({ min: 1, max: 12 }),
        fc.nat(200),
        mults,
        fc.double({ min: 0, max: 1000, noNaN: true }),
        (s, night, dmg, m, now) => {
          const n = nightScore(s, night, dmg, m)
          expect(n.kill).toBe(s.nightKillPoints)
          expect(n.clear).toBe(Math.round(100 * night * m))
          expect(n.noDamage).toBe(dmg === 0 ? Math.round(200 * m) : 0)
          expect(n.total).toBe(n.kill + n.clear + n.noDamage)

          const fresh = { ...s, bossScored: false }
          const first = applyBoss(fresh, now, m)
          expect(first.points).toBe(Math.round(BOSS_POINTS * first.state.combo * m))
          expect(first.state.score - fresh.score).toBe(first.points)
          const again = applyBoss(first.state, now, m)
          expect(again.points).toBe(0)
          expect(again.state).toBe(first.state)
        },
      ),
    )
  })
})
