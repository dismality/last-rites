// Task 11.2, pass C: playtest items 13 to 15, played in real Chrome through the debug hook.
// Measurements go to e2e/logs/items-13-15.log, screenshots to e2e/screenshots/.
import { appendFileSync, mkdirSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const LOG_DIR = 'e2e/logs'
const SHOT_DIR = 'e2e/screenshots'
const LOG_FILE = `${LOG_DIR}/items-13-15.log`
mkdirSync(LOG_DIR, { recursive: true })
mkdirSync(SHOT_DIR, { recursive: true })
const log = (line: string) => {
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}

interface World {
  phase: string
  phaseTime: number
  nightNumber: number
}

const snap = <T>(page: Page, name: Parameters<NonNullable<Window['__lastRites']>['snapshot']>[0]) =>
  page.evaluate((n) => window.__lastRites!.snapshot(n), name) as Promise<T>

async function until<A>(page: Page, fn: (arg: A) => unknown, arg: A, timeout = 90_000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 100 })
}

async function boot(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phaseTime > 0.3, null, 120_000)
  await until(page, () => window.__lastRites!.body() !== null, null, 60_000)
  return errors
}

const bodyAt = (page: Page, x: number, z: number, tol = 0.3) =>
  until(
    page,
    (a) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - a.x, b.feet[2] - a.z) < a.tol
    },
    { x, z, tol },
    60_000,
  )

// ---------------------------------------------------------------------------------------------
// Item 13: barricade timing
// ---------------------------------------------------------------------------------------------

test('item 13: night 3 barricades, 3 front + 2 vestry boards, 6 shamblers, real AI', async ({ page }) => {
  test.setTimeout(600_000)
  const errors = await boot(page)

  // Repair stage 1 through the real repair action (spends 4 iron nails + 2 bone, fits 2 boards per door).
  const fitted = await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('iron-nail', 4)
    h.give('bone', 2)
    h.keepAlive(true)
    return h.repairChapel()
  })
  expect(fitted).toBe(true)
  const built = await snap<{ built: boolean; doors: { front: number[]; vestry: number[] } }>(page, 'doors')
  log(`item13 stage 1 via the real repair action: built=${built.built}, boards front=${built.doors.front.length} vestry=${built.doors.vestry.length}`)
  expect(built.built).toBe(true)
  // The third front board is set straight in the store (a shortcut: real nailing needs wood and a 2 s hold per board).
  await page.evaluate(() => window.__lastRites!.setDoorBoards([60, 60, 60], [60, 60]))

  // Night 3 with the player inside the chapel; set via the clock only, so no director wave joins the six.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setClock({ phase: 'night', night: 3, phaseTime: 0 })
    h.teleport(10, 7, { yaw: 0 })
  })
  await bodyAt(page, 10, 7)
  const spawn = [
    { x: 9, z: -12 }, { x: 10, z: -12 }, { x: 11, z: -12 },
    { x: -3, z: 8.5 }, { x: -3, z: 9.5 }, { x: -3, z: 10.5 },
  ]
  await page.evaluate((pts) => {
    const h = window.__lastRites!
    h.spawnZombies(pts)
    const w = window as unknown as { __doorLog: { wall: number; sim: number; front: number[]; vestry: number[] }[] }
    w.__doorLog = []
    const t0 = performance.now()
    setInterval(() => {
      const d = h.snapshot('doors') as { doors: { front: number[]; vestry: number[] } }
      const world = h.snapshot('world') as { phaseTime: number }
      w.__doorLog.push({ wall: (performance.now() - t0) / 1000, sim: world.phaseTime, front: d.doors.front, vestry: d.doors.vestry })
    }, 50)
  }, spawn)

  await until(page, () => {
    const l = (window as unknown as { __doorLog: { front: number[]; vestry: number[] }[] }).__doorLog
    const last = l[l.length - 1]
    return last !== undefined && last.front.length === 0 && last.vestry.length === 0
  }, null, 300_000)

  const entries = await page.evaluate(() => (window as unknown as { __doorLog: { wall: number; sim: number; front: number[]; vestry: number[] }[] }).__doorLog)
  const total = (b: number[]) => b.reduce((a, c) => a + c, 0)
  const start = entries[0]
  const report: Record<string, { firstBlowSim: number; emptySim: number; firstBlowWall: number; emptyWall: number }> = {}
  for (const door of ['front', 'vestry'] as const) {
    const full = total(start[door])
    const first = entries.find((e) => total(e[door]) < full)!
    const empty = entries.find((e) => e[door].length === 0)!
    report[door] = { firstBlowSim: first.sim, emptySim: empty.sim, firstBlowWall: first.wall, emptyWall: empty.wall }
    log(`item13 ${door}: sim clock first blow ${first.sim.toFixed(1)} s, 0 boards ${empty.sim.toFixed(1)} s, ` +
      `first blow to 0 boards = ${(empty.sim - first.sim).toFixed(1)} s sim (${(empty.wall - first.wall).toFixed(1)} s wall); spawn to 0 boards = ${empty.sim.toFixed(1)} s sim`)
  }
  log('item13 design maths (tests/barricadeStrength.test.ts): 3 front boards 7.9 s and 2 vestry boards 4.9 s with 3 shamblers at each door; playtest saw about 20 s from arrival')
  // The browser must not be faster than the design maths allows (less than a blow cycle per board).
  expect(report.front.emptySim - report.front.firstBlowSim).toBeGreaterThan(5)
  expect(report.vestry.emptySim - report.vestry.firstBlowSim).toBeGreaterThan(3)
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// Item 14: icons and the item-name label
// ---------------------------------------------------------------------------------------------

