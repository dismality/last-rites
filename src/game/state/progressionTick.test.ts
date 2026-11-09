import { beforeEach, describe, expect, it } from 'vitest'
import { DAY_DURATION_S, LAST_NIGHT } from '../../data/balance'
import { subscribeToType } from '../events'
import { startStorm } from '../systems/storm'
import { useCoinStore } from './coinStore'
import { useGameStore } from './gameStore'
import { musicRuntime } from './musicRuntime'
import { deriveTickInput, progressionTick } from './progressionTick'
import { useProgressionStore } from './progressionStore'
import { useScoreStore } from './scoreStore'
import { resetSimClock, simClock } from './simClock'
import { stormRuntime } from './stormRuntime'
import { useWorldStore } from './worldStore'
import { usePlayerStore } from './playerStore'

beforeEach(() => {
  useProgressionStore.getState().reset()
  useScoreStore.getState().resetNight()
  useCoinStore.getState().clear()
  useGameStore.setState({ taken: false, paused: false, examining: false, journalOpen: false })
  useWorldStore.setState({ phase: 'day', nightNumber: 1 })
  usePlayerStore.getState().setPosition([0, 0, 0])
  resetSimClock()
  musicRuntime.reset()
  stormRuntime.reset()
})

function snapshot() {
  const p = useProgressionStore.getState()
  return {
    now: simClock.now,
    timeS: p.stats.timeS,
    combo: useScoreStore.getState().combo,
    lastKillAt: useScoreStore.getState().lastKillAt,
    stems: [...musicRuntime.stems],
    master: musicRuntime.master,
    strikeIn: stormRuntime.storm.strikeIn,
    layer: musicRuntime.layer,
  }
}

describe('progressionTick', () => {
  it('one 0.1 s step equals ten 0.01 s steps', () => {
    const setup = () => {
      beforeEachReset()
      useWorldStore.setState({ phase: 'dusk' })
      useScoreStore.getState().patch({ combo: 2, lastKillAt: 0 })
      useProgressionStore.getState().patch({ storm: { active: true } })
      musicRuntime.silence = { pending: [], holdUntil: 0.05 }
    }
    setup()
    progressionTick(0.1)
    const one = snapshot()
    setup()
    for (let i = 0; i < 10; i++) progressionTick(0.01)
    const ten = snapshot()

    expect(ten.now).toBeCloseTo(one.now, 9)
    expect(ten.timeS).toBeCloseTo(one.timeS, 9)
    expect(ten.combo).toBe(one.combo)
    expect(ten.lastKillAt).toBe(one.lastKillAt)
    expect(ten.layer).toBe(one.layer)
    expect(ten.strikeIn).toBeCloseTo(one.strikeIn ?? 0, 9)
    // Silence ends mid-step, so the master gain differs by the step size only at that edge.
    expect(ten.stems[0]).toBeCloseTo(one.stems[0], 6)
    expect(one.master).toBeGreaterThanOrEqual(0)
  })

  it('a frozen sim changes nothing', () => {
    useCoinStore.getState().setPiles([{ id: 1, x: 0, z: 0, amount: 3, age: 0 }])
    const before = snapshot()
    useGameStore.setState({ paused: true })
    progressionTick(0.5)
    useGameStore.setState({ paused: false, taken: true })
    progressionTick(0.5)
    expect(snapshot()).toEqual(before)
    expect(useProgressionStore.getState().coins).toBe(0)
    expect(useCoinStore.getState().piles).toHaveLength(1)
  })

  it('does not count time while a pick is open', () => {
    useProgressionStore.getState().patch({ pendingPick: ['long-wick'] })
    progressionTick(0.5)
    expect(useProgressionStore.getState().stats.timeS).toBe(0)
    expect(simClock.now).toBeCloseTo(0.5)
  })

  it('banks a collected pile once', () => {
    useCoinStore.getState().setPiles([
      { id: 1, x: 0.5, z: 0, amount: 4, age: 0 },
      { id: 2, x: 40, z: 40, amount: 9, age: 0 },
    ])
    progressionTick(1 / 60)
    progressionTick(1 / 60)
    const p = useProgressionStore.getState()
    expect(p.coins).toBe(4)
    expect(p.stats.coinsEarned).toBe(4)
    expect(useCoinStore.getState().piles.map((x) => x.id)).toEqual([2])
  })

  it('expires a pile after 60 s without paying it', () => {
    useCoinStore.getState().setPiles([{ id: 1, x: 40, z: 40, amount: 9, age: 59.99 }])
    progressionTick(0.1)
    expect(useCoinStore.getState().piles).toHaveLength(0)
    expect(useProgressionStore.getState().coins).toBe(0)
  })

  it('emits thunderRolled when scheduled thunder is due', () => {
    useProgressionStore.getState().patch({ storm: { active: true } })
    stormRuntime.storm = { ...startStorm(1849, 1), thunder: [{ inS: 0.05, close: true }] }
    const seen: boolean[] = []
    const off = subscribeToType('thunderRolled', (e) => seen.push(e.close))
    progressionTick(0.1)
    off()
    expect(seen).toEqual([true])
  })
})

describe('deriveTickInput', () => {
  it('carries the dawn hold', () => {
    expect(deriveTickInput().holdDawn).toBe(false)
    useProgressionStore.getState().patch({ pendingPick: ['long-wick'] })
    expect(deriveTickInput().holdDawn).toBe(true)
  })

  it('uses the defaults in story modes', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const) {
      useProgressionStore.getState().patch({ mode })
      expect(deriveTickInput()).toMatchObject({ dayLengthS: DAY_DURATION_S, lastNight: LAST_NIGHT })
    }
  })

  it('gives Endless a 120 s day and no last night', () => {
    useProgressionStore.getState().patch({ mode: 'endless' })
    const i = deriveTickInput()
    expect(i.dayLengthS).toBe(120)
    expect(i.lastNight).toBe(Infinity)
  })
})

function beforeEachReset(): void {
  useProgressionStore.getState().reset()
  useScoreStore.getState().resetNight()
  useCoinStore.getState().clear()
  useWorldStore.setState({ phase: 'day', nightNumber: 1 })
  resetSimClock()
  musicRuntime.reset()
  stormRuntime.reset()
}
