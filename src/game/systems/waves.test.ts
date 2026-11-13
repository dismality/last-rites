import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  BASE_WAVES,
  LIVE_ENEMY_CAP,
  NIGHT_MAP,
  NIGHTS,
  SPAWN_MIN_DISTANCE,
  WAVE_GAP,
  waveAdditions,
  waveSize,
  type NightNumber,
  type WaveComposition,
} from '../../data/waves'
import type { StageNumber } from '../../data/stages'
import { createRng } from '../rng'
import { doorAttackerCount } from './barricade'
import { aliveCap } from './stageWaves'
import {
  createWaveState,
  eligibleGraves,
  expandWave,
  nightTotal,
  queueWaveNow,
  startNight,
  startRiteAssault,
  startStageNight,
  tickWaves,
  type WaveEvent,
  type WaveSpawn,
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

/** Runs a night recording every spawn per wave; zombies die at once, so only the cap paces spawns. */
function spawnsByWave(night: number, seed: number, eliteSeed: number | null) {
  const rng = createRng(seed)
  const eliteRng = eliteSeed === null ? undefined : createRng(eliteSeed)
  let state = startNight(night)
  const waves: WaveSpawn[][] = [[]]
  for (let t = 0; t < 100000 && state.phase !== 'done'; t++) {
    const r = tickWaves(state, 1, { playerPos: FAR, liveCount: 0, rng, eliteRng })
    if (r.events.some((e) => e.type === 'waveCleared')) waves.push([])
    waves[waves.length - 1].push(...r.spawns)
    state = r.state
  }
  return waves.filter((w) => w.length > 0)
}

describe('elites and door attackers in waves', () => {
  it('never rolls an elite without an eliteRng', () => {
    const all = [2, 3, 4, 5].flatMap((n) => spawnsByWave(n, 11, null).flat())
    expect(all.some((s) => s.elite)).toBe(false)
  })

  it('resets the per-wave state at every wave start', () => {
    expect(startNight(2)).toMatchObject({ eliteSpawned: false, attackersLeft: 1 })
    expect(startNight(1).attackersLeft).toBe(1) // floor(4 / 3), no night-2 minimum
    expect(startRiteAssault()).toMatchObject({ eliteSpawned: false, attackersLeft: 5 })
  })

  it('assigns Door_Attackers only to shamblers and brutes', () => {
    const spawns = spawnsByWave(5, 3, null).flat()
    spawns.filter((s) => s.doorAttacker).forEach((s) => expect(['shambler', 'brute']).toContain(s.type))
  })

  it('assigns max(floor(N / 3), 1 from night 2) attackers per wave', () => {
    // **Validates: Requirements 16.9**
    fc.assert(
      fc.property(fc.constantFrom(1, 2, 3, 4, 5), fc.integer(), (night, seed) => {
        const waves = spawnsByWave(night, seed, null)
        waves.forEach((w) => {
          const expected = doorAttackerCount(w.length, night)
          expect(w.filter((s) => s.doorAttacker)).toHaveLength(expected)
        })
      }),
      { numRuns: 25 },
    )
  })

  it('Property 23: elites respect night, type and the one-per-wave limit', () => {
    // **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.11, 15.12**
    fc.assert(
      fc.property(fc.constantFrom(1, 2, 3, 4, 5), fc.integer(), fc.integer(), (night, seed, eliteSeed) => {
        const waves = spawnsByWave(night, seed, eliteSeed)
        waves.forEach((w) => {
          const elites = w.filter((s) => s.elite)
          expect(elites.length).toBeLessThanOrEqual(1)
          if (night === 1) expect(elites).toHaveLength(0)
          elites.forEach((s) => expect(['shambler', 'bloater', 'brute']).toContain(s.type))
        })
        const none = spawnsByWave(night, seed, null)
        expect(none.flat().some((s) => s.elite)).toBe(false)
        // The base rng stream is untouched by elite rolls.
        expect(waves.flat().map((s) => [s.type, s.x, s.z])).toEqual(
          none.flat().map((s) => [s.type, s.x, s.z]),
        )
      }),
      { numRuns: 40 },
    )
  })

  it('Property 23: elites show up for some seeds from night 2', () => {
    const any = Array.from({ length: 60 }, (_, i) => spawnsByWave(4, 1, i).flat()).some((s) =>
      s.some((x) => x.elite),
    )
    expect(any).toBe(true)
  })

  it('Property 29: waves equal the §8 base composition plus the additions', () => {
    // **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.9**
    const counts = (ws: readonly WaveComposition[]) => ws.map((w) => waveSize(w))
    expect(NIGHTS.map((n) => n.waves.length)).toEqual([2, 3, 3, 4, 5])
    fc.assert(
      fc.property(fc.constantFrom<NightNumber>(1, 2, 3, 4, 5), (night) => {
        const base = BASE_WAVES[night]
        const add = waveAdditions(night)
        const waves = NIGHT_MAP[night].waves
        expect(waves).toHaveLength(base.length)
        waves.forEach((w, i) => {
          const a = add[i] ?? {}
          expect(w.shambler).toBe(base[i].shambler)
          expect(w.wailer).toBe(base[i].wailer)
          expect(w.lurker).toBe(base[i].lurker)
          expect(w.bloater).toBe(a.bloater ?? 0)
          expect(w.brute).toBe(a.brute ?? 0)
        })
        expect(nightTotal(night)).toBe(counts(waves).reduce((x, y) => x + y, 0))
      }),
    )
    expect(NIGHT_MAP[3].waves[2].bloater).toBe(1)
    expect(NIGHT_MAP[4].waves[3]).toMatchObject({ bloater: 1, brute: 1 })
    expect(NIGHT_MAP[5].waves.map((w) => [w.bloater, w.brute])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [2, 1],
      [2, 1],
    ])
    expect(waveAdditions(0)).toEqual([])
    expect(waveAdditions(6)).toEqual([])
    expect(startNight(6)).toEqual(createWaveState())
    expect(startNight(3).plan).toBe(NIGHT_MAP[3].waves)
  })

  it('expands a wave lurkers, shamblers, brutes, bloaters, wailers', () => {
    expect(
      expandWave({ shambler: 1, wailer: 1, lurker: 1, bloater: 1, brute: 1 }),
    ).toEqual(['lurker', 'shambler', 'brute', 'bloater', 'wailer'])
  })
})

