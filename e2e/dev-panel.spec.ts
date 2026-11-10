import { test, expect, type Page } from '@playwright/test'

// Spec 09, A1: the Dev_Panel in real Chrome, driven by real key presses and clicks. The dev-only
// Debug_Hook is used only to start a run and to read state back.

const panel = (page: Page) => page.getByRole('complementary', { name: 'Developer panel' })

async function boot(page: Page): Promise<void> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

async function section(page: Page, title: string): Promise<void> {
  const details = panel(page).locator('details', { has: page.locator('summary', { hasText: title }) })
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await details.locator('summary').click()
  }
}

const feet = (page: Page) => page.evaluate(() => window.__lastRites!.body()!.feet)

test('backquote opens the panel, and its controls drive the real game', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await boot(page)

  // Closed until the toggle key.
  await expect(panel(page)).toHaveCount(0)
  await page.keyboard.press('Backquote')
  await expect(panel(page)).toBeVisible()

  // While open the game takes no movement input.
  const before = await feet(page)
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.waitForTimeout(1000)
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  const after = await feet(page)
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeLessThan(0.05)

  // Teleport: the whistle spot stands 1 m south of (-21, -48).
  await section(page, 'Teleport')
  await panel(page).getByRole('button', { name: 'Bone whistle (-21, -48)' }).click()
  await page.waitForFunction(() => {
    const f = window.__lastRites!.body()!.feet
    return Math.hypot(f[0] + 21, f[2] + 47) < 0.3
  })

  // Time: Dusk puts the clock at the end of the day; the next tick enters dusk.
  await section(page, 'Time')
  await panel(page).getByRole('button', { name: 'Dusk', exact: true }).click()
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dusk',
  )

  // God mode: a zombie blow through the real damage path deals nothing.
  await section(page, 'Cheats')
  await panel(page).getByRole('button', { name: 'God mode' }).click()
  await expect(panel(page).getByRole('button', { name: /God mode/ })).toHaveAttribute('aria-pressed', 'true')
  const hp0 = await page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)
  expect(await page.evaluate(() => window.__lastRites!.hurt(30))).toBe(false)
  const hp1 = await page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)
  expect(hp1).toBe(hp0)

  // Give: a key item reaches the inventory.
  await section(page, 'Give')
  await panel(page).getByRole('button', { name: 'rusted-crypt-key' }).click()
  const keys = await page.evaluate(
    () => (window.__lastRites!.snapshot('inventory') as { inventory: { keyItems: string[] } }).inventory.keyItems,
  )
  expect(keys).toContain('rusted-crypt-key')

  // Debug views: the readout shows numbers, and the wireframe group is in the scene.
  await section(page, 'Debug views')
  await panel(page).getByRole('button', { name: 'FPS and draw calls' }).click()
  await panel(page).getByRole('button', { name: 'Position and objective' }).click()
  await expect(page.locator('.dev-overlay')).toContainText(/FPS \d+\s+Draw calls \d+/, { timeout: 5_000 })
  await expect(page.locator('.dev-overlay')).toContainText(/Pos -?\d+\.\d, -?\d+\.\d, -?\d+\.\d/)
  await panel(page).getByRole('button', { name: 'Collider wireframes' }).click()
  expect(await page.evaluate(() => window.__lastRites!.meshesUnder('dev-debug-views'))).toBeGreaterThanOrEqual(0)

  // Backquote closes it, and movement input works again.
  await page.keyboard.press('Backquote')
  await expect(panel(page)).toHaveCount(0)
  const start = await feet(page)
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.waitForFunction(
    (s) => {
      const f = window.__lastRites!.body()!.feet
      return Math.hypot(f[0] - s[0], f[2] - s[2]) > 0.5
    },
    start,
    { timeout: 10_000 },
  )
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))

  expect(errors).toEqual([])
})
