// Requirement 2.1 and 2.12: dev mode needs the flag, and the panel cannot open without it.
import fc from 'fast-check'
import { afterEach, describe, expect, it } from 'vitest'
import { getDevCheats, setDevCheatFlags } from '../game/state/devCheats'
import { isMenuOpen, isOverlayOpen } from '../game/state/menuState'
import { resetCheats, setCheats } from './devCheats'
import { isDevEnabled } from './devFlag'
import { DEV_TOGGLE_CODE, installDevKeys } from './devKeys'
import { useDevPanelStore } from './devPanelStore'
import { installDev } from './installDev'

function press(target: EventTarget, code: string): void {
  target.dispatchEvent(Object.assign(new Event('keydown'), { code }))
}

afterEach(() => {
  useDevPanelStore.setState({ enabled: false, open: false })
  resetCheats()
})

describe('isDevEnabled', () => {
  it('is on for ?dev=1 or a DEV build, off otherwise', () => {
    expect(isDevEnabled('?dev=1', false)).toBe(true)
    expect(isDevEnabled('?a=b&dev=1', false)).toBe(true)
    expect(isDevEnabled('', true)).toBe(true)
    expect(isDevEnabled('', false)).toBe(false)
    expect(isDevEnabled('?dev=0', false)).toBe(false)
    expect(isDevEnabled('?dev', false)).toBe(false)
  })

  it('is off for every query that does not carry dev=1 (production)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.string({ maxLength: 6 })),
        (params) => {
          fc.pre(params.dev !== '1')
          const search = '?' + new URLSearchParams(params).toString()
          expect(isDevEnabled(search, false)).toBe(false)
        },
      ),
    )
  })
})

describe('Dev_Panel without the flag', () => {
  it('cannot be opened by toggle()', () => {
    useDevPanelStore.getState().toggle()
    expect(useDevPanelStore.getState().open).toBe(false)
  })

  it('ignores the backquote key', () => {
    const target = new EventTarget()
    const off = installDevKeys(target)
    press(target, DEV_TOGGLE_CODE)
    expect(useDevPanelStore.getState().open).toBe(false)
    off()
  })

  it('installDev installs nothing and leaves the panel disabled', () => {
    expect(installDev({ search: '', envDev: false })).toBe(false)
    expect(installDev({ search: '?dev=0', envDev: false })).toBe(false)
    expect(useDevPanelStore.getState().enabled).toBe(false)
    useDevPanelStore.getState().toggle()
    expect(useDevPanelStore.getState().open).toBe(false)
  })
})

describe('Dev_Panel with the flag', () => {
  it('toggles on backquote and ignores other keys', () => {
    useDevPanelStore.getState().enable()
    const target = new EventTarget()
    const off = installDevKeys(target)
    press(target, 'KeyE')
    expect(useDevPanelStore.getState().open).toBe(false)
    press(target, DEV_TOGGLE_CODE)
    expect(useDevPanelStore.getState().open).toBe(true)
    press(target, DEV_TOGGLE_CODE)
    expect(useDevPanelStore.getState().open).toBe(false)
    off()
  })
})

describe('cheat flags', () => {
  it('default to off and follow the panel', () => {
    expect(getDevCheats()).toEqual({ god: false, noclip: false, timeScale: 1, panelOpen: false })
    setCheats({ god: true, noclip: true, timeScale: 20 })
    expect(getDevCheats()).toEqual({ god: true, noclip: true, timeScale: 20, panelOpen: false })
    resetCheats()
    expect(getDevCheats()).toEqual({ god: false, noclip: false, timeScale: 1, panelOpen: false })
  })

  it('an open panel counts as an overlay, so input stops and lock loss does not pause', () => {
    expect(isOverlayOpen()).toBe(false)
    expect(isMenuOpen()).toBe(false)
    setDevCheatFlags({ panelOpen: true })
    expect(isOverlayOpen()).toBe(true)
    expect(isMenuOpen()).toBe(true)
    // Cheats set from the panel must not clear the open flag.
    setCheats({ god: true })
    expect(getDevCheats().panelOpen).toBe(true)
    setDevCheatFlags({ panelOpen: false })
    expect(isMenuOpen()).toBe(false)
  })
})