describe('Story nights are endless until the case is solved', () => {
  const stageArb = fc.constantFrom<StageNumber>(1, 2, 3)

  it('Property 1: waves run exactly while the case is unsolved', () => {
    // Feature: 10-curse-stages, Property 1: Waves run exactly while the case is unsolved
    // **Validates: Requirements 2.1, 2.2**
    fc.assert(
      fc.property(
        stageArb,
        fc.integer(),
        fc.option(fc.integer({ min: 0, max: 400 }), { nil: null }),
        (stage, seed, solvedAt) => {
          const rng = createRng(seed)
          let state = startStageNight(stage)
          let live = 0
          for (let t = 0; t < 600; t++) {
            const solved = solvedAt !== null && t >= solvedAt
            live = Math.max(0, live - (t % 7 === 0 ? 3 : 0))
            const r = tickWaves(state, 1, { playerPos: FAR, liveCount: live, rng, phase: 'night', caseSolved: solved })
            state = r.state
            live += r.spawns.length
            if (solved) {
              expect(r.spawns).toHaveLength(0)
              expect(state.phase).toBe('done')
            } else {
              expect(state.phase).toBe('active')
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 3: never more than the stage cap alive (queued spawns wait)', () => {
    // Feature: 10-curse-stages, Property 3: Alive cap holds
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(stageArb, fc.integer(), fc.integer({ min: 1, max: 900 }), (stage, seed, life) => {
        const rng = createRng(seed)
        let state = startStageNight(stage)
        const deaths: number[] = []
        for (let t = 0; t < 900; t++) {
          while (deaths.length > 0 && deaths[0] <= t) deaths.shift()
          const r = tickWaves(state, 1, { playerPos: FAR, liveCount: deaths.length, rng, phase: 'night' })
          state = r.state
          r.spawns.forEach(() => deaths.push(t + life))
          expect(deaths.length).toBeLessThanOrEqual(aliveCap(stage))
        }
      }),
      { numRuns: 100 },
    )
  })

  it('begins the next wave 20 s after the last zombie falls', () => {
    const rng = createRng(1)
    let r = tickWaves(startStageNight(1), 1, { playerPos: FAR, liveCount: 0, rng, phase: 'night' })
    expect(r.spawns).toHaveLength(4)
    r = tickWaves(r.state, 1, { playerPos: FAR, liveCount: 0, rng, phase: 'night' })
    expect(r.events.map((e) => e.type)).toEqual(['waveCleared'])
    let started = false
    for (let t = 0; t < 25 && !started; t++) {
      r = tickWaves(r.state, 1, { playerPos: FAR, liveCount: 0, rng, phase: 'night' })
      started = r.events.some((e) => e.type === 'waveStarted')
      if (!started) expect(r.state.waveIndex).toBe(0)
    }
    expect(started).toBe(true)
    expect(r.state.waveIndex).toBe(1)
  })

  it('begins the next wave 60 s after the previous began even if zombies still stand', () => {
    const rng = createRng(2)
    let state = startStageNight(1)
    for (let t = 0; t < 59; t++) {
      state = tickWaves(state, 1, { playerPos: FAR, liveCount: 5, rng, phase: 'night' }).state
    }
    expect(state.waveIndex).toBe(0)
    state = tickWaves(state, 1, { playerPos: FAR, liveCount: 5, rng, phase: 'night' }).state
    expect(state.waveIndex).toBe(1)
  })

  it('Property 5: nothing spawns by day, even with a queue waiting', () => {
    // Feature: 10-curse-stages, Property 5: No zombie and no lurker lunge by day
    // **Validates: Requirements 6.1**
    fc.assert(
      fc.property(stageArb, fc.integer(), fc.integer({ min: 1, max: 100 }), (stage, seed, dt) => {
        const r = tickWaves(startStageNight(stage), dt, { playerPos: FAR, liveCount: 0, rng: createRng(seed), phase: 'day' })
        expect(r.spawns).toHaveLength(0)
      }),
      { numRuns: 100 },
    )
  })

  it('Doubt joins the first wave; a wrong altar answer queues a wave at once', () => {
    expect(startStageNight(1, 2).pending).toHaveLength(6)
    const s = queueWaveNow(startStageNight(1))
    expect(s.waveIndex).toBe(1)
    expect(s.pending).toHaveLength(4 + 4)
    expect(queueWaveNow(createWaveState())).toEqual(createWaveState())
  })

  it('elites and door attackers need wave 4 of stage 1', () => {
    expect(startStageNight(1).attackersLeft).toBe(1) // floor(4 / 3), no minimum yet
    const rng = createRng(3)
    const elite = () => 0
    const early = tickWaves(startStageNight(1), 1, { playerPos: FAR, liveCount: 0, rng, eliteRng: elite, eliteChance: 1, phase: 'night' })
    expect(early.spawns.some((s) => s.elite)).toBe(false)
    const late = tickWaves({ ...startStageNight(1), waveIndex: 3 }, 1, { playerPos: FAR, liveCount: 0, rng, eliteRng: elite, eliteChance: 1, phase: 'night' })
    expect(late.spawns.some((s) => s.elite)).toBe(true)
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
