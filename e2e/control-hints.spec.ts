import { test, expect, type Locator, type Page } from '@playwright/test'

// Spec 09 task 17: the controls hint panel at the bottom left, the stamina caption and compass
// labels that never overlap. Real stores and the real HUD; headless, so only behaviour and layout.

const SHOTS = 'e2e/screenshots'
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

type Box = { x: number; y: number; width: number; height: number }
const hits = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

async function boxOf(loc: Locator): Promise<Box | null> {
  if ((await loc.count()) === 0) return null
  return loc.first().boundingBox()
}

/**
 * Holds the actions until `done` is true. Software rendering runs the sim at a few frames a
 * second, so the wait is on the game's own state, never a fixed wall-clock time.
 */
const holdUntil = async (page: Page, actions: string[], done: () => Promise<boolean>): Promise<void> => {
  await page.evaluate((a) => a.forEach((n) => window.__lastRites!.hold(n)), actions)
  try {
    await expect.poll(done, { timeout: 120_000, intervals: [250] }).toBe(true)
  } finally {
    await page.evaluate((a) => a.forEach((n) => window.__lastRites!.release(n)), actions)
  }
}

const lineIds = (page: Page): Promise<string[]> =>
  page.locator('.control-hints__line:not([data-leaving="true"])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.hint ?? ''))

test('the panel shows keys, fades each line after its action, and returns with the setting', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await page.waitForTimeout(500)

  const panel = page.locator('.control-hints')
  await expect(panel).toBeVisible()
  expect(await lineIds(page)).toEqual(['move', 'sprint'])
  await expect(panel).toContainText('Move')
  await expect(panel.locator('[data-hint="move"] kbd')).toHaveText(['W', 'A', 'S', 'D'])
  await expect(panel.locator('[data-hint="sprint"] kbd')).toHaveText(['Shift'])
  await page.screenshot({ path: `${SHOTS}/control-hints-1280x720.png` })

  // Walk about 15 m: the Move line fades and goes.
  await holdUntil(page, ['MoveForward'], async () => !(await lineIds(page)).includes('move'))
  await expect.poll(() => lineIds(page)).toEqual(['sprint'])
  await expect(panel.locator('[data-hint="move"]')).toHaveCount(0, { timeout: 5000 })

  // A rusty shovel in hand shows no charge line; the axe does, and one charged swing clears it.
  await page.evaluate(() => {
    window.__lastRites!.give('wood-axe', 1, 1)
    window.__lastRites!.equip(1)
  })
  await expect(panel.locator('[data-hint="charge"]')).toBeVisible()
  await expect(panel.locator('[data-hint="charge"]')).toContainText('Hold')
  await expect(panel.locator('[data-hint="charge"] kbd')).toHaveText(['V'])
  await page.screenshot({ path: `${SHOTS}/control-hints-axe-1280x720.png` })
  await page.evaluate(() => window.__lastRites!.equip(0))
  await expect(panel.locator('[data-hint="charge"]')).toHaveCount(0)
  await page.evaluate(() => window.__lastRites!.equip(1))
  await holdUntil(page, ['HeavyAttack'], async () => !(await lineIds(page)).includes('charge'))
  await expect(panel.locator('[data-hint="charge"]')).toHaveCount(0, { timeout: 5000 })

  // Sprint 2 s: the last line goes and the panel is gone.
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await holdUntil(page, ['MoveForward', 'Sprint'], async () => (await lineIds(page)).length === 0)
  await expect(panel).toHaveCount(0, { timeout: 5000 })

  // Stamina bar carries its caption.
  await expect(page.locator('.hud-stamina__caption')).toHaveText('Stamina')

  // Setting off hides it; on shows every line again (with the axe still equipped).
  await page.evaluate(() => window.__lastRites!.setSetting('showControlHints', false))
  await page.evaluate(() => window.__lastRites!.setSetting('showControlHints', true))
  await expect(panel).toBeVisible()
  expect(await lineIds(page)).toEqual(['move', 'sprint', 'charge'])
  await page.evaluate(() => window.__lastRites!.setSetting('showControlHints', false))
  await expect(panel).toHaveCount(0)
})

test('the panel is hidden in menus, the big map and the workbench view', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await startRun(page)
  await expect(page.locator('.control-hints')).toBeVisible()
  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toBeVisible()
  await expect(page.locator('.control-hints')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.control-hints')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator('.control-hints')).toHaveCount(0)
})

for (const size of SIZES) {
  test(`no overlap: panel vs health, oil, hotbar and compass labels at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(size)
    await startRun(page)
    // Hut straight ahead (north), and the objective (page 1, inside the hut) points at its door:
    // the same direction, which used to draw "Door · N m" over "Hut".
    await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
    await page.evaluate(() => window.__lastRites!.give('wood-axe', 1, 1))
    await page.evaluate(() => window.__lastRites!.equip(1))
    await page.waitForTimeout(1200)

    const panel = (await boxOf(page.locator('.control-hints')))!
    expect(panel).not.toBeNull()
    for (const sel of ['.health-bar', '.lantern-gauge', '.hotbar', '.hud-stamina', '.hud-subtitles']) {
      const other = await boxOf(page.locator(sel))
      if (other && other.width > 0) expect(hits(panel, other), `${sel} overlaps the panel`).toBe(false)
    }
    // Inside the viewport, with every line's text inside the panel.
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.width).toBeLessThanOrEqual(size.width)
    const overflow = await page.locator('.control-hints__line').evaluateAll((els) =>
      els.some((e) => {
        const p = e.parentElement!.getBoundingClientRect()
        const r = e.getBoundingClientRect()
        return r.right > p.right + 1 || r.left < p.left - 1
      }),
    )
    expect(overflow).toBe(false)

    const markers = page.locator('.compass__marker:not([hidden])')
    const n = await markers.count()
    const boxes: { id: string; box: Box }[] = []
    for (let i = 0; i < n; i++) {
      const b = await markers.nth(i).boundingBox()
      const cls = (await markers.nth(i).getAttribute('class')) ?? ''
      if (b) boxes.push({ id: cls, box: b })
    }
    expect(boxes.length).toBeGreaterThanOrEqual(3) // chapel, hut and the objective
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(hits(boxes[i]!.box, boxes[j]!.box), `${boxes[i]!.id} overlaps ${boxes[j]!.id}`).toBe(false)

    await page.screenshot({ path: `${SHOTS}/control-hints-hut-objective-${size.width}x${size.height}.png` })
  })
}
