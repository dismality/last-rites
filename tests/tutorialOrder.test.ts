// Spec 09, B4: the tutorial's step 2 ("pick up the oil") is required. In the playtest, reading
// page 1 (itself an itemCollected pickup) marked step 2 done, so the prompt never appeared.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emit } from '../src/game/events'
import { useGuidanceStore } from '../src/game/state/guidanceStore'
import { installGuidanceWatchers, tickGuidance } from '../src/game/state/guidanceTick'
import { useMysteryStore } from '../src/game/state/mysteryStore'
import { usePlayerStore } from '../src/game/state/playerStore'
import { resetRun } from '../src/game/state/resetRun'
import { useSpawnStore } from '../src/game/state/spawnStore'
import { HUT_SHELF_ID } from '../src/game/systems/spawns'
import { currentTutorialStep } from '../src/game/systems/tutorial'

const current = () => currentTutorialStep(useGuidanceStore.getState().tutorialDone)

function walk3m(): void {
  usePlayerStore.setState({ position: [0, 0, 0] })
  tickGuidance(1 / 60)
  usePlayerStore.setState({ position: [0, 0, -3.2] })
  tickGuidance(1 / 60)
}

describe('tutorial step order', () => {
  let off: () => void
  beforeEach(() => {
    resetRun()
    off = installGuidanceWatchers()
  })
  afterEach(() => off())

  it('runs walk, oil, page in order, and only the oil finishes step 2', () => {
    expect(current()).toBe(1)
    walk3m()
    expect(current()).toBe(2)

    // Reading page 1 first, the playtest order: step 3 is done, but step 2 still shows.
    emit({ type: 'itemCollected', itemId: 'journal-page-1' })
    useMysteryStore.getState().collectPage(1)
    expect(useGuidanceStore.getState().tutorialDone.has(3)).toBe(true)
    expect(current()).toBe(2)

    // Other pickups do not count either.
    emit({ type: 'itemCollected', itemId: 'cloth' })
    emit({ type: 'itemCollected', itemId: 'bone' })
    expect(current()).toBe(2)

    emit({ type: 'itemCollected', itemId: 'lamp-oil' })
    expect(current()).toBe(4)
  })

  it('the day-1 hut shelf really holds lamp oil, so step 2 can always be finished', () => {
    resetRun()
    const shelf = useSpawnStore.getState().world.materials[HUT_SHELF_ID] ?? []
    expect(shelf.some((s) => s.item === 'lamp-oil')).toBe(true)
  })

  it('taking the shelf oil through the real pickup action finishes step 2', () => {
    walk3m()
    const shelf = useSpawnStore.getState().world.materials[HUT_SHELF_ID]
    useSpawnStore.getState().collectMaterial(HUT_SHELF_ID, shelf.findIndex((s) => s.item === 'lamp-oil'))
    expect(useGuidanceStore.getState().tutorialDone.has(2)).toBe(true)
  })
})
