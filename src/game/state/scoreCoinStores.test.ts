import { describe, expect, it } from 'vitest'
import { useCoinStore } from './coinStore'
import { useScoreStore } from './scoreStore'

const fresh = () => {
  const s = useScoreStore.getState()
  return JSON.parse(JSON.stringify({ ...s, patch: 0, resetNight: 0 })) as unknown
}

describe('scoreStore', () => {
  it('resetNight clears the combo and counters', () => {
    useScoreStore.getState().patch({
      combo: 2.5,
      lastKillAt: 10,
      seen: ['a'],
      nightKillPoints: 90,
      nightDamage: 5,
      nightHeadshotKills: 2,
      nightKills: 4,
      nightItems: 3,
      clearHp: 12,
    })
    useScoreStore.getState().resetNight()
    const s = useScoreStore.getState()
    expect(s.combo).toBe(1)
    expect(s.lastKillAt).toBeNull()
    expect(s.seen).toEqual([])
    expect(s.nightKillPoints + s.nightDamage + s.nightHeadshotKills + s.nightKills + s.nightItems).toBe(0)
    expect(s.clearHp).toBeNull()
  })

  it('a reset store equals a fresh one', () => {
    const before = fresh()
    useScoreStore.getState().patch({ combo: 3, seen: ['x'] })
    useScoreStore.getState().resetNight()
    expect(fresh()).toEqual(before)
  })
})

describe('coinStore', () => {
  it('clear empties piles and restores the id counter', () => {
    useCoinStore.getState().setPiles([{ id: 4, x: 1, z: 2, amount: 3, age: 0 }], 5)
    useCoinStore.getState().clear()
    expect(useCoinStore.getState().piles).toEqual([])
    expect(useCoinStore.getState().nextId).toBe(1)
  })
})
