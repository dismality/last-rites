// The demo video's shots (docs/submission-kit.md), played by script and screen-recorded.
// Each test makes one or more clips in tools/video/clips. The debug hook only sets the scene up
// (start, clock, positions, items); what happens on camera is real keys and mouse.
import { test as base, chromium, expect, type Locator, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { body, frames, lookAt, moveMouse, pressE, useProp, walkTo } from '../../e2e/support/walker'
import { openMinigame } from '../../e2e/support/story'
import { fakeCursor, focusWindow, record, showCursor } from './capture'

/**
 * Chrome in kiosk mode: full screen with no tabs, and no "press Esc" bubbles when the pointer is
 * locked or freed (a normal full-screen window shows one each time). A fresh profile per shot.
 */
const test = base.extend<{ page: Page }>({
  page: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'last-rites-video-')), {
      channel: 'chrome',
      headless: false,
      viewport: null,
      baseURL: 'http://localhost:5173',
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--kiosk', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    })
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    await use(page)
    await ctx.close()
  },
})

async function fullscreen(page: Page): Promise<void> {
  await page.waitForFunction(() => window.innerWidth === 1920 && window.innerHeight === 1080, undefined, { timeout: 10_000 })
  await page.bringToFront()
  focusWindow()
}

const wait = (page: Page, ms: number) => page.waitForTimeout(ms)

/** Fresh run, straight into the world (no intro), with the keeper kept alive. */
async function boot(page: Page): Promise<void> {
  await fakeCursor(page)
  await page.goto('/')
  await fullscreen(page)
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 120_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  // The controls panel is shown in the intro shot; the rest of the video keeps the frame clear.
  await page.evaluate(() =>
    window.__lastRites!.markControlHints([
      'move', 'look', 'sprint', 'lantern', 'interact', 'journal', 'satchel', 'hotbar', 'map', 'pause',
      'attack', 'block', 'dodge', 'kick', 'reload', 'charge',
    ]),
  )
  await frames(page, 90)
}

/**
 * Takes pointer lock on the game canvas. A synthetic click does not get it here (the game asks for
 * unadjusted movement, which this CDP-driven window never answers), so the lock is asked plainly.
 */
async function relock(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const ok = await page.evaluate(async () => {
      if (document.pointerLockElement) return true
      const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
      try {
        await (c.requestPointerLock() as unknown as Promise<void>)
      } catch {
        /* try again */
      }
      return document.pointerLockElement !== null
    })
    if (ok) return
    await wait(page, 300)
  }
  throw new Error('no pointer lock')
}

/** Waits out Chrome's own "press Esc" bubbles (full screen, pointer lock) before a clip starts. */
async function quiet(page: Page): Promise<void> {
  await frames(page, 30)
  await wait(page, 600)
}

/** A slow, steady turn by real mouse movement (pointer locked): `px` in total over `ms`. */
async function pan(page: Page, px: number, ms: number): Promise<void> {
  const steps = Math.max(1, Math.round(ms / 16))
  let x = 960
  for (let i = 0; i < steps; i++) {
    x += px / steps
    await page.mouse.move(x, 540)
    await wait(page, 16)
  }
  await moveMouse(page, x, 540)
}

/** Moves the (free) cursor smoothly to a point. */
async function glide(page: Page, x: number, y: number, ms = 500): Promise<void> {
  const from = await page.evaluate(() => {
    const c = document.getElementById('__demo-cursor')
    const m = c?.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
    return m ? { x: +m[1] + 3, y: +m[2] + 2 } : { x: 960, y: 540 }
  })
  const steps = Math.max(1, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
    await wait(page, 16)
  }
  await moveMouse(page, x, y)
}

async function glideTo(page: Page, sel: Locator, ms = 500): Promise<void> {
  await sel.scrollIntoViewIfNeeded()
  const b = (await sel.boundingBox())!
  await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms)
}

