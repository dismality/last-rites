// Requirement 2.1 and 2.12: dev mode needs the flag, and the panel cannot open without it.
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { subscribeToType } from '../game/events'
import { batPerchPoint, installBatShotListener, resetBatRuntime, stepBats } from '../game/state/batStep'
import { useBatStore } from '../game/state/batStore'
import { usePlayerStore } from '../game/state/playerStore'
import { resetRun } from '../game/state/resetRun'
import { useWorldStore } from '../game/state/worldStore'
import { getDevCheats, setDevCheatFlags } from '../game/state/devCheats'
import { isMenuOpen, isOverlayOpen } from '../game/state/menuState'
import { resetCheats, setCheats } from './devCheats'
import { isDevEnabled } from './devFlag'
import { DEV_TOGGLE_CODE, installDevKeys } from './devKeys'
import { useDevPanelStore } from './devPanelStore'
import { installDev } from './installDev'
import {
  fireShot,
  forceScreenScare,
  giveCoins,
  resetVendingStockDev,
  spawnBrideDev,
  spawnCrawlerAmbush,
  spawnHoundPack,
  teleportNextToBat,
} from './devActions'
import { HOUND_PACKS_MAX } from '../data/creatures'
import { stepCreatures } from '../game/state/creatureStep'
import { useCreatureStore } from '../game/state/creatureStore'
import { triggerScreenScare } from '../game/state/screenScareActions'
import { useScreenScareStore } from '../game/state/screenScareStore'
import { initialScreenScareState } from '../game/systems/screenScares'
import { useProgressionStore } from '../game/state/progressionStore'
import { useVendingStore } from '../game/state/vendingStore'
import { freshStock } from '../game/systems/vending'

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
    expect(getDevCheats()).toEqual({ god: false, noclip: false, timeScale: 1, panelOpen: false, forceScreenScare: false })
    setCheats({ god: true, noclip: true, timeScale: 20 })
    expect(getDevCheats()).toEqual({ god: true, noclip: true, timeScale: 20, panelOpen: false, forceScreenScare: false })
    resetCheats()
    expect(getDevCheats()).toEqual({ god: false, noclip: false, timeScale: 1, panelOpen: false, forceScreenScare: false })
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
    setDevCheatFlags({ panelOpen: false, forceScreenScare: false })
    expect(isMenuOpen()).toBe(false)
  })
})

// Spec 11 task 2.6: the vending machine's dev buttons go through the real stores.
describe('vending dev actions', () => {
  it('"Give 100 grave coins" adds 100 coins', () => {
    useProgressionStore.getState().setCoins(7)
    expect(giveCoins()).toContain('100')
    expect(useProgressionStore.getState().coins).toBe(107)
  })

  it('"Reset vending stock" refills every row', () => {
    useVendingStore.getState().setStock({ stockLeft: { ...freshStock().stockLeft, bandage: 0, 'kola-tonic': 0 } })
    resetVendingStockDev()
    expect(useVendingStore.getState().stock).toEqual(freshStock())
  })
})

// Spec 11 task 4.6: the bat buttons use the real player store and the real firearmFired event.
describe('bat dev actions', () => {
  beforeEach(() => {
    resetRun()
    useWorldStore.setState({ phase: 'night', nightNumber: 1 })
    usePlayerStore.setState({ position: [1000, 0, 1000] })
    resetBatRuntime()
  })

  it('"Teleport next to a bat" says so when no bat is perched (by day)', () => {
    useWorldStore.setState({ phase: 'day' })
    stepBats(1 / 60)
    expect(teleportNextToBat()).toContain('No perched bat')
  })

  it('"Teleport next to a bat" stands the player 6 m from a perched bat', () => {
    stepBats(1 / 60)
    teleportNextToBat()
    const [px, , pz] = usePlayerStore.getState().position
    const dists = useBatStore
      .getState()
      .entries.map((e) => batPerchPoint(e.bat.boxIndex))
      .map((at) => Math.hypot(px - at[0], pz - at[2]))
    expect(Math.min(...dists)).toBeCloseTo(6, 5)
    expect(useBatStore.getState().entries.every((e) => e.bat.phase === 'perched')).toBe(true)
  })

  it('"Fire a shot" is a firearmFired event, and the bat step sends the nearby bat off', () => {
    const off = installBatShotListener()
    let fired = 0
    const offCount = subscribeToType('firearmFired', () => fired++)
    stepBats(1 / 60)
    teleportNextToBat()
    stepBats(1 / 60)
    expect(useBatStore.getState().entries.some((e) => e.bat.phase === 'fleeing')).toBe(false)
    expect(fireShot()).toContain('shot')
    stepBats(1 / 60)
    expect(fired).toBe(1)
    expect(useBatStore.getState().entries.some((e) => e.bat.phase === 'fleeing')).toBe(true)
    off()
    offCount()
  })
})

