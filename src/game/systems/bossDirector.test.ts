import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BOSS } from '../../data/boss'
import {
  bossPhase,
  bossSpeed,
  craneFighting,
  initialBoss,
  riteBlocked,
  riteCapS,
  tickBoss,
  type BossEvent,
  type BossInput,
  type BossState,
} from './bossDirector'

const DT = 1 / 60
const P = { x: 0, z: 0 }

const input = (over: Partial<BossInput> = {}): BossInput => ({
  dt: DT,
  riteStarted: true,
  playerDead: false,
  player: P,
  crane: null,
  ...over,
})

const crane = (hp: number) => ({ hp, maxHp: 1500, pos: { x: 5, z: 5 }, inSalt: false })

function runUntil(s: BossState, stage: BossState['stage']): { s: BossState; events: BossEvent[] } {
  const events: BossEvent[] = []
  for (let n = 0; n < 5000 && s.stage !== stage; n++) {
    const r = tickBoss(s, input({ crane: s.stage === 'risen' ? crane(1500) : null }))
    s = r.state
    events.push(...r.events)
  }
  return { s, events }
}

describe('bossDirector rise', () => {
  it('stays dormant and silent until the rite starts', () => {
    let s = initialBoss()
    for (let n = 0; n < 1200; n++) {
      const r = tickBoss(s, input({ riteStarted: false }))
      expect(r.events).toEqual([])
      s = r.state
    }
    expect(s.stage).toBe('dormant')
    expect(s.riteClock).toBe(0)
  })

  it('telegraphs at 10 s, spawns 1.5 s later and shows a 3 s name card', () => {
    const t = runUntil(initialBoss(), 'telegraph')
    expect(t.s.riteClock).toBeGreaterThanOrEqual(BOSS.riseAfterS)
    expect(t.s.riteClock).toBeLessThan(BOSS.riseAfterS + 0.1)
    expect(t.events).toEqual([{ type: 'riseTelegraph' }])
    const r = runUntil(t.s, 'risen')
    expect(r.events).toEqual([{ type: 'spawn' }])
    expect(r.s.stageClock).toBe(0)
    expect(r.s.nameCardLeftS).toBe(BOSS.nameCardS)
    expect(craneFighting(r.s)).toBe(true)
  })

  it('sets Toll and Congregation timers on phase changes', () => {
    const { s } = runUntil(initialBoss(), 'risen')
    expect(s.congregationIn).toBe(25)
    const p2 = tickBoss(s, input({ crane: crane(800) }))
    expect(p2.events).toEqual([{ type: 'phase', phase: 2 }])
    expect(p2.state.tollIn).toBe(12)
    const p3 = tickBoss(p2.state, input({ crane: crane(300) }))
    expect(p3.state.phase).toBe(3)
    expect(p3.state.congregationIn).toBe(18)
  })

  it('caps the rite at 44 s until he is dead', () => {
    expect(riteCapS(initialBoss())).toBe(44)
    expect(riteBlocked(initialBoss())).toBe(true)
    const dead = { ...initialBoss(), stage: 'dead' as const }
    expect(riteCapS(dead)).toBe(45)
    expect(riteBlocked(dead)).toBe(false)
  })

  it('freezes with no events when the player is dead', () => {
    const s = initialBoss()
    const r = tickBoss(s, input({ playerDead: true }))
    expect(r.state).toBe(s)
    expect(r.events).toEqual([])
  })
})

describe('Property 27 (rise, phases, speed)', () => {
  /** **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.10, 17.17, 17.19** */
  it('phase is monotonic and matches the lowest HP seen', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 1500 }), { minLength: 1, maxLength: 40 }), (hps) => {
        let s = runUntil(initialBoss(), 'risen').s
        let low = 1500
        for (const hp of hps) {
          const before = s.phase
          s = tickBoss(s, input({ crane: crane(hp) })).state
          low = Math.min(low, hp)
          expect(s.phase).toBeGreaterThanOrEqual(before)
          expect(s.phase).toBe(bossPhase(low, 1500))
        }
      }),
      { numRuns: 100 },
    )
  })

  it('emits no attack or spawn event before the rise, and rises exactly once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ started: fc.boolean(), dt: fc.double({ min: 0.001, max: 0.1, noNaN: true }) }), {
          maxLength: 400,
        }),
        (steps) => {
          let s = initialBoss()
          let spawns = 0
          for (const st of steps) {
            const r = tickBoss(s, input({ riteStarted: st.started, dt: st.dt }))
            for (const e of r.events) {
              if (e.type === 'spawn') spawns++
              if (s.stage === 'dormant') expect(['riseTelegraph']).toContain(e.type)
              expect(e.type).not.toMatch(/^(swing|toll|congregation)/)
            }
            if (r.state.stage !== 'dormant') expect(r.state.riteClock).toBeGreaterThanOrEqual(BOSS.riseAfterS)
            s = r.state
          }
          expect(spawns).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('speed is 1.2 / 1.5 / 1.7 and halved in a Salt Circle', () => {
    fc.assert(
      fc.property(fc.constantFrom(1 as const, 2 as const, 3 as const), fc.boolean(), (phase, salt) => {
        const base = { 1: 1.2, 2: 1.5, 3: 1.7 }[phase]
        expect(bossSpeed(phase, salt)).toBeCloseTo(salt ? base / 2 : base, 10)
      }),
    )
  })
})
