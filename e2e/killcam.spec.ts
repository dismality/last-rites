import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 8.3 (Req 25.1-25.9, 29.1): the grab kill-cam in real Chrome, at each Scare intensity.
// "Trigger grab" (Dev_Panel) drops the keeper below 25% health and wakes a Lurker 2 m behind them;
// the Lurker's own AI then reaches the keeper and its blow goes through the real rules. The test
// asserts the camera, the subtitle, the edge and the 60 s cooldown.
// No keepAlive here: it puts health back to full, and the grab needs the keeper below 25%.

const SHOTS = 'e2e/screenshots'
const CAPTION = '[something seizes you]'

interface KillCam {
  count: number
  lastStartS: number | null
  now: number
  held: { enemy: string; pull: boolean; holdS: number; shake: boolean; closeUp: boolean; stinger: string | null } | null
  edge: string | null
  fov: number | null
}

const kc = (page: Page) => page.evaluate(() => window.__lastRites!.killCam() as KillCam)
const yaw = (page: Page) => page.evaluate(() => window.__lastRites!.body()!.yaw)
const health = (page: Page) => page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Face north (yaw 0) where the keeper stands: the Lurker then wakes on open ground to the south. */
async function faceNorth(page: Page): Promise<void> {
  const f = await page.evaluate(() => window.__lastRites!.body()!.feet)
  await page.evaluate(([x, z]) => window.__lastRites!.teleport(x, z, { yaw: 0, pitch: 0 }), [f[0], f[2]])
  await page.waitForFunction(() => Math.abs(window.__lastRites!.body()!.yaw) < 0.01)
}

async function boot(page: Page, settings: Record<string, unknown>): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  for (const [k, v] of Object.entries(settings)) {
    await page.evaluate(([key, val]) => window.__lastRites!.setSetting(key as never, val as never), [k, v] as const)
  }
  await faceNorth(page)
  return errors
}

/** The Dev_Panel's "Trigger grab", clicked for real. */
async function triggerGrab(page: Page): Promise<void> {
  const panel = page.getByRole('complementary', { name: 'Developer panel' })
  await page.keyboard.press('Backquote')
  await expect(panel).toBeVisible()
  const details = panel.locator('details', { has: page.locator('summary', { hasText: 'Progress' }) })
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator('summary').click()
  await panel.getByRole('button', { name: 'Trigger grab' }).click()
  await page.keyboard.press('Backquote')
  await expect(panel).toHaveCount(0)
}

/** After a grab: no second kill-cam inside 60 s, however weak the keeper (Req 25.2). */
async function assertCooldown(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.killAll())
  await page.evaluate(() => window.__lastRites!.setHealth(24))
  await faceNorth(page)
  const before = await kc(page)
  await page.evaluate(() => window.__lastRites!.triggerGrab())
  // The new Lurker lands its blow as a normal hit: the health drops, the count does not.
  await expect.poll(() => health(page), { timeout: 15_000 }).toBeLessThan(24)
  const after = await kc(page)
  expect(after.count).toBe(before.count)
  expect(after.held).toBeNull()
  expect(after.now - (after.lastStartS ?? 0)).toBeLessThan(60)
}