// Spec 11 task 7.6: the creature buttons add to the real creature store and the real step runs them.
describe('creature dev actions', () => {
  beforeEach(() => {
    resetRun()
    useCreatureStore.getState().clearNight()
    useWorldStore.setState({ phase: 'night', nightNumber: 2 })
    usePlayerStore.setState({ position: [1000, 0, 1000], yaw: 0 })
  })

  it('"Spawn crawler ambush" hides a crawler 3 m ahead that bursts when the player is near', () => {
    expect(spawnCrawlerAmbush()).toContain('Crawler')
    const [c] = useCreatureStore.getState().crawlers
    expect(c.c.phase).toBe('hidden')
    expect(Math.hypot(c.c.x - 1000, c.c.z - 1000)).toBeCloseTo(3, 5)
    usePlayerStore.setState({ position: [c.c.x, 0, c.c.z] })
    for (let i = 0; i < 120; i++) stepCreatures(1 / 60, () => 0.5)
    expect(useCreatureStore.getState().crawlers.some((e) => e.c.phase !== 'hidden')).toBe(true)
  })

  it('"Spawn bride" brings her in at stage 2 and refuses at stage 1 or when she is here', () => {
    useWorldStore.setState({ nightNumber: 1 })
    expect(spawnBrideDev()).toContain('stage 2')
    expect(useCreatureStore.getState().bride.alive).toBe(false)
    useWorldStore.setState({ nightNumber: 2 })
    expect(spawnBrideDev()).toContain('Bride')
    expect(useCreatureStore.getState().bride.alive).toBe(true)
    expect(spawnBrideDev()).toContain('already')
  })

  it('"Spawn hound pack" adds a pack of 3 and stops at the pack limit', () => {
    for (let i = 0; i < HOUND_PACKS_MAX; i++) spawnHoundPack()
    const { packs } = useCreatureStore.getState()
    expect(packs).toHaveLength(HOUND_PACKS_MAX)
    expect(packs.every((p) => p.pack.hounds.length === 3)).toBe(true)
    expect(spawnHoundPack()).toContain('Too many')
    expect(useCreatureStore.getState().packs).toHaveLength(HOUND_PACKS_MAX)
  })
})

// Spec 11 task 3.6: Force screen scare bypasses the cooldown and the open panel only through the dev flag.
describe('force screen scare', () => {
  afterEach(() => {
    resetCheats()
    setDevCheatFlags({ panelOpen: false })
    useScreenScareStore.getState().setScare(initialScreenScareState())
  })

  it('starts a zombie or ghost face inside the cooldown and with the panel open', () => {
    setDevCheatFlags({ panelOpen: true })
    expect(forceScreenScare('zombie')).toContain('zombie')
    expect(useScreenScareStore.getState().scare.active?.set).toBe('zombie-bottom')
    expect(forceScreenScare('ghost')).toContain('ghost')
    expect(useScreenScareStore.getState().scare.active?.set).toBe('ghost-top')
  })

  it('leaves the flag off afterwards, so a normal request still obeys the cooldown', () => {
    forceScreenScare('zombie')
    expect(getDevCheats().forceScreenScare).toBe(false)
    expect(triggerScreenScare('crawler')).toBe('cooldown')
  })
})
