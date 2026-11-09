import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultProgressionSave, sanitizeProgression } from '../systems/progressionSave'
import { isDawnPickPending } from './menuState'
import { PROGRESSION_PERSISTED, captureProgressionSave, restoreProgressionSave } from './progressionPersistence'
import { initialProgression, useProgressionStore } from './progressionStore'

const ctx = { inventory: { slots: [] } as never, takenPickups: [] }

beforeEach(() => useProgressionStore.getState().reset())

describe('progressionStore', () => {
  it('starts at the defaults', () => {
    const { patch, addCoins, setCoins, setContractList, reset, ...data } = useProgressionStore.getState()
    void [patch, addCoins, setCoins, setContractList, reset]
    expect(data).toEqual(initialProgression())
    expect(captureProgressionSave()).toEqual(defaultProgressionSave())
  })

  it('capture then sanitise returns the same state', () => {
    useProgressionStore.getState().patch({
      mode: 'hard',
      seed: 77,
      ranks: { 'long-wick': 1 },
      pendingPick: ['steady-hands'],
      score: 120,
      coins: 9,
      storm: { active: true },
    })
    const saved = captureProgressionSave()
    expect(sanitizeProgression(structuredClone(saved), ctx)).toEqual(saved)
  })

  it('restore puts a save back', () => {
    useProgressionStore.getState().patch({ score: 50, coins: 4 })
    const saved = captureProgressionSave()
    useProgressionStore.getState().reset()
    restoreProgressionSave(saved)
    expect(captureProgressionSave()).toEqual(saved)
  })

  it('coins never go below 0', () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.integer({ min: -5000, max: 5000 }), (start, delta) => {
        useProgressionStore.getState().setCoins(start)
        useProgressionStore.getState().addCoins(delta)
        expect(useProgressionStore.getState().coins).toBeGreaterThanOrEqual(0)
      }),
    )
    useProgressionStore.getState().setCoins(-3)
    expect(useProgressionStore.getState().coins).toBe(0)
  })

  it('the persisted list names every saved field', () => {
    expect([...PROGRESSION_PERSISTED].sort()).toEqual(Object.keys(defaultProgressionSave()).sort())
    expect(Object.keys(captureProgressionSave()).sort()).toEqual([...PROGRESSION_PERSISTED].sort())
  })

  it('a pending pick is reported to menuState', () => {
    expect(isDawnPickPending()).toBe(false)
    useProgressionStore.getState().patch({ pendingPick: ['long-wick'] })
    expect(isDawnPickPending()).toBe(true)
  })
})