async function slowClick(page: Page, sel: Locator, ms = 500): Promise<void> {
  await glideTo(page, sel, ms)
  await wait(page, 120)
  await page.mouse.down()
  await wait(page, 80)
  await page.mouse.up()
  await frames(page, 2)
}

async function slowDrag(page: Page, from: Locator, to: Locator): Promise<void> {
  await glideTo(page, from, 450)
  await page.mouse.down()
  await page.mouse.move(...(await nudge(from)))
  const b = (await to.boundingBox())!
  await glide(page, b.x + b.width / 2, b.y + b.height / 2, 800)
  await wait(page, 100)
  await page.mouse.up()
  await frames(page, 4)
}

async function nudge(l: Locator): Promise<[number, number]> {
  const b = (await l.boundingBox())!
  return [b.x + b.width / 2 + 12, b.y + b.height / 2 + 6]
}

const mystery = (page: Page) =>
  page.evaluate(() => [...(window.__lastRites!.snapshot('mystery') as { mystery: { pages: Set<number> } }).mystery.pages])

// ---------------------------------------------------------------------------
// 1. The intro cutscene, with the game's own narration, into the hut
// ---------------------------------------------------------------------------
test('intro', async ({ page }) => {
  await fakeCursor(page)
  await page.goto('/')
  await fullscreen(page)
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await quiet(page)
  const rec = await record('intro')
  await page.evaluate(() => window.__lastRites!.newGameWithIntro('normal'))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('intro') as { playing: boolean }).playing, undefined, {
    timeout: 120_000,
  })
  await page.waitForFunction(() => !(window.__lastRites!.snapshot('intro') as { playing: boolean }).playing, undefined, {
    timeout: 120_000,
    polling: 250,
  })
  await wait(page, 6_000)
  await rec.stop()
})

