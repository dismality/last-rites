import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DAWN_UPGRADES } from '../../data/dawnUpgrades'
import { clearSubscribers, emit } from '../events'
import type { DawnUpgradeId } from '../types'
import { useAchievementStore } from './achievementStore'
import { startRun } from './progressionActions'
import { useToastStore } from './toastStore'
import { useWorldStore } from './worldStore'
import { createEnemy } from '../systems/enemyAI'
import { useCoinStore } from './coinStore'
import { useEnemyStore } from './enemyStore'
import { useGameStore } from './gameStore'
import { usePlayerStore } from './playerStore'
import { installProgressionWatchers, resetCoinStream } from './progressionEvents'
import { useProgressionStore } from './progressionStore'
import { useScoreStore } from './scoreStore'
import { resetSimClock } from './simClock'

let off: () => void

beforeEach(() => {
  clearSubscribers()
  useProgressionStore.getState().reset()
  useScoreStore.getState().resetNight()
  useCoinStore.getState().clear()
  useEnemyStore.getState().setEnemies([])
  usePlayerStore.getState().setPosition([1, 0, 2])
  useGameStore.setState({ screen: 'game', taken: false })
  resetSimClock()
  resetCoinStream()
  off = installProgressionWatchers()
})

afterEach(() => {
  off()
  clearSubscribers()
})

const kill = (uid: string, enemy: 'wailer' | 'father-crane' = 'wailer') =>
  emit({ type: 'enemyKilled', uid, enemy, source: 'melee', headshot: false, elite: false })

describe('progressionEvents', () => {
  it('one kill pays score, stats and a pile at the zombie once', () => {
    useEnemyStore.getState().setEnemies([createEnemy('z1', 'wailer', { x: 5, z: 6 })])
    kill('z1')
    const pr = useProgressionStore.getState()
    expect(pr.score).toBe(25)
    expect(pr.stats.kills.wailer).toBe(1)
    expect(pr.stats.zombiesBanished).toBe(1)
    const piles = useCoinStore.getState().piles
    expect(piles).toHaveLength(1)
    expect(piles[0]).toMatchObject({ x: 5, z: 6, amount: 2 })
  })

  it('a repeated uid changes nothing', () => {
    kill('z1')
    const before = {
      pr: useProgressionStore.getState().score,
      kills: useProgressionStore.getState().stats.kills.wailer,
      amount: useCoinStore.getState().piles.reduce((n, p) => n + p.amount, 0),
    }
    kill('z1')
    expect(useProgressionStore.getState().score).toBe(before.pr)
    expect(useProgressionStore.getState().stats.kills.wailer).toBe(before.kills)
    expect(useCoinStore.getState().piles.reduce((n, p) => n + p.amount, 0)).toBe(before.amount)
  })

  it('a Crane enemyKilled scores 0 while bossDefeated scores 1000 once', () => {
    kill('crane', 'father-crane')
    expect(useProgressionStore.getState().score).toBe(0)
    expect(useCoinStore.getState().piles).toHaveLength(0)
    emit({ type: 'bossDefeated' })
    emit({ type: 'bossDefeated' })
    expect(useProgressionStore.getState().score).toBe(1000)
    expect(useProgressionStore.getState().bossScored).toBe(true)
  })

  it('a kill whose zombie has gone drops the pile at the player feet', () => {
    kill('gone')
    expect(useCoinStore.getState().piles[0]).toMatchObject({ x: 1, z: 2, amount: 2 })
  })

  it('ignores events off the game screen or when taken', () => {
    useGameStore.setState({ screen: 'title' })
    kill('a')
    useGameStore.setState({ screen: 'game', taken: true })
    kill('b')
    emit({ type: 'digCompleted', graveId: 'g', loot: [], scareId: null })
    expect(useProgressionStore.getState().score).toBe(0)
    expect(useProgressionStore.getState().stats.digs).toBe(0)
  })

  it('counts melee hits, shots, digs and boards', () => {
    emit({ type: 'meleeHit', uid: 'z' })
    emit({ type: 'firearmFired', weapon: 'revolver', hit: true })
    emit({ type: 'firearmFired', weapon: 'revolver', hit: false })
    emit({ type: 'digCompleted', graveId: 'g', loot: [], scareId: null })
    emit({ type: 'boardNailed', door: 'front' })
    const s = useProgressionStore.getState().stats
    expect([s.meleeHits, s.shotsFired, s.shotsHit, s.digs, s.boardsNailed]).toEqual([1, 2, 1, 1, 1])
  })
})

