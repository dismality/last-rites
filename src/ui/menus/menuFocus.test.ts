import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { AUTOFOCUS_SELECTOR, pickInitialFocus, tabWrapTarget, type FocusLike } from './menuFocus'

// Fake panel: DOM order is the array order; focusing records itself like document.activeElement.
function makePanel(marked: number[], count: number) {
  let active: unknown = null
  const mk = (id: string): FocusLike & { id: string } => {
    const el: FocusLike & { id: string } = {
      id,
      focus() {
        active = el
      },
    }
    return el
  }
  const controls = Array.from({ length: count }, (_, i) => mk(`c${i}`))
  const panel = {
    id: 'panel',
    focus() {
      active = panel
    },
    querySelector(sel: string) {
      if (sel === AUTOFOCUS_SELECTOR) return marked.length ? controls[Math.min(...marked)] : null
      return controls[0] ?? null
    },
  }
  return { panel, controls, active: () => active }
}

describe('pickInitialFocus', () => {
  it('focuses the marked control at once (well inside 100 ms)', () => {
    const { panel, controls, active } = makePanel([2], 4)
    const start = performance.now()
    pickInitialFocus(panel, 'button').focus()
    expect(performance.now() - start).toBeLessThan(100)
    expect(active()).toBe(controls[2])
  })

  it('first marked control wins', () => {
    const { panel, controls, active } = makePanel([3, 1], 4)
    pickInitialFocus(panel, 'button').focus()
    expect(active()).toBe(controls[1])
  })

  it('falls back to the first control, then the panel', () => {
    const a = makePanel([], 3)
    pickInitialFocus(a.panel, 'button').focus()
    expect(a.active()).toBe(a.controls[0])
    const b = makePanel([], 0)
    pickInitialFocus(b.panel, 'button').focus()
    expect(b.active()).toBe(b.panel)
  })
})

describe('tabWrapTarget', () => {
  it('wraps last to first and first to last', () => {
    const items = ['a', 'b', 'c']
    expect(tabWrapTarget(items, 'c', null, false)).toBe('a')
    expect(tabWrapTarget(items, 'a', null, true)).toBe('c')
    expect(tabWrapTarget(items, 'x', 'x', true)).toBe('c')
    expect(tabWrapTarget(items, 'b', null, false)).toBeNull()
    expect(tabWrapTarget([], 'b', null, false)).toBeNull()
  })

  it('cycling Tab never leaves the item list', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 0, max: 30 }), (n, steps) => {
        const items = Array.from({ length: n }, (_, i) => i)
        let at = 0
        for (let s = 0; s < steps; s++) at = tabWrapTarget(items, at, null, false) ?? Math.min(at + 1, n - 1)
        expect(items).toContain(at)
      }),
    )
  })
})