// ---------------------------------------------------------------------------
// 2. Day: the lantern, the objective pillar, a walk to the bells, a clue in 3D, the map
// ---------------------------------------------------------------------------
test('day', async ({ page }) => {
  await boot(page)
  // Off camera: the first page is read and the ledger solved, so the objective points outside.
  await relock(page)
  await useProp(page, 'fixed:fx-page-1', async () => {
    if ((await mystery(page)).includes(1)) return true
    if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0) await page.keyboard.press('Escape')
    return false
  })
  if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0) await page.keyboard.press('Escape')
  await page.evaluate(() => window.__lastRites!.solveCurrentMinigame())
  // A weapon in the satchel, so the objective is the story's next step and not "Craft a weapon".
  await page.evaluate(() => window.__lastRites!.give('wood-axe', 1, 1))
  await page
    .waitForFunction(() => /bell/i.test((window.__lastRites!.snapshot('objective') as { main?: string } | null)?.main ?? ''), undefined, {
      timeout: 20_000,
    })
    .catch(() => undefined)
  console.log('objective:', JSON.stringify(await page.evaluate(() => window.__lastRites!.snapshot('objective'))))
  const bell = (await page.evaluate(() => window.__lastRites!.interactableCentre('bell-hale')))!
  // Stand at the hut door, facing out.
  await page.evaluate(() => window.__lastRites!.teleport(0, 4.2, { yaw: Math.PI, pitch: -0.05 }))
  await relock(page)
  await frames(page, 120)
  await quiet(page)

  const walk = await record('day-walk')
  await wait(page, 800)
  await wait(page, 400)
  await lookAt(page, bell)
  await walkTo(page, { x: bell[0] + 2.2, z: bell[2] + 2.2 }, { arrive: 0.8, sprint: false, label: 'bells' })
  await lookAt(page, bell)
  await wait(page, 1_500)
  await walk.stop()

  // A clue in 3D: turn the crypt key over, then read what is scratched on it.
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/examineStore.ts')
    m.useExamineStore.getState().open('rusted-crypt-key')
  })
  await expect(page.locator('.examine')).toBeVisible()
  await showCursor(page, true)
  await page.mouse.move(1300, 760)
  await quiet(page)
  const ex = await record('day-examine')
  await wait(page, 700)
  const cb = (await page.locator('.examine canvas').first().boundingBox())!
  await glide(page, cb.x + cb.width * 0.4, cb.y + cb.height * 0.5, 600)
  await page.mouse.down()
  await glide(page, cb.x + cb.width * 0.75, cb.y + cb.height * 0.45, 1_400)
  await glide(page, cb.x + cb.width * 0.55, cb.y + cb.height * 0.55, 900)
  await page.mouse.up()
  await slowClick(page, page.locator('.examine__btn').first(), 700)
  await wait(page, 3_000)
  await ex.stop()
  await page.keyboard.press('Escape')

  // The map: the ground walked so far is inked in; a pin placed ahead stands in the world.
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/mapStore.ts')
    const reveal = m.useMapStore.getState().reveal
    // The ground a first day covers: the hut, the paths, the bells, the chapel front.
    for (let x = -34; x <= 22; x += 2) {
      for (let z = -26; z <= 34; z += 2) {
        const seen =
          Math.abs(x) < 6 || Math.abs(z - 4) < 6 || Math.hypot(x + 15, z + 15) < 12 || Math.hypot(x - 10, z) < 11
        if (seen) reveal([x, 0, z])
      }
    }
  })
  await relock(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await frames(page, 30)
  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toBeVisible()
  await showCursor(page, true)
  await page.mouse.move(1250, 700)
  // The map opens and inks itself in while the bubbles fade; record from a clean frame.
  await quiet(page)
  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toHaveCount(0)
  await page.evaluate(async () => {
    // Fresh cells again, so the ink-in plays on camera.
    const m = await import(/* @vite-ignore */ '/src/game/state/mapStore.ts')
    const reveal = m.useMapStore.getState().reveal
    for (let x = -40; x <= -30; x += 2) for (let z = -30; z <= 10; z += 2) reveal([x, 0, z])
  })
  const map = await record('map')
  await wait(page, 400)
  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toBeVisible()
  await wait(page, 1_500)
  await page.keyboard.press('Minus')
  await wait(page, 500)
  await page.keyboard.press('Minus')
  await wait(page, 1_200)
  const box = (await page.locator('.bigmap__canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await glide(page, cx + 80, cy + 30, 700)
  await wait(page, 300)
  await glide(page, cx, cy - 120, 800)
  await wait(page, 200)
  await page.mouse.down()
  await page.mouse.up()
  await wait(page, 2_000)
  await page.keyboard.press('Escape')
  await wait(page, 400)
  await map.stop()

  await showCursor(page, false)
  await relock(page)
  const pins = await page.evaluate(() => window.__lastRites!.mapPins())
  console.log('pins', JSON.stringify(pins))
  if (pins.pins[0]) await lookAt(page, [pins.pins[0].x, 1.5, pins.pins[0].z])
  await quiet(page)
  const pin = await record('map-pin')
  await wait(page, 800)
  await page.keyboard.down('KeyW')
  await wait(page, 3_000)
  await page.keyboard.up('KeyW')
  await wait(page, 1_000)
  await pin.stop()
})

// ---------------------------------------------------------------------------
// 3. The ledger cross-check, then the case board
// ---------------------------------------------------------------------------
test('ledger', async ({ page }) => {
  await boot(page)
  await relock(page)
  await openMinigame(page, 'ledger-shelf')
  await expect(page.getByRole('dialog', { name: 'Ledger Cross-check' })).toBeVisible()
  await showCursor(page, true)
  await page.mouse.move(1500, 900)
  await quiet(page)
  const rec = await record('ledger')
  await wait(page, 1_200)
  for (const [stone, entry, kind] of [
    ['pell', 'l-pell', 'Date'],
    ['ames', 'l-ames', 'Missing certificate'],
    ['hale', 'l-hale', 'Plot'],
  ] as const) {
    await slowDrag(page, page.locator(`[data-stone-id="${stone}"]`), page.locator(`[data-entry-id="${entry}"]`))
    await expect(page.locator(`[data-stone-id="${stone}"]`)).toContainText('Joined')
    await wait(page, 300)
    await slowClick(page, page.locator('.ledger__kind').filter({ hasText: kind }), 450)
    await slowClick(page, page.getByRole('button', { name: /Flag mismatch/ }), 450)
    await wait(page, 500)
  }
  await expect(page.locator('.minigame-shell__result')).toContainText('Three burials do not add up')
  await wait(page, 3_000)
  await rec.stop()
})

test('board', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => window.__lastRites!.giveAllClues())
  await expect(page.locator('.clue-reveal')).toHaveCount(0, { timeout: 120_000 })
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Case', exact: true }).click()
  await expect(page.locator('.case-board')).toBeVisible()
  await showCursor(page, true)
  await page.mouse.move(1600, 950)
  await quiet(page)
  const card = (id: string) => page.locator(`[data-clue-id="${id}"]`)
  const rec = await record('board')
  await wait(page, 1_500)
  await slowDrag(page, card('pell-rope-cut'), card('pell-tag-early'))
  await expect(page.locator('.case-tag--right')).toHaveCount(1)
  await wait(page, 2_500)
  await slowDrag(page, card('ledger-no-certificates'), card('ledger-date-mismatch'))
  await expect(page.locator('.case-tag--right')).toHaveCount(2)
  await wait(page, 3_000)
  await rec.stop()
})

