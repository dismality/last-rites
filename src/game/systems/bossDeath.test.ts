import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BOSS } from '../../data/boss'
import { initialBoss, tickBoss, type BossInput, type BossState } from './bossDirector'

const MAX = 1500
const POS = { x: 0, z: 0 }

const input = (hp: number, over: Partial<BossInput> = {}): BossInput => ({
  dt: 1 / 60,
  riteStarted: true,
  playerDead: false,
  player: { x: 1, z: 0 },
  crane: { hp, maxHp: MAX, pos: POS, inSalt: false },
  ...over,
})

const winding: BossState = {
  ...initialBoss(),
  stage: 'risen',
  phase: 2,
  attack: { kind: 'toll', leftS: 0.5 },
  swingsLeft: 1,
  swingIn: 1,
  tollIn: 5,
  congregationIn: 7,
  nameCardLeftS: 1,
}

describe('boss death', () => {
  it('Property 27: 0 HP cancels the attack and every timer, then only deathStart fires', () => {
    // **Validates: Requirements 17.12, 17.13**
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 0 }), (hp) => {
        const r = tickBoss(winding, input(hp))
        expect(r.state.stage).toBe('dying')
        expect(r.state.attack).toBeNull()
        expect([r.state.swingsLeft, r.state.swingIn, r.state.tollIn, r.state.congregationIn]).toEqual([0, 0, 0, 0])
        expect(r.events).toEqual([{ type: 'deathStart' }])
      }),
    )
  })

  it('holds 4 s of quiet, then emits quietEnded once and becomes dead', () => {
    let s = tickBoss(winding, input(0)).state
    const types: string[] = []
    for (let k = 0; k < 60 * 6; k++) {
      const r = tickBoss(s, input(0))
      if (k < 60 * 4 - 2) expect(r.state.stage).toBe('dying')
      s = r.state
      types.push(...r.events.map((e) => e.type))
    }
    expect(types).toEqual(['quietEnded'])
    expect(s.stage).toBe('dead')
    expect(BOSS.deathQuietS).toBe(4)
  })

  it('Property 27: a dead player stops all events and freezes the state', () => {
    // **Validates: Requirements 17.15**
    fc.assert(
      fc.property(
        fc.constantFrom<BossState['stage']>('dormant', 'telegraph', 'risen', 'dying', 'dead'),
        fc.double({ min: 0.001, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: MAX }),
        (stage, dt, hp) => {
          const s = { ...winding, stage }
          const r = tickBoss(s, input(hp, { dt, playerDead: true }))
          expect(r.events).toEqual([])
          expect(r.state).toEqual(s)
        },
      ),
    )
  })

  it('holds state with no Crane body', () => {
    // **Validates: Requirements 17.18**
    const r = tickBoss(winding, input(0, { crane: null }))
    expect(r.state.stage).toBe('risen')
    expect(r.events).toEqual([])
  })
})
