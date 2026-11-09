import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { DIG_DURATION_S } from '../../data/digging'
import { LOOT_TABLE_MAP } from '../../data/lootTables'
import { createRng } from '../rng'
import {
  canDig,
  createDigState,
  digProgress,
  handScareChance,
  tickDig,
  type DigEvent,
  type DigInput,
  type DigState,
} from './dig'
import { rollLoot } from './loot'

const DT = 1 / 60
const TICKS_FOR_DIG = Math.round(DIG_DURATION_S / DT)

function input(over: Partial<DigInput> = {}): DigInput {
  return {
    interactHeld: true,
    target: { id: 'grave-1' },
    equipped: 'rusty-shovel',
    position: [0, 0, 0],
    hit: false,
    day: 1,
    phase: 'day',
    rng: createRng(1),
    ...over,
  }
}

/** Runs ticks, collecting events. */
function run(state: DigState, ticks: number, make: (i: number) => DigInput) {
  const events: DigEvent[] = []
  let s = state
  for (let i = 0; i < ticks; i++) {
    const r = tickDig(s, DT, make(i))
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

describe('tickDig', () => {
  it('does not start without a shovel, a target or the key held', () => {
    expect(tickDig(createDigState(), DT, input({ equipped: 'bone-club' })).state.graveId).toBeNull()
    expect(tickDig(createDigState(), DT, input({ target: null })).state.graveId).toBeNull()
    expect(tickDig(createDigState(), DT, input({ interactHeld: false })).state.graveId).toBeNull()
  })

  it('completes after exactly 3 s of holding, not before', () => {
    const early = run(createDigState(), TICKS_FOR_DIG - 1, () => input())
    expect(early.events).toEqual([])
    expect(digProgress(early.state)).toBeGreaterThan(0.99)

    const done = run(createDigState(), TICKS_FOR_DIG, () => input())
    expect(done.events).toHaveLength(1)
    expect(done.events[0].type).toBe('digCompleted')
    expect(done.state.graveId).toBeNull()
  })

  it('a shorter durationS finishes the dig sooner and scales progress', () => {
    const durationS = DIG_DURATION_S * 0.7
    const ticks = Math.round(durationS / DT)
    const done = run(createDigState(), ticks, () => input({ durationS }))
    expect(done.events).toHaveLength(1)
    // Same ticks at the default duration are not enough.
    expect(run(createDigState(), ticks, () => input()).events).toEqual([])
    const half = run(createDigState(), 5, () => input({ durationS }))
    expect(digProgress(half.state, durationS)).toBeGreaterThan(digProgress(half.state))
  })

  it('grants loot from the grave table using the seeded rng', () => {
    const done = run(createDigState(), TICKS_FOR_DIG, () => input({ rng: createRng(7) }))
    const ev = done.events[0]
    if (ev.type !== 'digCompleted') throw new Error('expected digCompleted')
    const rng = createRng(7)
    expect(ev.loot).toEqual(rollLoot(LOOT_TABLE_MAP['grave-dig'], rng))
  })

  it('cancels on movement with no loot', () => {
    // Stop right after the cancelling tick; a held key would otherwise start a fresh dig.
    const r = run(createDigState(), 11, (i) => input({ position: [i < 10 ? 0 : 1, 0, 0] }))
    expect(r.events).toEqual([{ type: 'digCancelled', graveId: 'grave-1', reason: 'moved' }])
    expect(r.state.graveId).toBeNull()
    expect(r.state.progress).toBe(0)
  })

  it('tolerates tiny jitter', () => {
    const r = run(createDigState(), TICKS_FOR_DIG, () => input({ position: [0.01, 0, 0.01] }))
    expect(r.events[0].type).toBe('digCompleted')
  })

  it('cancels when hit with no loot', () => {
    const r = run(createDigState(), 30, (i) => input({ hit: i === 20 }))
    expect(r.events).toEqual([{ type: 'digCancelled', graveId: 'grave-1', reason: 'hit' }])
  })

  it('cancels on release and restarts from zero', () => {
    const r = run(createDigState(), 30, (i) => input({ interactHeld: i < 20 }))
    expect(r.events).toEqual([{ type: 'digCancelled', graveId: 'grave-1', reason: 'released' }])
    const again = tickDig(r.state, DT, input())
    expect(again.state.progress).toBeCloseTo(DT)
  })

  it('cancels when the shovel is unequipped', () => {
    const r = run(createDigState(), 30, (i) => input({ equipped: i < 20 ? 'rusty-shovel' : null }))
    expect(r.events[0]).toMatchObject({ type: 'digCancelled', reason: 'interrupted' })
  })

  it('cannot dig the same grave twice on one day, but can the next day', () => {
    const first = run(createDigState(), TICKS_FOR_DIG, () => input())
    expect(canDig(first.state, 'grave-1', 1)).toBe(false)

    const blocked = run(first.state, TICKS_FOR_DIG, () => input())
    expect(blocked.events).toEqual([])
    expect(blocked.state.graveId).toBeNull()

    const nextDay = run(first.state, TICKS_FOR_DIG, () => input({ day: 2 }))
    expect(nextDay.events[0].type).toBe('digCompleted')
  })

  it('a different grave can still be dug the same day', () => {
    const first = run(createDigState(), TICKS_FOR_DIG, () => input())
    const other = run(first.state, TICKS_FOR_DIG, () => input({ target: { id: 'grave-2' } }))
    expect(other.events[0]).toMatchObject({ type: 'digCompleted', graveId: 'grave-2' })
  })

  it('uses 20% by day and 40% at night for the hand scare', () => {
    expect(handScareChance('day')).toBe(0.2)
    expect(handScareChance('dusk')).toBe(0.2)
    expect(handScareChance('night')).toBe(0.4)
  })

  // **Validates: Requirements 3.3**
  it('property: scare roll is deterministic and matches the chance for the phase', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom('day' as const, 'night' as const), (seed, phase) => {
        const scareOf = () => {
          const r = run(createDigState(), TICKS_FOR_DIG, () =>
            input({ phase, rng: createRng(seed) }),
          )
          const ev = r.events[0]
          return ev.type === 'digCompleted' ? ev.scareId : 'bad'
        }
        const got = scareOf()
        expect(got).toBe(scareOf())

        // Recompute the expected roll: loot draws first, then one scare roll.
        const rng = createRng(seed)
        rollLoot(LOOT_TABLE_MAP['grave-dig'], rng)
        const expected = rng() < handScareChance(phase) ? 'hand-from-grave' : null
        expect(got).toBe(expected)
      }),
    )
  })

  it('night triggers the scare more often than day over many seeds', () => {
    const count = (phase: 'day' | 'night') => {
      let n = 0
      for (let seed = 0; seed < 400; seed++) {
        const r = run(createDigState(), TICKS_FOR_DIG, () => input({ phase, rng: createRng(seed) }))
        const ev = r.events[0]
        if (ev.type === 'digCompleted' && ev.scareId) n++
      }
      return n
    }
    const day = count('day')
    const night = count('night')
    expect(night).toBeGreaterThan(day)
    expect(day / 400).toBeGreaterThan(0.1)
    expect(night / 400).toBeLessThan(0.55)
  })

  // **Validates: Requirements 3.5**
  it('property: any move or hit mid-dig yields no loot event', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: TICKS_FOR_DIG - 2 }),
        fc.constantFrom('move', 'hit'),
        (at, kind) => {
          const r = run(createDigState(), TICKS_FOR_DIG, (i) =>
            input({
              position: [kind === 'move' && i >= at ? 5 : 0, 0, 0],
              hit: kind === 'hit' && i === at,
            }),
          )
          expect(r.events.some((e) => e.type === 'digCompleted')).toBe(false)
        },
      ),
    )
  })
})