test('item 14: 64 px crisp icons, aria names, shared name label timing', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('bandage', 1, 1)
    h.give('lantern-refill', 1, 2)
    h.give('bone', 3)
    h.give('cloth', 2)
    h.give('iron-nail', 4)
    h.teleport(0, 5, { yaw: 0 })
  })
  await page.waitForTimeout(1500)

  // The label has not been raised yet.
  await expect(page.locator('.item-name-label')).toHaveCount(0)

  const hotbar = await page.locator('.hotbar .item-icon').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      const img = e as HTMLImageElement
      return {
        w: r.width, h: r.height, rendering: getComputedStyle(e).imageRendering,
        natural: img.naturalWidth, complete: img.complete, title: e.closest('[title]') !== null,
      }
    }),
  )
  log(`item14 hotbar icons: ${JSON.stringify(hotbar)}`)
  expect(hotbar.length).toBe(3)
  for (const i of hotbar) {
    expect(i.w).toBe(64)
    expect(i.h).toBe(64)
    expect(i.rendering).toMatch(/pixelated|crisp-edges/)
    expect(i.natural).toBe(64)
    expect(i.complete).toBe(true)
    expect(i.title).toBe(false)
  }
  const slotLabels = await page.locator('.hotbar__slot').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  log(`item14 hotbar aria-labels: ${JSON.stringify(slotLabels)}`)
  expect(slotLabels).toEqual(['Slot 1: Rusty Shovel, held', 'Slot 2: Bandage', 'Slot 3: Lantern Refill', 'Slot 4: empty'])

  // Number key by the real keyboard event: slot 2.
  const sampleLabel = (ms: number) =>
    page.evaluate(
      (total) =>
        new Promise<{ t: number; op: number; text: string }[]>((resolve) => {
          const out: { t: number; op: number; text: string }[] = []
          const t0 = performance.now()
          const tick = () => {
            const el = document.querySelector<HTMLElement>('.item-name-label')
            out.push({ t: performance.now() - t0, op: el ? Number(el.style.opacity || '1') : 0, text: el?.textContent ?? '' })
            if (performance.now() - t0 < total) requestAnimationFrame(tick)
            else resolve(out)
          }
          tick()
        }),
      ms,
    )
  const sampling = sampleLabel(3600)
  await page.keyboard.press('Digit2')
  const s1 = await sampling
  const shown = s1.filter((s) => s.text !== '')
  const t0 = shown[0].t
  const at = (ms: number) => shown.reduce((best, s) => (Math.abs(s.t - t0 - ms) < Math.abs(best.t - t0 - ms) ? s : best))
  const fullUntil = Math.max(...shown.filter((s) => s.op >= 0.999).map((s) => s.t - t0))
  const gone = s1.find((s) => s.t > t0 && s.text === '')
  log(`item14 number key: name="${shown[0].text}", opacity 1 until ${fullUntil.toFixed(0)} ms, opacity at 1000 ms=${at(1000).op}, ` +
    `at 2300 ms=${at(2300).op.toFixed(2)}, label removed at ${gone ? (gone.t - t0).toFixed(0) : 'never'} ms`)
  expect(shown[0].text).toBe('Bandage')
  expect(at(1000).op).toBe(1)
  expect(fullUntil).toBeGreaterThan(1800)
  expect(fullUntil).toBeLessThan(2400)
  expect(at(2300).op).toBeLessThan(1)
  expect(at(2300).op).toBeGreaterThan(0)
  expect(gone).toBeDefined()
  expect(gone!.t - t0).toBeGreaterThan(2400)
  expect(gone!.t - t0).toBeLessThan(3200)

  // Empty slot 4 shows nothing while no name is running.
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(400)
  await expect(page.locator('.item-name-label')).toHaveCount(0)
  log('item14 empty slot 4: no label')

  // A new name replaces the old at once, even mid-fade.
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(2200)
  const mid = await page.locator('.item-name-label').evaluate((e) => Number((e as HTMLElement).style.opacity))
  await page.keyboard.press('Digit3')
  await page.waitForTimeout(120)
  const after = await page.locator('.item-name-label').evaluate((e) => ({ text: e.textContent, op: Number((e as HTMLElement).style.opacity) }))
  log(`item14 replace: opacity before ${mid.toFixed(2)} (fading), after pressing 3: "${after.text}" opacity ${after.op}`)
  expect(mid).toBeLessThan(1)
  expect(after.text).toBe('Lantern Refill')
  expect(after.op).toBeGreaterThan(0.95)

  // Mouse wheel, as a real wheel event (lockless mode stands in for pointer lock).
  await page.waitForTimeout(3200)
  await page.mouse.move(640, 360)
  await page.mouse.wheel(0, 100)
  await page.waitForTimeout(250)
  const wheel = await page.locator('.item-name-label').textContent()
  const equipped = (await snap<{ equippedSlot: number }>(page, 'inventory')).equippedSlot
  log(`item14 wheel down from slot 3: label "${wheel}", equipped slot index ${equipped}`)
  expect(wheel).toBeTruthy()
  expect(equipped).not.toBe(2)

  // Satchel: 64 px icons, aria names, hover shows the name.
  await page.waitForTimeout(3200)
  await page.keyboard.press('Tab')
  await expect(page.locator('.satchel__cell:not(.satchel__cell--empty)').first()).toBeVisible()
  const cells = await page.locator('.satchel__cell .item-icon').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      const img = e as HTMLImageElement
      return { w: r.width, h: r.height, rendering: getComputedStyle(e).imageRendering, natural: img.naturalWidth, title: e.closest('[title]') !== null }
    }),
  )
  const cellLabels = await page.locator('.satchel__cell:not(.satchel__cell--empty)').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  log(`item14 satchel icons: ${cells.length}, sizes ${[...new Set(cells.map((c) => `${c.w}x${c.h}`))]}, rendering ${[...new Set(cells.map((c) => c.rendering))]}, natural ${[...new Set(cells.map((c) => c.natural))]}`)
  log(`item14 satchel aria-labels: ${JSON.stringify(cellLabels)}`)
  expect(cells.length).toBeGreaterThan(4)
  for (const c of cells) {
    expect(c.w).toBe(64)
    expect(c.h).toBe(64)
    expect(c.rendering).toMatch(/pixelated|crisp-edges/)
    expect(c.natural).toBe(64)
    expect(c.title).toBe(false)
  }
  expect(await page.locator('.satchel [title], .hotbar [title]').count()).toBe(0)
  await page.waitForTimeout(3200)
  await page.locator('.satchel__cell:not(.satchel__cell--empty)').nth(2).hover()
  await page.waitForTimeout(200)
  const hover = await page.locator('.item-name-label').textContent()
  const hoverCell = await page.locator('.satchel__cell:not(.satchel__cell--empty)').nth(2).getAttribute('aria-label')
  log(`item14 satchel hover: label "${hover}", cell aria-label "${hoverCell}"`)
  expect(hoverCell).toContain(hover!)
  await page.screenshot({ path: `${SHOT_DIR}/icons-hotbar-satchel.png` })
  await page.keyboard.press('Tab')
  expect(errors).toEqual([])
})

