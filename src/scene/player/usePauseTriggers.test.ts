import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore, useWorldStore } from '../../game/state'
import { isMenuOpen, isSimFrozen, resumeGame, setDawnPickProbe } from '../../game/state/menuState'
import { useOverlayStore } from '../../game/state/overlayStore'
import { handlePauseKey, handlePointerLockLost } from './usePauseTriggers'

beforeEach(() => {
  useGameStore.getState().setPaused(false)
  useOverlayStore.setState({
    merchantOpen: false,
    achievementsOpen: false,
    modeSelectOpen: false,
    altarPanelOpen: false,
  })
  useGameStore.setState({ journalOpen: false, mapOpen: false })
  useWorldStore.getState().setPhase('day')
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

  describe('journal and big map follow the F8 rule', () => {
    const readers = ['journalOpen', 'mapOpen'] as const
    beforeEach(() => {
      useGameStore.setState({ journalOpen: false, mapOpen: false })
      useWorldStore.getState().setPhase('day')
      useOverlayStore.setState({ altarPanelOpen: false })
    })

    it.each(readers)('by day %s freezes the sim, holds the cursor and owns Esc', (flag) => {
      useGameStore.setState({ [flag]: true })
      expect(isSimFrozen()).toBe(true)
      expect(isMenuOpen()).toBe(true)
      handlePauseKey('Escape')
      expect(useGameStore.getState().paused).toBe(false)
    })

    it.each(readers)('at night %s leaves the sim running but still holds the cursor', (flag) => {
      useWorldStore.getState().setPhase('night')
      useGameStore.setState({ [flag]: true })
      expect(isSimFrozen()).toBe(false)
      expect(isMenuOpen()).toBe(true)
    })

    it.each(readers)('at night Esc pauses over %s (Req 10.6)', (flag) => {
      useWorldStore.getState().setPhase('night')
      useGameStore.setState({ [flag]: true })
      handlePauseKey('Escape')
      expect(useGameStore.getState().paused).toBe(true)
      expect(isSimFrozen()).toBe(true)
    })

    it('the altar panel holds the cursor, never freezes the night and owns Esc', () => {
      useWorldStore.getState().setPhase('night')
      useOverlayStore.setState({ altarPanelOpen: true })
      expect(isSimFrozen()).toBe(false)
      expect(isMenuOpen()).toBe(true)
      handlePauseKey('Escape')
      expect(useGameStore.getState().paused).toBe(false)
      handlePointerLockLost()
      expect(useGameStore.getState().paused).toBe(false)
    })
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
