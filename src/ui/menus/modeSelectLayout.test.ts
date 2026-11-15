import css from './menus.css?raw'
import tsx from './ModeSelect.tsx?raw'
import { describe, expect, it } from 'vitest'

// B13: Begin and Back must stay visible when the mode list is taller than the screen.
// jsdom has no layout, so this guards the CSS that pins them; the browser check is e2e/mode-select.spec.ts.

describe('mode select layout', () => {
  it('pins the action row and lets the panel scroll', () => {
    const rule = /\.menu__actions--sticky\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/position:\s*sticky/)
    expect(rule).toMatch(/bottom:/)
    expect(/\.menu\s*\{[^}]*overflow-y:\s*auto/.test(css)).toBe(true)
  })
  it('uses the sticky row for Begin and Back', () => {
    expect(tsx).toContain('menu__actions--sticky')
  })
})