describe('progressionEvents: contracts, dawn, storms and achievements', () => {
  beforeEach(() => {
    useToastStore.setState({ queue: [] })
    useAchievementStore.setState({ unlocked: [], visible: [], queued: [] })
    useGameStore.setState({ screen: 'game', taken: false })
  })

  it('deals two contracts at run start', () => {
    startRun('normal')
    expect(useProgressionStore.getState().contracts).toHaveLength(2)
  })

  it('a dawn with every upgrade maxed sets no pick', () => {
    const ranks: Partial<Record<DawnUpgradeId, number>> = {}
    for (const d of DAWN_UPGRADES) ranks[d.id] = d.maxRank
    useProgressionStore.getState().patch({ ranks })
    emit({ type: 'dawnStarted', nightNumber: 1 })
    expect(useProgressionStore.getState().pendingPick).toBeNull()
    expect(useProgressionStore.getState().dawnSummary?.night).toBe(1)
  })

  it('the same seed gives the same offers, stock and storm after a Retry', () => {
    const run = () => {
      useProgressionStore.getState().patch({ seed: 4242, storm: { active: false } })
      useWorldStore.getState().applyWorldState({ phase: 'night', nightNumber: 5 })
      emit({ type: 'nightStarted', nightNumber: 5 })
      const storm = useProgressionStore.getState().storm.active
      emit({ type: 'dawnStarted', nightNumber: 4 })
      const offer = useProgressionStore.getState().pendingPick
      useWorldStore.getState().applyWorldState({ phase: 'day', nightNumber: 2 })
      emit({ type: 'phaseChanged', phase: 'day' })
      return { storm, offer, stock: useProgressionStore.getState().stock }
    }
    const first = run()
    const second = run()
    expect(second).toEqual(first)
    expect(first.storm).toBe(true) // night 5 always storms
    expect(first.offer).toHaveLength(3)
    expect(first.stock).not.toBeNull()
  })

  it('any phase change ends the storm', () => {
    useProgressionStore.getState().patch({ storm: { active: true } })
    emit({ type: 'phaseChanged', phase: 'dawn' })
    expect(useProgressionStore.getState().storm.active).toBe(false)
  })

  it('c-unhurt pays at 50 damage or less, once, with a 3 s toast', () => {
    useProgressionStore.getState().patch({ contracts: [{ id: 'c-unhurt', progress: 0, done: false }] })
    emit({ type: 'playerDamaged', amount: 30 })
    emit({ type: 'playerDamaged', amount: 20 })
    emit({ type: 'nightCleared', nightNumber: 1 })
    emit({ type: 'nightCleared', nightNumber: 1 })
    const pr = useProgressionStore.getState()
    expect(pr.contracts[0].done).toBe(true)
    expect(pr.coins).toBe(30)
    const toasts = useToastStore.getState().queue
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ text: 'Contract done: Unscathed, +30 coins', durationMs: 3000 })
  })

  it('c-unhurt does not pay at 51 damage', () => {
    useProgressionStore.getState().patch({ contracts: [{ id: 'c-unhurt', progress: 0, done: false }] })
    emit({ type: 'playerDamaged', amount: 51 })
    emit({ type: 'nightCleared', nightNumber: 1 })
    expect(useProgressionStore.getState().contracts[0].done).toBe(false)
  })

  it('a dig advances a dig contract and pays it once', () => {
    useProgressionStore.getState().patch({ contracts: [{ id: 'c-dig-3', progress: 0, done: false }] })
    for (let i = 0; i < 4; i++) emit({ type: 'digCompleted', graveId: 'g', loot: [], scareId: null })
    expect(useProgressionStore.getState().coins).toBe(15)
    expect(useToastStore.getState().queue).toHaveLength(1)
  })

  it('an achievement unlocks once with one toast', () => {
    emit({ type: 'dawnStarted', nightNumber: 1 })
    emit({ type: 'dawnStarted', nightNumber: 1 })
    const ach = useAchievementStore.getState()
    expect(ach.unlocked).toEqual(['a-first-light'])
    expect(ach.visible).toHaveLength(1)
  })
})
