import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { LIVE_ENEMY_CAP, NIGHTS, SPAWN_MIN_DISTANCE, WAVE_GAP, type NightNumber } from '../../data/waves'
import { createRng } from '../rng'
import {
  createWaveState,
  eligibleGraves,
  nightTotal,
  startNight,
  tickWaves,
  type WaveEvent,
  type WaveState,
} from './waves'

const DT = 1 / 60
const FAR = { x: 0, z: 0 }

interface SimResult {
  state: WaveState
  events: WaveEvent[]
  totalSpawned: number
  maxLive: number
  spawnDistances: number[]
}

/** Runs a night; zombies die `lifeTicks` ticks after spawning. */
function simulate(night: number, lifeTicks: number, seed: number, maxTicks = 200000): SimResult {
  const rng = createRng(seed)
  let state = startNight(night)
  const deaths: number[] = []
  const events: WaveEvent[] = []
  const spawnDistances: number[] = []
  let totalSpawned = 0
  let maxLive = 0
  for (let t = 0; t < maxTicks && state.phase !== 'done'; t++) {
    while (deaths.length > 0 && deaths[0] <= t) deaths.shift()
    const r = tickWaves(state, DT, { playerPos: FAR, liveCount: deaths.length, rng })
    state = r.state
    events.push(...r.events)
    r.spawns.forEach((s) => {
      deaths.push(t + lifeTicks)
      spawnDistances.push(Math.hypot(s.x - FAR.x, s.z - FAR.z))
    })
    totalSpawned += r.spawns.length
    maxLive = Math.max(maxLive, deaths.length)
  }
  return { state, events, totalSpawned, maxLive, spawnDistances }
}

describe('tickWaves', () => {
  it('is inert before a night starts', () => {
    const r = tickWaves(createWaveState(), 1, { playerPos: FAR, liveCount: 0, rng: createRng(1) })
    expect(r.spawns).toEqual([])
    expect(r.events).toEqual([])
  })

  it('spawns the first wave at once and waits 15 s after it is cleared', () => {
    const rng = createRng(2)
    let r = tickWaves(startNight(1), DT, { playerPos: FAR, liveCount: 0, rng })
    expect(r.spawns).toHaveLength(4)
    // Everything dead: wave 1 cleared, gap begins.
    r = tickWaves(r.state, DT, { playerPos: FAR, liveCount: 0, rng })
    expect(r.events.map((e) => e.type)).toEqual(['waveCleared'])
    expect(r.state.phase).toBe('gap')
    expect(r.state.gapTimer).toBe(WAVE_GAP)
    // Just short of 15 s: still waiting.
    r = tickWaves(r.state, WAVE_GAP - 0.5, { playerPos: FAR, liveCount: 0, rng })
    expect(r.state.phase).toBe('gap')
    r = tickWaves(r.state, 0.5, { playerPos: FAR, liveCount: 0, rng })
    expect(r.events.map((e) => e.type)).toEqual(['waveStarted'])
    expect(r.state.phase).toBe('active')
  })

  it('does not clear while zombies are still alive', () => {
    const rng = createRng(3)
    const first = tickWaves(startNight(1), DT, { playerPos: FAR, liveCount: 0, rng })
    const r = tickWaves(first.state, DT, { playerPos: FAR, liveCount: 2, rng })
    expect(r.events).toEqual([])
    expect(r.state.phase).toBe('active')
  })

  it('emits wavesCleared exactly once when the last wave is cleared', () => {
    const { events, state } = simulate(2, 30, 4)
    expect(state.phase).toBe('done')
    expect(events.filter((e) => e.type === 'wavesCleared')).toHaveLength(1)
    expect(events.filter((e) => e.type === 'waveCleared')).toHaveLength(3)
    const after = tickWaves(state, 100, { playerPos: FAR, liveCount: 0, rng: createRng(1) })
    expect(after.events).toEqual([])
  })

  it('defers spawns beyond the live cap', () => {
    const rng = createRng(5)
    // Night 5 wave is 12 strong; with 10 alive only 4 may spawn.
    const r = tickWaves(startNight(5), DT, { playerPos: FAR, liveCount: 10, rng })
    expect(r.spawns).toHaveLength(LIVE_ENEMY_CAP - 10)
    expect(r.state.pending).toHaveLength(12 - (LIVE_ENEMY_CAP - 10))
  })

  it('waits when every grave is too close to the player', () => {
    const graves = [{ id: 'near', x: 3, z: 3 }]
    const r = tickWaves(startNight(1), DT, { playerPos: FAR, liveCount: 0, rng: createRng(6), graves })
    expect(r.spawns).toEqual([])
    expect(r.state.pending).toHaveLength(4)
    expect(r.events).toEqual([])
  })

  it('only offers graves at least 15 m away', () => {
    const graves = [
      { id: 'a', x: 14.9, z: 0 },
      { id: 'b', x: 15, z: 0 },
    ]
    expect(eligibleGraves(graves, FAR).map((g) => g.id)).toEqual(['b'])
  })
})

describe('wave director properties', () => {
  const nightArb = fc.constantFrom(...NIGHTS.map((n) => n.night as NightNumber))

  it('spawns exactly the sum of the wave compositions and never exceeds the cap', () => {
    // **Validates: Requirements 5.1, 5.5**
    fc.assert(
      fc.property(nightArb, fc.integer({ min: 1, max: 600 }), fc.integer(), (night, life, seed) => {
        const r = simulate(night, life, seed)
        expect(r.state.phase).toBe('done')
        expect(r.totalSpawned).toBe(nightTotal(night))
        expect(r.state.spawned).toBe(nightTotal(night))
        expect(r.maxLive).toBeLessThanOrEqual(LIVE_ENEMY_CAP)
      }),
      { numRuns: 40 },
    )
  })

  it('always spawns at least 15 m from the player', () => {
    // **Validates: Requirements 5.2**
    fc.assert(
      fc.property(nightArb, fc.integer(), (night, seed) => {
        simulate(night, 60, seed).spawnDistances.forEach((d) =>
          expect(d).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE),
        )
      }),
      { numRuns: 20 },
    )
  })
})
