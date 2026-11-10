// Spec 09, B2: a retried night (or morning) always starts fair. The playtest died again and again
// because Retry Night restored a 39% oil dusk exactly.
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RETRY_MIN_FUEL } from '../../data/balance'
import { useGameStore } from './gameStore'
import { useLanternStore } from './lanternStore'
import { usePlayerStore } from './playerStore'
import { useUiWorldStore } from './uiWorldStore'
import { useWorldStore } from './worldStore'
import {
  clearMorningSnapshot,
  hasMorningSnapshot,
  retryFromMorning,
  retryNight,
  saveDuskSnapshot,
  saveMorningSnapshot,
} from './retryNight'

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

beforeEach(() => vi.stubGlobal('sessionStorage', fakeStorage()))
afterEach(() => vi.unstubAllGlobals())

const fuel = fc.double({ min: 0, max: 100, noNaN: true })
const health = fc.integer({ min: 1, max: 100 })

function die(atFuel: number): void {
  useLanternStore.getState().setFuel(atFuel)
  usePlayerStore.getState().setHealth(0)
  useGameStore.getState().setTaken(true)
}

describe('Retry Night is fair', () => {
  it('never starts below the minimum oil and always at full health (property)', () => {
    fc.assert(
      fc.property(fuel, health, fuel, (duskFuel, duskHealth, deathFuel) => {
        useLanternStore.getState().setFuel(duskFuel)
        usePlayerStore.getState().setHealth(duskHealth)
        saveDuskSnapshot()
        die(deathFuel)
        retryNight()
        const max = usePlayerStore.getState().maxHealth
        expect(useLanternStore.getState().fuel).toBeGreaterThanOrEqual(RETRY_MIN_FUEL)
        expect(useLanternStore.getState().fuel).toBe(Math.max(RETRY_MIN_FUEL, duskFuel))
        expect(usePlayerStore.getState().health).toBe(max)
        expect(useUiWorldStore.getState().playerHealth).toBe(max)
        expect(useGameStore.getState().taken).toBe(false)
      }),
    )
  })

  it('applies the same floor when no dusk snapshot exists (fallback path)', () => {
    fc.assert(
      fc.property(fuel, (deathFuel) => {
        sessionStorage.clear()
        die(deathFuel)
        retryNight()
        expect(useLanternStore.getState().fuel).toBeGreaterThanOrEqual(RETRY_MIN_FUEL)
        expect(usePlayerStore.getState().health).toBe(usePlayerStore.getState().maxHealth)
      }),
    )
  })
})

describe('Retry from morning', () => {
  it('goes back to the start of the day with the same fair loadout', () => {
    useWorldStore.getState().applyWorldState({ phase: 'day', phaseTime: 0, nightNumber: 2 })
    useLanternStore.getState().setFuel(20)
    saveMorningSnapshot()
    useWorldStore.getState().applyWorldState({ phase: 'night', phaseTime: 80 })
    die(5)
    retryFromMorning()
    const w = useWorldStore.getState()
    expect([w.phase, w.phaseTime, w.nightNumber]).toEqual(['day', 0, 2])
    expect(useLanternStore.getState().fuel).toBe(RETRY_MIN_FUEL)
    expect(usePlayerStore.getState().health).toBe(usePlayerStore.getState().maxHealth)
  })

  it('is unavailable without a morning snapshot and then changes nothing', () => {
    clearMorningSnapshot()
    expect(hasMorningSnapshot()).toBe(false)
    useWorldStore.getState().applyWorldState({ phase: 'night', phaseTime: 80 })
    die(5)
    retryFromMorning()
    expect(useGameStore.getState().taken).toBe(true)
    expect(useWorldStore.getState().phase).toBe('night')
  })
})