// ---------------------------------------------------------------------------
// 4. The workbench: what you can make glows; craft a weapon
// ---------------------------------------------------------------------------
test('bench', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('bone', 3)
    h.give('cloth', 2)
    h.give('iron-nail', 4)
    h.give('grave-salt', 2)
    h.give('candle-wax', 2)
  })
  await relock(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, -0.2, { yaw: 0, pitch: -0.5 }))
  await page
    .waitForFunction(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'workbench', undefined, {
      timeout: 20_000,
    })
    .catch(async () => {
      await page.evaluate(() => window.__lastRites!.teleport(0, -0.9, { yaw: 0, pitch: -0.65 }))
      await page.waitForFunction(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'workbench')
    })
  await quiet(page)
  const rec = await record('bench')
  await wait(page, 1_000)
  await pressE(page)
  await expect
    .poll(() => page.evaluate(() => (window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen))
    .toBe(true)
  await showCursor(page, true)
  await page.mouse.move(1500, 800)
  await wait(page, 1_800)
  const craft = page.getByRole('button', { name: 'Craft Bone Club', exact: true })
  await slowClick(page, craft, 1_000)
  await wait(page, 3_500)
  await rec.stop()
})

// ---------------------------------------------------------------------------
// 5. Dusk to night: the bell, the oil gauge, a telegraphed scare, a wave
// ---------------------------------------------------------------------------
test('night', async ({ page }) => {
  await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('wood-axe', 1, 1)
    h.equip(1)
  })
  await relock(page)
  // In the grounds, looking at the chapel.
  await page.evaluate(() => window.__lastRites!.teleport(2, 12, { yaw: 0.35, pitch: 0.05 }))
  await quiet(page)
  const dusk = await record('dusk')
  await wait(page, 1_000)
  await page.evaluate(() => window.__lastRites!.skipToDusk(1))
  await wait(page, 9_000)
  await dusk.stop()

  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.killAll()
    h.setLantern(true, 0.55)
    h.setSetting('brightness' as never, 1.35 as never)
    h.teleport(-4, 18, { yaw: 0.2, pitch: -0.05 })
  })
  console.log('lantern', JSON.stringify(await page.evaluate(() => window.__lastRites!.snapshot('lantern'))))
  await quiet(page)
  const scare = await record('night-scare')
  await wait(page, 1_200)
  await page.evaluate(() => window.__lastRites!.forceScare('breath-behind'))
  await wait(page, 4_000)
  await pan(page, -1400, 800)
  await wait(page, 1_000)
  await page.evaluate(() => window.__lastRites!.forceScare('lurker-lunge'))
  await wait(page, 5_000)
  await scare.stop()

  // A wave: the dead come out of the fog, and the axe answers.
  await page.evaluate(() => window.__lastRites!.killAll())
  // On the open path south of the chapel, facing the gate the dead come from.
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: Math.PI, pitch: -0.04 }))
  await frames(page, 30)
  await quiet(page)
  const wave = await record('night-wave')
  await wait(page, 300)
  await page.evaluate(() =>
    window.__lastRites!.spawnZombies([
      { x: -2, z: 32 },
      { x: 2.5, z: 33 },
      { x: 0, z: 36 },
      { x: -4, z: 37 },
      { x: 4, z: 38 },
    ]),
  )
  const t0 = Date.now()
  while (Date.now() - t0 < 16_000) {
    const target = await page.evaluate(() => {
      const b = window.__lastRites!.body()!
      const es = window.__lastRites!.snapshot('enemies') as { pos: { x: number; z: number }; hp: number }[]
      let best: { x: number; z: number; d: number } | null = null
      for (const e of es) {
        const d = Math.hypot(e.pos.x - b.feet[0], e.pos.z - b.feet[2])
        if (e.hp > 0 && (!best || d < best.d)) best = { x: e.pos.x, z: e.pos.z, d }
      }
      return best
    })
    if (target) {
      await lookAt(page, [target.x, 1.2, target.z])
      if (target.d < 2.4) {
        await page.mouse.down()
        await wait(page, 120)
        await page.mouse.up()
        await wait(page, 450)
        continue
      }
    }
    await wait(page, 120)
  }
  await wave.stop()
  console.log('body', JSON.stringify(await body(page)))
})

