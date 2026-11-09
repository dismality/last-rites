// Checkpoint integration tests for spec 08-progression-and-atmosphere, task 8.5.
//
// Headless stand-in for a play session: a night 1 to dawn flow, a save/load round trip, a failed
// night replayed with Retry Night, and an Endless night 6 plan. They run the real zustand stores
// and the real progression watchers in node. Rendering, audio and feel are out of reach here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_MAX_HEALTH } from '../src/data/balance'
import { clearSubscribers, emit } from '../src/game/events'
import { useCoinStore } from '../src/game/state/coinStore'
import { currentModifiers } from '../src/game/state/derivedStats'
import { loadGame, saveGame } from '../src/game/state/gameSave'
import { useGameStore } from '../src/game/state/gameStore'
import { useInventoryStore } from '../src/game/state/inventoryStore'
import { usePlayerStore } from '../src/game/state/playerStore'
import { installProgressionWatchers, resetCoinStream } from '../src/game/state/progressionEvents'
import { buyFromMerchant, pickUpgrade, startRun } from '../src/game/state/progressionActions'
import { captureProgressionSave } from '../src/game/state/progressionPersistence'
import { useProgressionStore } from '../src/game/state/progressionStore'
import { retryNight, saveDuskSnapshot } from '../src/game/state/retryNight'
import { useScoreStore } from '../src/game/state/scoreStore'
import { resetSimClock, simClock } from '../src/game/state/simClock'
import { useWorldStore } from '../src/game/state/worldStore'
import { countItem } from '../src/game/systems/inventory'
import { nightPlan } from '../src/game/systems/waves'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  } as Storage
}

const SEED = 1849
let off: () => void

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('sessionStorage', fakeStorage())
  clearSubscribers()
  resetSimClock()
  resetCoinStream()
  startRun('normal')
  useGameStore.setState({ screen: 'game', taken: false })
  // startRun draws its seed and contracts from Math.random; pin both so the flow is repeatable.
  useProgressionStore.getState().patch({
    seed: SEED,
    contracts: [
      { id: 'c-wailer-2', progress: 0, done: false },
      { id: 'c-dig-3', progress: 0, done: false },
    ],
  })
  off = installProgressionWatchers()
})

afterEach(() => {
  off()
  clearSubscribers()
  vi.unstubAllGlobals()
})

const kill = (uid: string): void => {
  simClock.now += 1
  emit({ type: 'enemyKilled', uid, enemy: 'wailer', source: 'melee', headshot: false, elite: false })
}

/** Banks the piles the way walking over them would. */
function collectPiles(): number {
  const coins = useCoinStore.getState()
  const total = coins.piles.reduce((n, p) => n + p.amount, 0)
  coins.setPiles([], coins.nextId)
  useProgressionStore.getState().addCoins(total)
  return total
}

/** Plays night 1 up to the dawn card and returns the coins the piles held. */
function playNightOne(): number {
  useWorldStore.getState().applyWorldState({ phase: 'night', nightNumber: 1 })
  emit({ type: 'nightStarted', nightNumber: 1 })
  for (let i = 0; i < 4; i++) kill(`w${i}`)
  for (let i = 0; i < 3; i++) emit({ type: 'digCompleted', graveId: `g${i}`, loot: [], scareId: null })
  const piled = collectPiles()
  emit({ type: 'nightCleared', nightNumber: 1 })
  useWorldStore.getState().applyWorldState({ phase: 'dawn', nightNumber: 1 })
  emit({ type: 'dawnStarted', nightNumber: 1 })
  return piled
}

describe('progression checkpoint: night 1 to dawn', () => {
  it('builds combo, coins, night score, an upgrade, purchases and contract pay', () => {
    const piled = playNightOne()
    const pr = useProgressionStore.getState()

    // Wailers are worth 25 at ×1, 1.25, 1.5, 1.75, each rounded.
    expect(useScoreStore.getState().combo).toBe(1.75)
    expect(pr.stats.kills.wailer).toBe(4)
    expect(piled).toBe(8)
    // Wailer contract 20 + dig contract 15 were paid on completion, the piles on pickup.
    // Dawn then deals a fresh pair for the new day.
    expect(pr.contracts).toHaveLength(2)
    expect(pr.contracts.every((c) => !c.done && c.progress === 0)).toBe(true)
    expect(pr.coins).toBe(20 + 15 + 8)

    // Night score = kill points + 100 for night 1 + 200 for taking no damage.
    const kills = 25 + 31 + 38 + 44
    expect(pr.dawnSummary).toMatchObject({
      night: 1,
      zombiesBanished: 4,
      killPoints: kills,
      clearBonus: 100,
      noDamageBonus: 200,
      nightScore: kills + 300,
    })
    expect(pr.score).toBe(kills + 300)

    // Dawn waits for a pick; the seeded offer is three different upgrades.
    expect(pr.pendingPick).toHaveLength(3)
    expect(new Set(pr.pendingPick).size).toBe(3)
    useProgressionStore.getState().patch({ pendingPick: ['iron-constitution', 'steady-hands', 'long-wick'] })
    const hpBefore = usePlayerStore.getState().health
    expect(pickUpgrade('iron-constitution')).toBe(true)
    expect(useProgressionStore.getState().pendingPick).toBeNull()
    expect(useProgressionStore.getState().ranks['iron-constitution']).toBe(1)
    expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH + 15)
    expect(usePlayerStore.getState().health).toBe(Math.min(PLAYER_MAX_HEALTH + 15, hpBefore + 15))
    // A second pick has nothing open.
    expect(pickUpgrade('steady-hands')).toBe(false)

    // Day 2: the merchant has stock; buying moves coins, stock and satchel together.
    useWorldStore.getState().applyWorldState({ phase: 'day', nightNumber: 1 })
    emit({ type: 'phaseChanged', phase: 'day' })
    const stock = useProgressionStore.getState().stock
    expect(stock?.rows).toHaveLength(5)
    const bandagesBefore = countItem(useInventoryStore.getState().inventory, 'bandage')
    expect(buyFromMerchant('bandage').ok).toBe(true)
    expect(buyFromMerchant('lamp-oil').ok).toBe(true)
    const after = useProgressionStore.getState()
    expect(after.coins).toBe(43 - 6 - 4)
    expect(after.stats.coinsSpent).toBe(10)
    expect(after.stock?.rows.find((r) => r.id === 'bandage')?.qty).toBe(2)
    expect(countItem(useInventoryStore.getState().inventory, 'bandage')).toBe(bandagesBefore + 1)
    // Unaffordable buys change nothing.
    useProgressionStore.getState().patch({ coins: 0 })
    expect(buyFromMerchant('bandage').ok).toBe(false)
    expect(useProgressionStore.getState().stock?.rows.find((r) => r.id === 'bandage')?.qty).toBe(2)
  })

  it('save then load restores progression, satchel and max HP', () => {
    playNightOne()
    useProgressionStore.getState().patch({ pendingPick: ['iron-constitution', 'steady-hands', 'long-wick'] })
    pickUpgrade('iron-constitution')
    useWorldStore.getState().applyWorldState({ phase: 'day', nightNumber: 1 })
    emit({ type: 'phaseChanged', phase: 'day' })
    buyFromMerchant('bandage')

    const progression = captureProgressionSave()
    const inventory = structuredClone(useInventoryStore.getState().inventory)
    expect(saveGame()).toBe(true)

    // Wreck the run, then load.
    startRun('hard')
    expect(useProgressionStore.getState().coins).toBe(0)
    expect(loadGame()).toBe(true)

    expect(captureProgressionSave()).toEqual(progression)
    expect(useInventoryStore.getState().inventory).toEqual(inventory)
    expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH + currentModifiers().maxHealthBonus)
    expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH + 15)
  })
})

