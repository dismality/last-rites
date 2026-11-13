import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 09 task 11e: the HUD minimap. Reveals new ground, never overlaps the other HUD pieces at
// the three viewport sizes, is hidden during the intro and menus, and has a measured frame cost.
// Headless Chrome renders WebGL on SwiftShader, so frame times here are pessimistic and are not
// real GPU frame rates.

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]

async function startRun(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

/** Pixels with any ink on the minimap canvas, and how many of them are in the lower-left corner box. */
function canvasInk(page: Page): Promise<{ total: number; corner: number }> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.minimap__canvas')!
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let total = 0
    let corner = 0
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] === 0) continue
        total++
        if (x < 40 && y > c.height - 40) corner++
      }
    }
    return { total, corner }
  })
}

const exploredCount = (page: Page): Promise<number> =>
  page.evaluate(
    () => Object.keys((window.__lastRites!.snapshot('map') as { explored: Record<string, true> }).explored).length,
  )

test('walking into unexplored cells reveals new ground; idle draws nothing; walking is rate limited', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await page.waitForTimeout(800)
  // One short step so the cell under the player is explored (reveal happens on movement).
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.waitForTimeout(500)
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  await page.waitForTimeout(600)

  await expect(page.locator('.minimap')).toBeVisible()
  const cells0 = await exploredCount(page)
  const ink0 = await canvasInk(page)
  expect(cells0).toBeGreaterThan(0)
  expect(ink0.total).toBeGreaterThan(0)
  // Unexplored stays blank: the far lower-left corner of the window holds no ink yet.
  expect(ink0.corner).toBe(0)

  // Standing still: nothing changed, so (almost) nothing is redrawn.
  const idleA = await page.evaluate(() => window.__lastRites!.minimapStats())
  await page.waitForTimeout(2000)
  const idleB = await page.evaluate(() => window.__lastRites!.minimapStats())
  expect(idleB.draws - idleA.draws).toBeLessThanOrEqual(1)

  // Walk north across open ground into new cells.
  const w0 = await page.evaluate(() => window.__lastRites!.minimapStats())
  const t0 = Date.now()
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.evaluate(() => window.__lastRites!.hold('Sprint'))
  // SwiftShader runs the sim at a few frames a second, so the walk is slow: give it time to cross cells.
  await page.waitForTimeout(9000)
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  await page.evaluate(() => window.__lastRites!.release('Sprint'))
  const secs = (Date.now() - t0) / 1000
  const w1 = await page.evaluate(() => window.__lastRites!.minimapStats())
  await page.waitForTimeout(900) // let the last cells finish inking in

  const cells1 = await exploredCount(page)
  const ink1 = await canvasInk(page)
  expect(cells1).toBeGreaterThan(cells0)
  expect(ink1.total).toBeGreaterThan(ink0.total)
  // Rate limit: at most ~15 a second (a little slack for timer jitter), and fewer than the frames run.
  expect((w1.draws - w0.draws) / secs).toBeLessThanOrEqual(16)
  expect(w1.draws - w0.draws).toBeLessThan(w1.frames - w0.frames)
  console.log(
    `minimap reveal: cells ${cells0} -> ${cells1}, ink px ${ink0.total} -> ${ink1.total}, ` +
      `walking draws ${w1.draws - w0.draws} in ${secs.toFixed(1)} s over ${w1.frames - w0.frames} frames`,
  )
})

