import { beforeEach, describe, expect, it } from 'vitest'
import { resetSimClock, simClock, stepSimClock } from './simClock'
import { useOverlayStore } from './overlayStore'
import { CONTRACT_TOAST_MS, TOAST_DURATION_MS, useToastStore } from './toastStore'

describe('simClock', () => {
  beforeEach(resetSimClock)
  it('advances only when stepped', () => {
    expect(simClock.now).toBe(0)
    stepSimClock(1 / 60)
    stepSimClock(1 / 60)
    expect(simClock.now).toBeCloseTo(2 / 60)
    resetSimClock()
    expect(simClock.now).toBe(0)
  })
})

describe('overlayStore', () => {
  it('toggles each flag independently', () => {
    const s = useOverlayStore.getState()
    s.setMerchantOpen(true)
    expect(useOverlayStore.getState()).toMatchObject({
      merchantOpen: true,
      achievementsOpen: false,
      modeSelectOpen: false,
    })
    s.setAchievementsOpen(true)
    s.setModeSelectOpen(true)
    s.setMerchantOpen(false)
    expect(useOverlayStore.getState()).toMatchObject({
      merchantOpen: false,
      achievementsOpen: true,
      modeSelectOpen: true,
    })
    s.setAchievementsOpen(false)
    s.setModeSelectOpen(false)
  })
})

describe('toastStore duration', () => {
  beforeEach(() => useToastStore.setState({ queue: [] }))
  it('defaults to 2000 ms and honours an explicit duration', () => {
    useToastStore.getState().push('plain')
    useToastStore.getState().push('Contract done: X, +15 coins', CONTRACT_TOAST_MS)
    const [a, b] = useToastStore.getState().queue
    expect(a.durationMs).toBe(2000)
    expect(TOAST_DURATION_MS).toBe(2000)
    expect(b.durationMs).toBe(3000)
  })
})