describe('progression checkpoint: Retry Night', () => {
  it('a failed night comes back to the dusk snapshot with an empty night', () => {
    playNightOne()
    useProgressionStore.getState().patch({ pendingPick: ['iron-constitution', 'steady-hands', 'long-wick'] })
    pickUpgrade('iron-constitution')
    useWorldStore.getState().applyWorldState({ phase: 'day', nightNumber: 1 })
    emit({ type: 'phaseChanged', phase: 'day' })
    useWorldStore.getState().applyWorldState({ phase: 'dusk', nightNumber: 2 })
    emit({ type: 'phaseChanged', phase: 'dusk' })
    expect(saveDuskSnapshot()).toBe(true)
    const dusk = captureProgressionSave()

    // Night 2 goes badly.
    useWorldStore.getState().applyWorldState({ phase: 'night', nightNumber: 2 })
    emit({ type: 'nightStarted', nightNumber: 2 })
    for (let i = 0; i < 3; i++) kill(`n2-${i}`)
    emit({ type: 'playerDamaged', amount: 40 })
    useProgressionStore.getState().addCoins(50)
    expect(useProgressionStore.getState().score).toBeGreaterThan(dusk.score)
    expect(useCoinStore.getState().piles.length).toBeGreaterThan(0)
    useGameStore.setState({ taken: true })

    retryNight()

    expect(captureProgressionSave()).toEqual(dusk)
    expect(useCoinStore.getState().piles).toEqual([])
    expect(useScoreStore.getState().combo).toBe(1)
    expect(useScoreStore.getState().nightKills).toBe(0)
    expect(useScoreStore.getState().nightDamage).toBe(0)
    expect(useGameStore.getState().taken).toBe(false)
    expect(useWorldStore.getState().phase).toBe('dusk')
    expect(useWorldStore.getState().phaseTime).toBe(0)
    expect(usePlayerStore.getState().maxHealth).toBe(PLAYER_MAX_HEALTH + 15)
  })

  it('replays the same coin drops after a Retry (same seed, same night)', () => {
    useWorldStore.getState().applyWorldState({ phase: 'dusk', nightNumber: 1 })
    saveDuskSnapshot()
    const run = (): number[] => {
      useWorldStore.getState().applyWorldState({ phase: 'night', nightNumber: 1 })
      emit({ type: 'nightStarted', nightNumber: 1 })
      for (let i = 0; i < 12; i++) {
        emit({ type: 'enemyKilled', uid: `s${i}`, enemy: 'shambler', source: 'melee', headshot: false, elite: false })
      }
      return useCoinStore.getState().piles.map((p) => p.amount)
    }
    const first = run()
    retryNight()
    expect(run()).toEqual(first)
  })
})

describe('progression checkpoint: Endless', () => {
  it('plans night 6 from the generator and refuses Retry Night', () => {
    startRun('endless')
    const plan = nightPlan('endless', 6)
    // min(2 + 3, 6) waves of 4 + 6 shamblers, 3 wailers, 2 lurkers, 2 bloaters and 1 brute.
    expect(plan).toHaveLength(5)
    for (const wave of plan) {
      expect(wave).toMatchObject({ shambler: 10, wailer: 3, lurker: 2, bloater: 2, brute: 1 })
    }
    expect(nightPlan('endless', 1)).toHaveLength(2)

    useProgressionStore.getState().patch({ coins: 7 })
    saveDuskSnapshot()
    useProgressionStore.getState().patch({ coins: 99 })
    retryNight()
    expect(useProgressionStore.getState().coins).toBe(99)
  })
})
