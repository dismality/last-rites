// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installTypingGuard } from './typingGuard'

describe('typing guard', () => {
  let off: (() => void) | null = null
  afterEach(() => {
    off?.()
    document.body.innerHTML = ''
  })

  it('keeps letters typed into a text field away from the game keys, but lets Esc and Tab through', () => {
    off = installTypingGuard(window)
    const game = vi.fn()
    window.addEventListener('keydown', game, true)
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }))
    expect(game).not.toHaveBeenCalled()
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }))
    expect(game).toHaveBeenCalledTimes(2)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }))
    expect(game).toHaveBeenCalledTimes(3)
    window.removeEventListener('keydown', game, true)
  })
})
