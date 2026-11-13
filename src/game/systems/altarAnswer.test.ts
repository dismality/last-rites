import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  ALTAR_LOCK_S,
  INITIAL_ALTAR_STATE,
  giveAnswer,
  type AltarState,
  type AltarVerdict,
} from './altarAnswer'
import type { Phase } from '../types'

const stateArb: fc.Arbitrary<AltarState> = fc.record({
  lockedUntil: fc.integer({ min: 0, max: 1000 }),
  wrong: fc.integer({ min: 0, max: 6 }),
  linksAtLastWrong: fc.integer({ min: 0, max: 10 }),
})
const phaseArb = fc.constantFrom<Phase>('day', 'dusk', 'night', 'dawn')

describe('giveAnswer examples', () => {
  it('refuses by day', () => {
    expect(giveAnswer(INITIAL_ALTAR_STATE, 10, 'day', 0, true, 'case')).toEqual({ kind: 'day' })
  })

  it('solves a correct answer at night', () => {
    expect(giveAnswer(INITIAL_ALTAR_STATE, 10, 'night', 0, true, 'case')).toEqual({ kind: 'solved' })
  })

  it('a wrong answer locks for 30 s and asks for a wave', () => {
    const v = giveAnswer(INITIAL_ALTAR_STATE, 100, 'night', 3, false, 'case')
    expect(v).toEqual({
      kind: 'wrong',
      spawnWave: true,
      state: { lockedUntil: 100 + ALTAR_LOCK_S, wrong: 1, linksAtLastWrong: 3 },
    })
  })

  it('reports the seconds left while locked', () => {
    const a = { lockedUntil: 130, wrong: 1, linksAtLastWrong: 0 }
    expect(giveAnswer(a, 106, 'night', 0, true, 'case')).toEqual({ kind: 'locked', secondsLeft: 24 })
  })

  it('needs one more link after 2 wrong answers', () => {
    const a = { lockedUntil: 0, wrong: 2, linksAtLastWrong: 4 }
    expect(giveAnswer(a, 500, 'night', 4, true, 'case')).toEqual({ kind: 'needs-link' })
    expect(giveAnswer(a, 500, 'night', 5, true, 'case')).toEqual({ kind: 'solved' })
  })
})

describe('giveAnswer properties', () => {
  // Feature: 10-curse-stages, Property 6: Altar answers obey the lock and the link rule
  it('Property 6: lock, day and link rules hold', () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.integer({ min: 0, max: 1000 }),
        phaseArb,
        fc.integer({ min: 0, max: 12 }),
        fc.boolean(),
        (a, now, phase, links, correct) => {
          const v: AltarVerdict = giveAnswer(a, now, phase, links, correct, 'case')
          if (phase !== 'night') return v.kind === 'day'
          if (now < a.lockedUntil) return v.kind === 'locked' && v.secondsLeft === Math.ceil(a.lockedUntil - now)
          if (a.wrong >= 2 && links <= a.linksAtLastWrong) return v.kind === 'needs-link'
          if (correct) return v.kind === 'solved'
          return (
            v.kind === 'wrong' &&
            v.spawnWave &&
            v.state.lockedUntil === now + ALTAR_LOCK_S &&
            v.state.wrong === a.wrong + 1
          )
        },
      ),
      { numRuns: 200 },
    )
  })

  it('Property 6: after 2 wrong answers the link count must grow before an answer is taken', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), fc.boolean(), (links, correct) => {
        let s: AltarState = INITIAL_ALTAR_STATE
        let t = 0
        for (let i = 0; i < 2; i++) {
          const v = giveAnswer(s, t, 'night', links, false, 'case')
          if (v.kind !== 'wrong') return false
          s = v.state
          t += ALTAR_LOCK_S + 1
        }
        if (giveAnswer(s, t, 'night', links, correct, 'case').kind !== 'needs-link') return false
        return giveAnswer(s, t, 'night', links + 1, correct, 'case').kind === (correct ? 'solved' : 'wrong')
      }),
      { numRuns: 100 },
    )
  })

  // Feature: 10-curse-stages, Property 7: A wrong accusation costs nothing
  it('Property 7: a wrong accusation spawns no wave, no lock, no count', () => {
    fc.assert(
      fc.property(stateArb, fc.integer({ min: 1000, max: 2000 }), fc.integer({ min: 0, max: 12 }), (a, now, links) => {
        const v = giveAnswer(a, now, 'night', links, false, 'accusation')
        return v.kind === 'wrong-accusation' && !('spawnWave' in v) && !('state' in v)
      }),
      { numRuns: 100 },
    )
  })
})