test('item 14b: the name label stays hidden during the intro', async ({ page }) => {
  test.setTimeout(300_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.newGameWithIntro('normal'))
  await until(page, () => (window.__lastRites!.snapshot('intro') as { playing: boolean }).playing, null, 120_000)
  await page.evaluate(() => window.__lastRites!.showItemName('bandage'))
  await page.waitForTimeout(500)
  const during = await page.locator('.item-name-label').count()
  log(`item14 intro: label count while the intro plays = ${during}`)
  expect(during).toBe(0)
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// Item 15: first workbench open
// ---------------------------------------------------------------------------------------------

test('item 15: first workbench open against a control', async ({ page }) => {
  test.setTimeout(300_000)
  const probe: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[perf]')) probe.push(m.text())
  })
  const errors = await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.keepAlive(true)
    h.give('bone', 5)
    h.give('cloth', 4)
    h.give('iron-nail', 6)
    h.give('lamp-oil', 2)
    // In front of the bench (z -2.2), facing it.
    h.teleport(0, -0.9, { yaw: 0, pitch: -0.3 })
  })
  await bodyAt(page, 0, -0.9)
  await until(page, () => (window.__lastRites!.snapshot('hover') as { id: string } | null) !== null, null, 30_000)
  const hoverId = (await snap<{ id: string }>(page, 'hover')).id
  log(`item15 aiming at "${hoverId}"`)
  await page.waitForTimeout(6000) // let the scene settle

  const longest = () => page.evaluate(() => window.__lastRites!.longestFrameMs(2000))
  const measureIdle = async () => {
    await page.evaluate(() => window.__lastRites!.resetFrames())
    await page.waitForTimeout(2200)
    return longest()
  }
  const measureOpen = async () => {
    await page.evaluate(() => window.__lastRites!.resetFrames())
    await page.evaluate(() => window.__lastRites!.press('KeyE'))
    await until(page, () => (window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen, null, 30_000)
    await page.waitForTimeout(2200)
    const v = await longest()
    await page.keyboard.press('Escape')
    await until(page, () => !(window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen, null, 30_000)
    await page.waitForTimeout(1500)
    return v
  }
  const idle1 = await measureIdle()
  const first = await measureOpen()
  const idle2 = await measureIdle()
  const second = await measureOpen()
  log(`item15 longest frame over 2 s (SwiftShader, so absolute numbers are inflated): idle control ${idle1.toFixed(0)} ms, ` +
    `FIRST bench open ${first.toFixed(0)} ms, idle control ${idle2.toFixed(0)} ms, SECOND bench open ${second.toFixed(0)} ms`)
  log(`item15 BenchOpenProbe console lines: ${JSON.stringify(probe)}`)
  const control = Math.max(idle1, idle2, second)
  const bad = first > 3 * control && first > 200
  log(`item15 first open vs control: ${(first / Math.max(control, 1)).toFixed(2)}x; clearly worse (>3x and >200 ms): ${bad}`)
  expect(probe.length).toBeGreaterThanOrEqual(2)
  expect(bad).toBe(false)
  expect(errors).toEqual([])
})
