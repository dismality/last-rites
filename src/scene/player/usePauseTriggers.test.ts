import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../../game/state'
import { isMenuOpen, resumeGame, setDawnPickProbe } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { handlePauseKey, handlePointerLockLost } from './usePauseTriggers'

beforeEach(() => {
  useGameStore.getState().setPaused(false)
  useOverlayStore.setState({ merchantOpen: false, achievementsOpen: false, modeSelectOpen: false })
  setDawnPickProbe(() => false)
})

describe('pause triggers with 08 overlays', () => {
  it.each(['merchantOpen', 'achievementsOpen'] as const)('Esc pauses with %s', (flag) => {
    useOverlayStore.setState({ [flag]: true })
    handlePauseKey('Escape')
    expect(useGameStore.getState().paused).toBe(true)
  })

  it('Esc pauses with the dawn picker pending', () => {
    setDawnPickProbe(() => true)
    handlePauseKey('Escape')
    expect(useGameStore.getState().paused).toBe(true)
  })

  it('ignores pointer-lock loss while an overlay is open, pauses otherwise', () => {
    useOverlayStore.setState({ merchantOpen: true })
    handlePointerLockLost()
    expect(useGameStore.getState().paused).toBe(false)
    useOverlayStore.setState({ merchantOpen: false })
    handlePointerLockLost()
    expect(useGameStore.getState().paused).toBe(true)
  })

  it('isMenuOpen counts every new overlay', () => {
    expect(isMenuOpen()).toBe(false)
    for (const flag of ['merchantOpen', 'achievementsOpen', 'modeSelectOpen'] as const) {
      useOverlayStore.setState({ [flag]: true })
      expect(isMenuOpen()).toBe(true)
      useOverlayStore.setState({ [flag]: false })
    }
    setDawnPickProbe(() => true)
    expect(isMenuOpen()).toBe(true)
  })

  it('resume does not request pointer lock while an overlay is open', () => {
    const lock = vi.fn()
    useGameStore.getState().setPaused(true)
    useOverlayStore.setState({ achievementsOpen: true })
    resumeGame(lock)
    expect(useGameStore.getState().paused).toBe(false)
    expect(lock).not.toHaveBeenCalled()
    useOverlayStore.setState({ achievementsOpen: false })
    resumeGame(lock)
    expect(lock).toHaveBeenCalledTimes(1)
  })
})
