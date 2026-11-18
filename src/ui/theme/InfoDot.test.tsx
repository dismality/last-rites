// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InfoDot } from './InfoDot'
import { INFO_TIPS } from '../../data/infoTips'
import { useSettingsStore } from '../../game/state/settingsStore'
import { handlePauseKey } from '../../scene/player/usePauseTriggers'
import { useGameStore } from '../../game/state'

/** Mirrors usePauseTriggers: a bubble-phase window listener. */
const onPause = (e: KeyboardEvent) => handlePauseKey(e.code)

beforeEach(() => {
  useSettingsStore.setState({ showInfoDots: true })
  useGameStore.getState().setPaused(false)
  window.addEventListener('keydown', onPause)
})

afterEach(() => {
  window.removeEventListener('keydown', onPause)
  cleanup()
})

const dot = () => screen.getByRole('button', { name: 'More information' })

describe('InfoDot', () => {
  it('opens on hover and closes on leave', () => {
    render(<InfoDot tipKey="hud-hints" />)
    fireEvent.mouseEnter(dot())
    expect(screen.getByRole('tooltip').textContent).toBe(INFO_TIPS['hud-hints'])
    fireEvent.mouseLeave(dot())
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('opens on focus and closes on blur', () => {
    render(<InfoDot tipKey="hud-map" />)
    fireEvent.focus(dot())
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.blur(dot())
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('opens on tap and closes on an outside tap', () => {
    render(
      <div>
        <InfoDot tipKey="hud-coins" />
        <p>elsewhere</p>
      </div>,
    )
    fireEvent.click(dot())
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.pointerDown(screen.getByText('elsewhere'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('points aria-describedby at the tooltip while open', () => {
    render(<InfoDot tipKey="hud-oil" />)
    expect(dot().getAttribute('aria-describedby')).toBeNull()
    fireEvent.focus(dot())
    expect(dot().getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id)
  })

  it('Esc closes an open tooltip without pausing; the next Esc pauses', () => {
    render(<InfoDot tipKey="hud-stamina" />)
    fireEvent.focus(dot())
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(useGameStore.getState().paused).toBe(false)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(useGameStore.getState().paused).toBe(true)
  })

  it('Esc with no tooltip reaches pause', () => {
    render(<InfoDot tipKey="hud-stamina" />)
    const spy = vi.fn()
    window.addEventListener('keydown', spy)
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    window.removeEventListener('keydown', spy)
    expect(spy).toHaveBeenCalled()
    expect(useGameStore.getState().paused).toBe(true)
  })

  it('renders nothing while info dots are off', () => {
    useSettingsStore.setState({ showInfoDots: false })
    const { container } = render(<InfoDot tipKey="hud-clues" />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
