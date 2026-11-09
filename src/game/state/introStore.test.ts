import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { isMenuOpen, isSimFrozen } from './menuState'

describe('introStore', () => {
  beforeEach(() => {
    useIntroStore.setState({ playing: false, seen: false })
    useGameStore.setState({ paused: false, examining: false, journalOpen: false })
  })

  it('begin resets seen and plays; skip and finish are idempotent', () => {
    useIntroStore.setState({ seen: true })
    useIntroStore.getState().begin()
    expect(useIntroStore.getState()).toMatchObject({ playing: true, seen: false })
    useIntroStore.getState().skip()
    useIntroStore.getState().finish()
    useIntroStore.getState().skip()
    expect(useIntroStore.getState()).toMatchObject({ playing: false, seen: true })
  })

  it('freezes the simulation and counts as a menu only while playing', () => {
    expect(isSimFrozen()).toBe(false)
    expect(isMenuOpen()).toBe(false)
    useIntroStore.getState().begin()
    expect(isSimFrozen()).toBe(true)
    expect(isMenuOpen()).toBe(true)
    useIntroStore.getState().finish()
    expect(isSimFrozen()).toBe(false)
  })

  it('setSeen restores the flag without playing', () => {
    useIntroStore.getState().setSeen(true)
    expect(useIntroStore.getState()).toMatchObject({ playing: false, seen: true })
  })
})
