import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadGame = vi.fn<() => boolean>()
vi.mock('./gameSave', () => ({ loadGame: () => loadGame(), canContinue: () => true }))

import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { useOverlayStore } from './overlayStore'
import {
  beginMode,
  closeAchievements,
  continueGame,
  newGame,
  openAchievements,
  openModeSelect,
} from './runFlow'

describe('runFlow', () => {
  beforeEach(() => {
    loadGame.mockReset()
    useIntroStore.setState({ playing: false, seen: false })
    useGameStore.setState({ screen: 'title' })
  })

  it('New Game begins the intro even when it was already seen', () => {
    useIntroStore.setState({ seen: true })
    newGame()
    expect(useIntroStore.getState()).toMatchObject({ playing: true, seen: false })
    expect(useGameStore.getState().screen).toBe('game')
  })

  it('Continue never begins the intro', () => {
    loadGame.mockReturnValue(true)
    useIntroStore.setState({ seen: true })
    expect(continueGame()).toBe(true)
    expect(useIntroStore.getState()).toMatchObject({ playing: false, seen: true })
    expect(useGameStore.getState().screen).toBe('game')
  })

  it('New Game opens the mode select without starting a run', () => {
    openModeSelect()
    expect(useOverlayStore.getState().modeSelectOpen).toBe(true)
    expect(useGameStore.getState().screen).toBe('title')
    expect(useIntroStore.getState().playing).toBe(false)
  })

  it('choosing a story mode plays the intro, Endless skips it', () => {
    openModeSelect()
    beginMode('normal')
    expect(useIntroStore.getState().playing).toBe(true)
    expect(useOverlayStore.getState().modeSelectOpen).toBe(false)
    expect(useGameStore.getState().screen).toBe('game')

    useIntroStore.setState({ playing: false, seen: false })
    useGameStore.setState({ screen: 'title' })
    beginMode('endless')
    expect(useIntroStore.getState().playing).toBe(false)
    expect(useGameStore.getState().screen).toBe('game')
  })

  it('Achievements opens and closes from the overlay flag', () => {
    openAchievements()
    expect(useOverlayStore.getState().achievementsOpen).toBe(true)
    closeAchievements()
    expect(useOverlayStore.getState().achievementsOpen).toBe(false)
  })

  it('Continue with no save stays on the title', () => {
    loadGame.mockReturnValue(false)
    expect(continueGame()).toBe(false)
    expect(useIntroStore.getState().playing).toBe(false)
    expect(useGameStore.getState().screen).toBe('title')
  })
})
