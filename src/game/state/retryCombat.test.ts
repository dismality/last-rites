import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUSK_DURATION_S } from '../../data/balance'
import { COMBAT_PERSISTED, captureCombatSave } from './combatPersistence'
import { useBossStore } from './bossStore'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useEndingStore } from './endingStore'
import { useEnemyStore } from './enemyStore'
import { useFeedbackStore } from './feedbackStore'
import { useGameStore } from './gameStore'
import { useMysteryStore } from './mysteryStore'
import { useProjectileStore } from './projectileStore'
import { retryNight, saveDuskSnapshot, SNAPSHOT_STORES } from './retryNight'
import { useWaveStore } from './waveStore'
import { useWorldStore } from './worldStore'

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

beforeEach(() => {
  vi.stubGlobal('sessionStorage', fakeStorage())
  useCombatStore.setState(useCombatStore.getInitialState(), true)
  useDoorStore.getState().reset()
  useProjectileStore.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

const mag = fc.integer({ min: 0, max: 6 })
const persisted = fc.record({
  magazine: mag,
  axe: fc.integer({ min: 1, max: 60 }),
  boards: fc.array(fc.integer({ min: 1, max: 60 }), { maxLength: 3 }),
  rite: fc.double({ min: 0, max: 44, noNaN: true }),
})

type PersistedCase = { magazine: number; axe: number; boards: number[]; rite: number }

function setPersisted(p: PersistedCase) {
  useCombatStore.setState({
    firearms: { revolver: { magazine: p.magazine } },
    durability: { 'wood-axe': p.axe },
    upgrades: ['up-axe-edge'],
    takenPickups: ['revolver'],
  })
  useDoorStore.setState({ built: true, doors: { front: p.boards, vestry: [] } })
  useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, riteProgress: p.rite } }))
}

/** Arbitrary night: change persisted fields and fill every Night_State store. */
function playNight(junk: number) {
  useCombatStore.setState({
    firearms: { revolver: { magazine: 0 } },
    durability: {},
    upgrades: [],
    takenPickups: [],
  })
  useCombatStore.getState().patchLive({ sinceShotS: junk, kickLeftS: 1, dodgeCooldownS: 1 })
  useDoorStore.setState({ doors: { front: [], vestry: [junk + 1] } })
  useDoorStore.getState().setNail({ door: 'front', elapsedS: 1 })
  useMysteryStore.setState((s) => ({ mystery: { ...s.mystery, riteProgress: 12 } }))
  useEffectStore.getState().setEffects([{ id: 'adrenaline', remainingS: 10 } as never])
  useEnemyStore.getState().setEnemies([{ uid: 'z-1' } as never])
  useFeedbackStore.getState().setTooTired(true)
  useProjectileStore.getState().setSalts([{ id: 's' } as never])
  useProjectileStore.getState().setTraps([{ id: 't' } as never])
  useWaveStore.getState().setTotalWaves(3)
  useEndingStore.getState().setRiteStarted(true)
  useWorldStore.getState().applyWorldState({ phase: 'night', phaseTime: junk, wavesCleared: true })
}

function expectEmptyNight() {
  expect(useEffectStore.getState().effects).toEqual([])
  expect(useEnemyStore.getState().enemies).toEqual([])
  expect(useBossStore.getState().boss).toEqual(useBossStore.getInitialState().boss)
  expect(useFeedbackStore.getState().tooTired).toBe(false)
  expect(useCombatStore.getState().live).toEqual(useCombatStore.getInitialState().live)
  expect(useDoorStore.getState().nail).toBeNull()
  expect(useProjectileStore.getState().salts).toEqual([])
  expect(useProjectileStore.getState().traps).toEqual([])
  expect(useProjectileStore.getState().thrown).toEqual([])
  expect(useWaveStore.getState().totalWaves).toBe(0)
  expect(useEndingStore.getState().riteStarted).toBe(false)
  expect(useGameStore.getState().taken).toBe(false)
}

function persistedView() {
  return {
    save: captureCombatSave({
      built: useDoorStore.getState().built,
      front: [...useDoorStore.getState().doors.front],
      vestry: [...useDoorStore.getState().doors.vestry],
    }),
    rite: useMysteryStore.getState().mystery.riteProgress,
  }
}

describe('Retry Night combat reset', () => {
  /**
   * Feature: 07-combat-and-enemies, Property 31: Retry Night restores the dusk state and clears the night
   * **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.8, 20.9**
   */
  it('Property 31: restores the dusk values, empties the night, and is idempotent', () => {
    fc.assert(
      fc.property(persisted, fc.integer({ min: 0, max: 100 }), (p, junk) => {
        setPersisted(p)
        const atDusk = persistedView()
        expect(saveDuskSnapshot()).toBe(true)

        playNight(junk)
        retryNight()
        expect(persistedView()).toEqual(atDusk)
        expectEmptyNight()
        const world = useWorldStore.getState()
        expect(world.phase).toBe('dusk')
        expect(world.phaseTime).toBe(0)
        expect(DUSK_DURATION_S - world.phaseTime).toBe(30)

        const once = persistedView()
        retryNight()
        expect(persistedView()).toEqual(once)
        expectEmptyNight()
      }),
      { numRuns: 50 },
    )
  })

  it('every persisted combat field is in the snapshot list', () => {
    saveDuskSnapshot()
    const raw = JSON.parse(sessionStorage.getItem('lastrites:dusk') ?? '{}') as Record<
      string,
      Record<string, unknown>
    >
    for (const k of COMBAT_PERSISTED.combat) expect(raw.combat).toHaveProperty(k)
    for (const k of COMBAT_PERSISTED.doors) expect(raw.doors).toHaveProperty(k)
    expect(raw.combat).not.toHaveProperty('live')
    expect(SNAPSHOT_STORES).toHaveProperty('riteProgress')
    // Every key of the Save's combat block is in the snapshot (doors travel as one block).
    const saved = Object.keys(captureCombatSave()).filter((k) => k !== 'doors')
    expect(saved.sort()).toEqual([...COMBAT_PERSISTED.combat].sort())
    expect(raw).toHaveProperty('doors')
  })

  it('without a snapshot it falls back, still clears the night and resets the projectiles', () => {
    useWorldStore.getState().applyWorldState({ phase: 'night', phaseTime: 50, wavesCleared: true })
    playNight(7)
    retryNight()
    expectEmptyNight()
    const world = useWorldStore.getState()
    expect(world.phase).toBe('dusk')
    expect(world.phaseTime).toBe(0)
  })

  it('bumps retryEpoch every time', () => {
    const before = useGameStore.getState().retryEpoch
    retryNight()
    retryNight()
    expect(useGameStore.getState().retryEpoch).toBe(before + 2)
  })
})
