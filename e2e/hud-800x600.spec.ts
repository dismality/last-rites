import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 18 (B12): the HUD never overlaps itself, from 800x600 up. Real stores and HUD;
// the check is on bounding boxes of every HUD block that is on screen, in a day and a night state.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]

// Blocks that can be on screen together. Subtitles, prompts and toasts are transient and omitted.
const BLOCKS = [
  '.compass',
  '.hud-objective',
  '.hud-top-stack .hud-tally',
  '.hud-top-stack .hud-rite',
  '.hud-top-stack .boss-bar',
  '.hud-top-stack .door-status',
  '.score-panel',
  '.minimap',
  '.control-hints',
  '.health-bar',
  '.lantern-gauge',
  '.hud-stamina',
  '.hotbar',
  '.effect-icons',
  '.ammo-readout',
]
// Children of the objective tracker: they must sit inside it, not beside it.
const NESTED = ['.hud-curse', '.hud-pin']

type Box = { x: number; y: number; width: number; height: number }
const hits = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5

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

async function checkNoOverlap(page: Page, size: { width: number; height: number }): Promise<string[]> {
  const found: { sel: string; box: Box }[] = []
  for (const sel of BLOCKS) {
    const loc = page.locator(sel)
    const n = await loc.count()
    for (let i = 0; i < n; i++) {
      const box = await loc.nth(i).boundingBox()
      if (box && box.width > 0 && box.height > 0) found.push({ sel, box })
    }
  }
  const problems: string[] = []
  for (const { sel, box } of found) {
    if (box.x < -0.5 || box.y < -0.5 || box.x + box.width > size.width + 0.5 || box.y + box.height > size.height + 0.5)
      problems.push(`${sel} leaves the viewport`)
  }
  for (let i = 0; i < found.length; i++)
    for (let j = i + 1; j < found.length; j++)
      if (hits(found[i]!.box, found[j]!.box)) problems.push(`${found[i]!.sel} overlaps ${found[j]!.sel}`)
  const parent = await page.locator('.hud-objective').first().boundingBox()
  for (const sel of NESTED) {
    // boundingBox() waits for the element, so look first: a missing child is fine.
    const box = (await page.locator(sel).count()) > 0 ? await page.locator(sel).first().boundingBox() : null
    if (box && parent && (box.x + box.width > parent.x + parent.width + 0.5 || box.y < parent.y - 0.5))
      problems.push(`${sel} spills out of the objective tracker`)
  }
  expect(found.length).toBeGreaterThanOrEqual(6)
  return problems
}

for (const size of SIZES) {
  test(`HUD blocks do not overlap by day at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(size)
    await startRun(page)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.teleport(0, 24, { yaw: 0 })
      h.give('wood-axe', 1, 1)
      h.equip(1)
    })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${SHOTS}/hud-day-${size.width}x${size.height}.png` })
    expect(await checkNoOverlap(page, size)).toEqual([])
  })

  test(`HUD blocks do not overlap at night with the boss bar at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(size)
    await startRun(page)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.keepAlive(true)
      h.give('wood-axe', 1, 1)
      h.equip(1)
      h.skipToNight(5)
      // Repair stage 1 through the real action so the door status shows, then full boards.
      h.give('iron-nail', 4)
      h.give('bone', 2)
      h.repairChapel()
      h.setDoorBoards([60, 60, 60], [60, 60, 60])
      // Two timed effects through the real consume action, so the effect icons are on screen.
      h.give('kola-tonic', 1, 2)
      h.equip(2)
      h.consumeHeld()
      h.give('blessed-rounds', 1, 3)
      h.equip(3)
      h.consumeHeld()
      h.equip(1)
      h.showBossBar()
    })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${SHOTS}/hud-night-${size.width}x${size.height}.png` })
    for (const sel of ['.compass', '.hud-objective', '.hud-curse', '.boss-bar', '.door-status', '.effect-icons', '.minimap', '.hotbar', '.health-bar', '.hud-stamina', '.control-hints'])
      expect(await page.locator(sel).count(), `${sel} on screen`).toBeGreaterThan(0)
    expect(await checkNoOverlap(page, size)).toEqual([])
  })
}