test('Full: the camera is pulled to the Lurker for 1.2 s with shake, then the blow lands', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await boot(page, { scareIntensity: 'full', flashingLights: true, cameraShake: true, subtitles: true })
  const baseFov = (await kc(page)).fov!
  await triggerGrab(page)
  await expect.poll(async () => (await kc(page)).held, { timeout: 15_000 }).not.toBeNull()
  const k = await kc(page)
  expect(k.held).toMatchObject({ enemy: 'lurker', pull: true, holdS: 1.2, shake: true, stinger: 'grab-stinger' })
  // The camera turns to face the Lurker behind (south, yaw PI) and closes in.
  await expect.poll(async () => Math.abs(wrap((await yaw(page)) - Math.PI)), { timeout: 2_000 }).toBeLessThan(0.6)
  expect((await kc(page)).fov!).toBeLessThan(baseFov)
  await expect(page.locator('.hud-subtitles')).toContainText(CAPTION)
  await expect(page.getByTestId('grab-edge')).toHaveAttribute('data-edge', 'flash')
  await page.screenshot({ path: `${SHOTS}/killcam-full.png` })
  // The blow lands on release: 24 - 20.
  expect(await health(page)).toBe(24)
  await expect.poll(async () => (await kc(page)).held, { timeout: 5_000 }).toBeNull()
  expect(await health(page)).toBe(4)
  // Released facing what seized them; the view widens again.
  expect(Math.abs(wrap((await yaw(page)) - Math.PI))).toBeLessThan(0.6)
  await expect.poll(async () => (await kc(page)).fov!).toBeCloseTo(baseFov, 1)
  await assertCooldown(page)
  expect(errors).toEqual([])
})

test('Reduced: a shorter pull, no shake', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await boot(page, { scareIntensity: 'reduced', flashingLights: true, cameraShake: true, subtitles: true })
  await page.evaluate(() => window.__lastRites!.triggerGrab())
  await expect.poll(async () => (await kc(page)).held, { timeout: 15_000 }).not.toBeNull()
  expect((await kc(page)).held).toMatchObject({ pull: true, holdS: 0.7, shake: false, stinger: 'grab-stinger-soft' })
  await expect.poll(async () => Math.abs(wrap((await yaw(page)) - Math.PI)), { timeout: 2_000 }).toBeLessThan(0.6)
  await expect(page.locator('.hud-subtitles')).toContainText(CAPTION)
  await expect.poll(async () => (await kc(page)).held, { timeout: 5_000 }).toBeNull()
  expect(await health(page)).toBe(4)
  await assertCooldown(page)
  expect(errors).toEqual([])
})

test('Off: the camera never moves; a red edge and the subtitle, even with Subtitles off', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await boot(page, { scareIntensity: 'off', flashingLights: true, cameraShake: true, subtitles: false })
  await page.evaluate(() => window.__lastRites!.triggerGrab())
  await expect.poll(async () => (await kc(page)).count, { timeout: 15_000 }).toBe(1)
  const k = await kc(page)
  expect(k.held).toBeNull()
  expect(Math.abs(wrap(await yaw(page)))).toBeLessThan(0.01)
  await expect(page.getByTestId('grab-edge')).toHaveAttribute('data-edge', 'flash')
  await expect(page.locator('.hud-subtitles')).toContainText(CAPTION)
  await page.screenshot({ path: `${SHOTS}/killcam-off.png` })
  // The blow lands at once.
  expect(await health(page)).toBe(4)
  await assertCooldown(page)
  expect(errors).toEqual([])
})

test('Flashing lights off: a steady edge instead of the pulse', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await boot(page, { scareIntensity: 'full', flashingLights: false, cameraShake: false, subtitles: true })
  await page.evaluate(() => window.__lastRites!.triggerGrab())
  await expect.poll(async () => (await kc(page)).held, { timeout: 15_000 }).not.toBeNull()
  expect((await kc(page)).held).toMatchObject({ pull: true, shake: false })
  await expect(page.getByTestId('grab-edge')).toHaveAttribute('data-edge', 'steady')
  // Steady: sampled over 0.3 s, the opacity never rises (no pulse).
  const samples = await page.evaluate(async () => {
    const out: number[] = []
    for (let i = 0; i < 12; i++) {
      const el = document.querySelector<HTMLElement>('[data-testid="grab-edge"]')
      out.push(el ? Number(el.style.opacity) : 0)
      await new Promise((r) => setTimeout(r, 25))
    }
    return out
  })
  for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9)
  await page.screenshot({ path: `${SHOTS}/killcam-steady-edge.png` })
  expect(errors).toEqual([])
})
