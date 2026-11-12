import { describe, expect, it } from 'vitest'
import { cursorAction, GESTURE_WINDOW_MS } from './cursorRelease'
import menuState from '../../game/state/menuState.ts?raw'
import cursorRelease from './cursorRelease.ts?raw'
import gameLoop from '../GameLoop.tsx?raw'
import workbench from '../world/Workbench.tsx?raw'
import journal from '../../ui/journal/Journal.tsx?raw'
import satchel from '../../ui/satchel/Satchel.tsx?raw'
import examine from '../../ui/examine/ExamineOverlay.tsx?raw'
import tombstone from '../../ui/tombstone/TombstoneOverlay.tsx?raw'
import taken from '../../ui/menus/TakenScreen.tsx?raw'
import pauseMenu from '../../ui/menus/PauseMenu.tsx?raw'
import settings from '../../ui/menus/Settings.tsx?raw'
import dawnPicker from '../../ui/hud/DawnPicker.tsx?raw'
import dawnCard from '../../ui/hud/DawnCard.tsx?raw'
import merchant from '../../ui/merchant/MerchantMenu.tsx?raw'

const base = { wanted: false, wasWanted: false, inGame: true, sinceGestureMs: 5 }

describe('cursorAction', () => {
  it('releases when a screen opens', () => {
    expect(cursorAction({ ...base, wanted: true })).toBe('release')
  })

  it('relocks at once when the close is part of a click or key press', () => {
    expect(cursorAction({ ...base, wasWanted: true })).toBe('relock-now')
  })

  it('waits for the next gesture when the close came without one', () => {
    expect(cursorAction({ ...base, wasWanted: true, sinceGestureMs: GESTURE_WINDOW_MS + 1 })).toBe('relock-on-gesture')
  })

  it('does nothing when nothing changed or the game screen is not showing', () => {
    expect(cursorAction(base)).toBe('none')
    expect(cursorAction({ ...base, wanted: true, wasWanted: true })).toBe('none')
    expect(cursorAction({ ...base, wasWanted: true, inGame: false })).toBe('none')
  })
})

describe('one shared pointer-lock release', () => {
  const screens: Record<string, string> = {
    workbench,
    journal,
    satchel,
    examine,
    tombstone,
    taken,
    pauseMenu,
    settings,
    dawnPicker,
    dawnCard,
    merchant,
  }

  it('no screen releases the pointer itself', () => {
    const own = Object.entries(screens)
      .filter(([, src]) => src.includes('exitPointerLock'))
      .map(([name]) => name)
    expect(own).toEqual([])
  })

  it('the shared hook is mounted by the game tick driver and is the one exitPointerLock', () => {
    expect(gameLoop).toContain('useCursorRelease()')
    expect(cursorRelease).toContain('document.exitPointerLock()')
    expect(cursorRelease).toContain('requestLock(')
  })

  it('the open flags of those screens all feed isMenuOpen', () => {
    for (const flag of [
      'g.paused',
      'g.examining',
      'g.journalOpen',
      'g.taken',
      'g.satchelOpen',
      'ui.workbenchOpen',
      'ui.chapelRepairOpen',
      'isOverlayOpen()',
      'isDawnPickPending()',
      'o.merchantOpen',
    ]) {
      expect(menuState).toContain(flag)
    }
  })
})
