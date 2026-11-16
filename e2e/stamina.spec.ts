import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 9.3 (Req 26.5-26.6): sprint with the real keys in two Stages and read the stamina
// bar: its cap as a number ("max 100", "max 90") and in its length (90 is nine tenths of the bar).
// The dev hook only moves the run to Stage 2 and reads state.

const SHOTS = 'e2e/screenshots'

const stamina = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('player') as { stamina: number }).stamina)

/** Sprints forward with Shift+W until the bar shows and stamina has dropped. */
async function sprint(page: Page): Promise<void> {
  const before = await stamina(page)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await expect.poll(() => stamina(page), { timeout: 10_000 }).toBeLessThan(before - 10)
  await expect(page.locator('.hud-stamina')).toHaveCSS('opacity', '1')
}

async function stop(page: Page): Promise<void> {
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
}

async function barWidth(page: Page): Promise<number> {
  return page.locator('.hud-stamina').evaluate((el) => el.getBoundingClientRect().width)
}

test('the stamina cap is 100 in Stage 1 and 90 in Stage 2, as a number and in the bar length', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )

  // Stage 1: the full bar, max 100.
  await sprint(page)
  const bar = page.locator('.hud-stamina')
  await expect(bar).toHaveAttribute('data-cap', '100')
  await expect(page.getByTestId('stamina-cap')).toHaveText('max 100')
  const full = await barWidth(page)
  await stop(page)

  // Stage 2: a full rest first, so stamina would sit at 100 without the cap.
  await page.evaluate(() => window.__lastRites!.skipToStage(2))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as { stage: number }).stage === 2, undefined, {
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'day',
    undefined,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1_500)
  expect(await stamina(page)).toBeLessThanOrEqual(90)
  await sprint(page)
  await expect(bar).toHaveAttribute('data-cap', '90')
  await expect(page.getByTestId('stamina-cap')).toHaveText('max 90')
  expect((await barWidth(page)) / full).toBeCloseTo(0.9, 2)
  await page.screenshot({ path: `${SHOTS}/stamina-stage2-1280x720.png` })
  await stop(page)
  expect(errors).toEqual([])
})
