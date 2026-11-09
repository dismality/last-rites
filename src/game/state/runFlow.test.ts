import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadGame = vi.fn<() => boolean>()
vi.mock('./gameSave', () => ({ loadGame: () => loadGame(), canContinue: () => true }))

import { useGameStore } from './gameStore'
import { useIntroStore } from './introStore'
import { continueGame, newGame } from './runFlow'

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

  it('Continue with no save stays on the title', () => {
    loadGame.mockReturnValue(false)
    expect(continueGame()).toBe(false)
    expect(useIntroStore.getState().playing).toBe(false)
    expect(useGameStore.getState().screen).toBe('title')
  })
})