// ---------------------------------------------------------------------------
// 6. Comfort: a scare at Full, Scare intensity set to Off, the same scare as a caption
// ---------------------------------------------------------------------------
test('settings', async ({ page }) => {
  await boot(page)
  await relock(page)
  await page.evaluate(() => window.__lastRites!.teleport(6, 6, { yaw: 0.6, pitch: 0 }))
  await quiet(page)
  const full = await record('scare-full')
  await wait(page, 1_000)
  await page.evaluate(() => window.__lastRites!.forceScare('door-slam'))
  await wait(page, 5_000)
  await full.stop()

  // Esc in a CDP-driven full-screen window goes to Chrome, not the page: pause as Esc would.
  await page.evaluate(async () => {
    document.exitPointerLock()
    const m = await import(/* @vite-ignore */ '/src/game/state/gameStore.ts')
    m.useGameStore.getState().setPaused(true)
  })
  const pause = page.getByRole('dialog', { name: /paused/i })
  await expect(pause).toBeVisible()
  await showCursor(page, true)
  await page.mouse.move(1300, 700)
  await quiet(page)
  const ui = await record('settings-ui')
  await wait(page, 800)
  await slowClick(page, pause.getByRole('button', { name: 'Settings' }), 700)
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await wait(page, 800)
  const sel = dialog.getByLabel('Scare intensity')
  await glideTo(page, sel, 700)
  await wait(page, 300)
  await sel.selectOption('off')
  await wait(page, 2_000)
  await ui.stop()

  await page.keyboard.press('Escape')
  await wait(page, 300)
  if (await pause.isVisible().catch(() => false)) await slowClick(page, pause.getByRole('button', { name: 'Resume' }), 10)
  await showCursor(page, false)
  await relock(page)
  await quiet(page)
  const off = await record('scare-off')
  await wait(page, 1_000)
  await page.evaluate(() => window.__lastRites!.forceScare('door-slam'))
  await wait(page, 5_000)
  await off.stop()
})
