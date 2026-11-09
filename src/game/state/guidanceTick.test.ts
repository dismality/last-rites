import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emit } from '../events'
import { useGuidanceStore } from './guidanceStore'
import { installGuidanceWatchers, tickGuidance } from './guidanceTick'
import { useMysteryStore } from './mysteryStore'
import { usePlayerStore } from './playerStore'
import { resetRun } from './resetRun'

const at = (x: number, z: number) => usePlayerStore.setState({ position: [x, 0, z] })

describe('guidanceTick', () => {
  let off: () => void
  beforeEach(() => {
    resetRun()
    off = installGuidanceWatchers()
  })
  afterEach(() => off())

  it('first tick shows the starting zone card; zone B replaces zone A', () => {
    at(0, 0)
    tickGuidance(1 / 60)
    expect(useGuidanceStore.getState().card?.zone).toBe('grounds')
    at(10, 5) // chapel centre
    tickGuidance(1 / 60)
    expect(useGuidanceStore.getState().card).toMatchObject({ zone: 'chapel', elapsed: 0 })
  })

  it('cooldown survives re-entry and expires after 30 s', () => {
    at(0, 0)
    tickGuidance(1)
    at(10, 5)
    tickGuidance(1)
    at(0, 0)
    tickGuidance(5) // grounds shown 2 s ago: cooldown holds, no new card
    expect(useGuidanceStore.getState().card).toBeNull()
    at(10, 5)
    tickGuidance(1)
    at(0, 0)
    tickGuidance(30)
    expect(useGuidanceStore.getState().card).toMatchObject({ zone: 'grounds', elapsed: 0 })
  })

  it('skips a tick on a non-finite position', () => {
    at(Number.NaN, 0)
    tickGuidance(1)
    expect(useGuidanceStore.getState().zoneClock).toBe(0)
  })

  it('events complete the matching tutorial step', () => {
    emit({ type: 'craftCompleted', recipeId: 'r-bandage' })
    emit({ type: 'journalOpened' })
    emit({ type: 'hotbarBound', slot: 0 })
    useMysteryStore.getState().collectPage(1)
    expect([...useGuidanceStore.getState().tutorialDone].sort()).toEqual([3, 5, 6, 7])
  })

  it('walking 3 m completes step 1', () => {
    at(0, 0)
    tickGuidance(1 / 60)
    at(4, 0)
    tickGuidance(1 / 60)
    expect(useGuidanceStore.getState().tutorialDone.has(1)).toBe(true)
  })

  it('resetRun clears guidance state', () => {
    emit({ type: 'journalOpened' })
    at(0, 0)
    tickGuidance(1)
    resetRun()
    const s = useGuidanceStore.getState()
    expect(s.tutorialDone.size).toBe(0)
    expect(s).toMatchObject({ card: null, zone: null, zoneClock: 0, objective: null })
  })
})