for (const vp of SIZES) {
  test(`no HUD overlap with the minimap at ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.showBossBar())
    await page.waitForSelector('.boss-bar')
    await page.waitForTimeout(600)

    const result = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return null
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      const mini = box('.minimap')
      const others: Record<string, ReturnType<typeof box>> = {}
      for (const sel of [
        '.compass',
        '.hud-objective',
        '.hotbar',
        '.health-bar',
        '.boss-bar',
        '.score-panel',
        '.hud-tally',
        '.hud-rite',
        '.ammo-readout',
        '.effect-icons',
        '.door-status',
        '.lantern-gauge',
      ]) {
        others[sel] = box(sel)
      }
      return { mini, others, w: innerWidth, h: innerHeight }
    })

    const m = result.mini!
    expect(m, 'minimap is on screen').not.toBeNull()
    expect(m.left).toBeGreaterThanOrEqual(0)
    expect(m.top).toBeGreaterThanOrEqual(0)
    expect(m.right).toBeLessThanOrEqual(result.w)
    expect(m.bottom).toBeLessThanOrEqual(result.h)
    // The five pieces the task names must exist to be checked at all.
    for (const sel of ['.compass', '.hud-objective', '.hotbar', '.health-bar', '.boss-bar']) {
      expect(result.others[sel], `${sel} is shown`).not.toBeNull()
    }
    const overlaps: string[] = []
    for (const [sel, b] of Object.entries(result.others)) {
      if (!b) continue
      const hit = m.left < b.right && m.right > b.left && m.top < b.bottom && m.bottom > b.top
      if (hit) overlaps.push(sel)
    }
    console.log(
      `overlap ${vp.width}x${vp.height}: minimap ${JSON.stringify(m)}; checked ${Object.entries(result.others)
        .filter(([, b]) => b)
        .map(([s]) => s)
        .join(' ')}; overlapping: ${overlaps.length ? overlaps.join(' ') : 'none'}`,
    )
    expect(overlaps).toEqual([])
  })
}

test('hidden during the intro, menus and when switched off; M and the setting toggle it', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.newGameWithIntro('normal'))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('intro') as { playing: boolean }).playing, undefined, {
    timeout: 90_000,
  })
  await expect(page.locator('.minimap')).toHaveCount(0)
  await page.keyboard.press('Space') // skip the cutscene
  await page.waitForFunction(() => !(window.__lastRites!.snapshot('intro') as { playing: boolean }).playing)
  await expect(page.locator('.minimap')).toBeVisible()

  // A menu (the journal) hides it and closing brings it back.
  await page.keyboard.press('KeyJ')
  await expect(page.locator('.minimap')).toBeHidden()
  await page.keyboard.press('KeyJ')
  await expect(page.locator('.minimap')).toBeVisible()

  // The Minimap key (N, moved from M for the big map) switches it off and on, and the choice is saved like other settings.
  await page.keyboard.press('KeyN')
  await expect(page.locator('.minimap')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('last-rites-settings')!).showMinimap)).toBe(false)
  await page.keyboard.press('KeyN')
  await expect(page.locator('.minimap')).toBeVisible()
  await page.evaluate(() => window.__lastRites!.setSetting('showMinimap', false))
  await expect(page.locator('.minimap')).toHaveCount(0)
})

test('longest frame while walking and turning, map on and off', async ({ page }) => {
  test.setTimeout(420_000)
  await startRun(page)
  const sample = async (on: boolean) => {
    await page.evaluate((v) => window.__lastRites!.setSetting('showMinimap', v), on)
    await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
    await page.waitForTimeout(2000)
    return page.evaluate(async () => {
      const h = window.__lastRites!
      h.resetFrames()
      const d0 = h.minimapStats()
      h.hold('MoveForward')
      await new Promise<void>((resolve) => {
        const t0 = performance.now()
        const step = (now: number) => {
          h.input.mouseMove(6, 0) // turns continuously, as a real mouse would
          if (now - t0 < 6000) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      h.release('MoveForward')
      const d1 = h.minimapStats()
      return { longestMs: h.longestFrameMs(), draws: d1.draws - d0.draws, frames: d1.frames - d0.frames }
    })
  }
  const runs: { map: 'on' | 'off'; longestMs: number; draws: number; frames: number }[] = []
  for (const on of [true, false, true, false]) {
    const r = await sample(on)
    runs.push({ map: on ? 'on' : 'off', ...r })
  }
  const worst = (m: 'on' | 'off') => Math.max(...runs.filter((r) => r.map === m).map((r) => r.longestMs))
  const summary = { runs, worstOnMs: worst('on'), worstOffMs: worst('off') }
  mkdirSync('e2e/logs', { recursive: true })
  writeFileSync('e2e/logs/minimap-perf.json', JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  // A hitch guard, not a target: SwiftShader is slow, so only a runaway cost would trip this.
  expect(worst('on')).toBeLessThan(worst('off') + 250)
})
