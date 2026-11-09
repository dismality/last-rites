import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  cancelReload,
  canReload,
  completeReload,
  pullTrigger,
  reloadReady,
  startReload,
  tickFirearm,
  type FirearmState,
  type FirearmStats,
} from './firearm'

const statsArb: fc.Arbitrary<FirearmStats> = fc.record({
  capacity: fc.integer({ min: 1, max: 8 }),
  reloadS: fc.double({ min: 0.5, max: 3, noNaN: true }),
  fireIntervalS: fc.double({ min: 0.1, max: 1, noNaN: true }),
})

const stateArb = (st: FirearmStats): fc.Arbitrary<FirearmState> =>
  fc.record({
    magazine: fc.integer({ min: 0, max: st.capacity }),
    reloadLeftS: fc.option(fc.double({ min: 0, max: 3, noNaN: true }), { nil: null }),
    sinceShotS: fc.double({ min: 0, max: 5, noNaN: true }),
  })

const caseArb = statsArb.chain((st) => fc.tuple(fc.constant(st), stateArb(st)))

describe('firearm unit', () => {
  const st: FirearmStats = { capacity: 6, reloadS: 2.4, fireIntervalS: 0.45 }
  it('fires, then blocks until the interval passes', () => {
    const s0: FirearmState = { magazine: 6, reloadLeftS: null, sinceShotS: 9 }
    const a = pullTrigger(s0, st)
    expect(a.outcome).toBe('fired')
    expect(a.state.magazine).toBe(5)
    expect(pullTrigger(a.state, st).outcome).toBe('cooldown')
    expect(pullTrigger(tickFirearm(a.state, 0.45), st).outcome).toBe('fired')
  })
  it('dry pull does not start a reload', () => {
    const s0: FirearmState = { magazine: 0, reloadLeftS: null, sinceShotS: 9 }
    const r = pullTrigger(s0, st)
    expect(r.outcome).toBe('dry')
    expect(r.state.reloadLeftS).toBeNull()
  })
  it('reload runs, completes and takes rounds from the stack', () => {
    let s = startReload({ magazine: 2, reloadLeftS: null, sinceShotS: 9 }, st, 3)
    expect(s.reloadLeftS).toBe(2.4)
    s = tickFirearm(s, 2.5)
    expect(reloadReady(s)).toBe(true)
    const done = completeReload(s, st, 3)
    expect(done.state.magazine).toBe(5)
    expect(done.ammoUsed).toBe(3)
  })
})

describe('firearm properties', () => {
  // Feature: 07-combat-and-enemies, Property 7 (magazine half)
  it('spends one round only when the shot is allowed', () => {
    /** Validates: Requirements 3.1, 3.2, 3.3 */
    fc.assert(
      fc.property(caseArb, ([st, s]) => {
        const { state, outcome } = pullTrigger(s, st)
        const allowed = s.reloadLeftS === null && s.magazine > 0 && s.sinceShotS >= st.fireIntervalS
        expect(outcome === 'fired').toBe(allowed)
        expect(state.magazine).toBe(allowed ? s.magazine - 1 : s.magazine)
        if (allowed) expect(state.sinceShotS).toBe(0)
      }),
    )
  })

  // Feature: 07-combat-and-enemies, Property 8
  it('refused trigger pulls change nothing', () => {
    /** Validates: Requirements 3.8, 3.9, 3.10, 4.3, 4.6, 5.10 */
    fc.assert(
      fc.property(caseArb, ([st, s]) => {
        const { state, outcome } = pullTrigger(s, st)
        if (outcome === 'fired') return
        expect(state).toEqual(s)
        expect(['dry', 'reloading', 'cooldown']).toContain(outcome)
        if (outcome === 'dry') expect(state.reloadLeftS).toBe(s.reloadLeftS)
      }),
    )
  })

  // Feature: 07-combat-and-enemies, Property 9
  it('reload conserves rounds, stays in range and is idempotent', () => {
    /** Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.7, 4.10, 4.11, 4.12 */
    fc.assert(
      fc.property(caseArb, fc.integer({ min: 0, max: 36 }), ([st, s0], stack) => {
        const idle: FirearmState = { ...s0, reloadLeftS: null }
        const started = startReload(idle, st, stack)
        if (canReload(idle, st, stack)) {
          expect(started.reloadLeftS).toBe(st.reloadS)
        } else {
          expect(started).toEqual(idle)
        }
        // A second start while reloading, or a full/empty case, changes nothing.
        expect(startReload(started, st, stack)).toEqual(started)

        // Cancel leaves magazine untouched.
        const cancelled = cancelReload(started)
        expect(cancelled.magazine).toBe(idle.magazine)
        expect(cancelled.reloadLeftS).toBeNull()

        const running = { ...started, reloadLeftS: started.reloadLeftS === null ? null : 0 }
        const first = completeReload(running, st, stack)
        const missing = st.capacity - idle.magazine
        if (running.reloadLeftS !== null) {
          expect(first.ammoUsed).toBe(Math.min(missing, stack))
        } else {
          expect(first.ammoUsed).toBe(0)
        }
        expect(first.state.magazine + (stack - first.ammoUsed)).toBe(idle.magazine + stack)
        expect(first.state.magazine).toBeGreaterThanOrEqual(0)
        expect(first.state.magazine).toBeLessThanOrEqual(st.capacity)
        const second = completeReload(first.state, st, stack - first.ammoUsed)
        expect(second.state).toEqual(first.state)
        expect(second.ammoUsed).toBe(0)
      }),
    )
  })
})
