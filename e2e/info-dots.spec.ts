import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 5.5 (Req 5.2, 5.4, 5.5, 5.9, 5.10, 8.21): the info dots. Hover and Tab to each dot
// in the journal and the HUD, the tooltip stays inside the viewport at 800x600 with Plain font
// for journal on, Esc closes the tooltip without pausing and a second Esc pauses, and turning
// "Show info dots" off removes every dot and skips them in Tab order. Screenshots at 1280x720 and
// 800x600 in e2e/screenshots/info-dots/.

const DIR = 'e2e/screenshots/info-dots'
const TABS = ['Pages', 'Clues', 'Case board', 'Closed cases', 'Relics', 'Contracts', 'Map']

async function startRun(page: Page): Promise<void> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, {
    timeout: 30_000,
  })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
}

async function shoot(page: Page, name: string): Promise<void> {
  const keep = page.viewportSize()!
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/${name}-${size.width}x${size.height}.png` })
  }
  await page.setViewportSize(keep)
}

/** The open tooltip, checked to lie fully inside the viewport. */
async function expectTipInside(page: Page): Promise<void> {
  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  // The tooltip is placed in a layout effect and hidden until then.
  await expect(tip).toHaveCSS('visibility', 'visible')
  const box = (await tip.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
}

const paused = (page: Page) => page.getByRole('dialog', { name: 'Paused' })

test('journal dots open on hover and Tab with the tooltip inside an 800x600 viewport, Plain font on', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.setSetting('plainJournalFont', true))
  await page.setViewportSize({ width: 800, height: 600 })
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.evaluate(() => window.__lastRites!.lockless(false))

  for (const label of TABS) {
    const tab = page.getByRole('tab', { name: label, exact: true })
    await tab.click()
    const dot = page.locator('.journal-tabs-row .info-dot')
    await expect(dot).toHaveCount(1)

    // Hover.
    await dot.hover()
    await expectTipInside(page)
    await page.mouse.move(2, 2)
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    // Tab from the selected tab: the dot is the next stop and opens its tooltip.
    await tab.focus()
    await page.keyboard.press('Tab')
    await expect(dot).toBeFocused()
    await expectTipInside(page)
    await expect(dot).toHaveAttribute('aria-describedby', /.+/)
    if (label === 'Pages') await shoot(page, 'journal-pages-tooltip')
    if (label === 'Case board') await shoot(page, 'journal-case-tooltip')
    await dot.evaluate((el) => (el as HTMLElement).blur())
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  }

  // Esc closes an open tooltip and does not pause.
  const dot = page.locator('.journal-tabs-row .info-dot')
  await dot.focus()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(paused(page)).toBeHidden()
})

test('HUD dots open on hover and Tab, Esc closes the tooltip first and then pauses', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.setSetting('plainJournalFont', true))
  await page.setViewportSize({ width: 800, height: 600 })

  // Spend some stamina so its bar (and dot) shows.
  await page.evaluate(() => {
    window.__lastRites!.hold('MoveForward')
    window.__lastRites!.hold('Sprint')
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    window.__lastRites!.release('Sprint')
    window.__lastRites!.release('MoveForward')
  })

  const oil = page.getByRole('button', { name: 'About lantern oil' })
  await oil.hover()
  await expectTipInside(page)
  // Clear of the health bar, oil gauge and hint panel.
  const tipBox = (await page.getByRole('tooltip').boundingBox())!
  for (const el of await page.locator('.hud-corner > *').all()) {
    const b = await el.boundingBox()
    if (!b) continue
    const apart =
      tipBox.x + tipBox.width <= b.x ||
      b.x + b.width <= tipBox.x ||
      tipBox.y + tipBox.height <= b.y ||
      b.y + b.height <= tipBox.y
    expect(apart).toBe(true)
  }
  await shoot(page, 'hud-oil-tooltip')

  const stamina = page.getByRole('button', { name: 'About stamina' })
  await stamina.hover()
  await expectTipInside(page)
  await page.mouse.move(400, 300)

  // While playing, Tab belongs to the satchel, so a HUD dot takes keyboard focus directly.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await oil.focus()
  await expectTipInside(page)

  // First Esc closes the tooltip and does not pause; the second pauses.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(paused(page)).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(paused(page)).toBeVisible()
})

test('Show info dots off removes every dot and skips them in Tab order', async ({ page }) => {
  test.setTimeout(180_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.lockless(false))
  expect(await page.locator('.info-dot').count()).toBeGreaterThan(0)

  await page.evaluate(() => window.__lastRites!.setSetting('showInfoDots', false))
  await expect(page.locator('.info-dot')).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await expect(page.locator('.info-dot')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Pages' }).focus()
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains('info-dot') ?? false),
    ).toBe(false)
  }

  // Back on: the dots return.
  await page.evaluate(() => window.__lastRites!.setSetting('showInfoDots', true))
  await expect(page.locator('.journal-tabs-row .info-dot')).toHaveCount(1)
})

test('the satchel dot opens on focus', async ({ page }) => {
  test.setTimeout(180_000)
  await startRun(page)
  await page.setViewportSize({ width: 800, height: 600 })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toBeVisible()
  await page.evaluate(() => window.__lastRites!.lockless(false))
  // Tab closes the satchel, so its dot takes focus directly.
  const dot = page.getByRole('button', { name: 'About the satchel' })
  await dot.focus()
  await expectTipInside(page)
  await shoot(page, 'satchel-tooltip')
})
