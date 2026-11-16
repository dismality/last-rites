import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { MinigameId } from '../../data/cases'
import { useOverlayStore } from '../state/overlayStore'
import { isMenuOpen, isOverlayOpen } from '../state/menuState'
import { resultView, scareUiBlocking, shellKeyAction, shellView, visibleCaptions } from './minigameShell'

const IDS: MinigameId[] = ['1a', '1b', '2a', '2b', '2c', '3a', '3b']

describe('scare gate', () => {
  it('blocks while a minigame is open, whatever else is true', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.constantFrom(...IDS), (menu, id) => {
        expect(scareUiBlocking(menu, id)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
  it('follows the menu flag when no minigame is open', () => {
    expect(scareUiBlocking(false, null)).toBe(false)
    expect(scareUiBlocking(true, null)).toBe(true)
  })
  it('an open minigame counts in isMenuOpen and isOverlayOpen, and closing frees them', () => {
    useOverlayStore.getState().setMinigameOpen('1a')
    expect(isOverlayOpen()).toBe(true)
    expect(isMenuOpen()).toBe(true)
    useOverlayStore.getState().setMinigameOpen(null)
    expect(isOverlayOpen()).toBe(false)
  })
})

describe('shellKeyAction', () => {
  it('Esc closes', () => {
    expect(shellKeyAction('Escape', false, 0, 3)).toEqual({ kind: 'close' })
  })
  it('Tab wraps forward and Shift+Tab wraps back', () => {
    expect(shellKeyAction('Tab', false, 2, 3)).toEqual({ kind: 'focus', index: 0 })
    expect(shellKeyAction('Tab', true, 0, 3)).toEqual({ kind: 'focus', index: 2 })
  })
  it('Tab inside the range is left to the browser, outside it enters the overlay', () => {
    expect(shellKeyAction('Tab', false, 1, 3)).toBeNull()
    expect(shellKeyAction('Tab', false, -1, 3)).toEqual({ kind: 'focus', index: 0 })
    expect(shellKeyAction('Tab', true, -1, 3)).toEqual({ kind: 'focus', index: 2 })
  })
  it('ignores other keys and empty overlays', () => {
    expect(shellKeyAction('KeyA', false, 0, 3)).toBeNull()
    expect(shellKeyAction('Tab', false, -1, 0)).toBeNull()
  })
})

describe('view model', () => {
  it('has no timer and keeps progress on close', () => {
    const v = shellView('  Ledger  ', [])
    expect(v.title).toBe('Ledger')
    expect(v.showsTimer).toBe(false)
    expect(v.closeKeepsProgress).toBe(true)
  })
  it('captions are trimmed, unique and capped, newest last', () => {
    expect(visibleCaptions(['[a]', ' [a] ', '', '[b]', '[c]', '[d]'])).toEqual(['[b]', '[c]', '[d]'])
  })
  it('every result kind has a glyph and a label, not colour alone', () => {
    for (const k of ['right', 'wrong', 'partial', 'info'] as const) {
      const r = resultView(k, 'text')
      expect(r.glyph.length).toBeGreaterThan(0)
      expect(r.label.length).toBeGreaterThan(0)
    }
    expect(resultView('right', 'x').glyph).not.toBe(resultView('wrong', 'x').glyph)
  })
})
