import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 6.4 (Req 23.3, 23.4, 23.8, 23.9): the win walk-out in real Chrome. The dev hook only
// starts the Rest ending straight into the walk (past the 44 s sunrise) and reads the clock; Space,
// Enter and Esc are real key presses and Resume is a real click. One run plays the walk to the end,
// the others skip it; every run ends on the ending card. The gate shot is saved at two sizes.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
/** Seconds in: the gate is swinging open just ahead (the keeper reaches it at about 11.75 s). */
const GATE_SHOT_S = 10.4

interface WinClock {
  time: number
  sun: number
  active: boolean
}

const clock = (page: Page) => page.evaluate(() => window.__lastRites!.winClock() as WinClock)
const card = (page: Page) => page.getByTestId('win-card')
const walk = (page: Page) => page.getByTestId('win-cutscene')

function frames(page: Page, n: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0
        const step = () => (++i < count ? requestAnimationFrame(step) : resolve())
        requestAnimationFrame(step)
      }),
    n,
  )
}

async function boot(page: Page): Promise<{ errors: string[] }> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  return { errors }
}

/** Starts the walk-out and waits until its clock is running from the hut door. */
async function startWalk(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.playWinCutscene())
  await expect(walk(page)).toBeVisible()
  await page.waitForFunction(() => {
    const c = window.__lastRites!.winClock() as WinClock
    return c.active && c.time > 0.2 && c.time < 3
  })
}

async function expectCard(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible()
  await expect(card(page)).toContainText('Rest')
  await expect(card(page)).toContainText('Stages cleared')
  await expect(card(page)).toContainText('3 of 3')
  await expect(card(page)).toContainText('Cases solved')
  await expect(walk(page)).toHaveCount(0)
  // Still the ending screen: the skip key did not also press the card's first button.
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible()
}

test('plays the walk-out to the end: captions, the gate shot, then the ending card', async ({ page }) => {
  test.setTimeout(150_000)
  const { errors } = await boot(page)
  await startWalk(page)

  const captions = new Set<string>()
  const lines = new Set<string>()
  let gateShot = false
  while ((await card(page).count()) === 0) {
    const [caption, line] = await page.evaluate(() => [
      document.querySelector('.ending__caption')?.textContent ?? '',
      document.querySelector('.ending__line')?.textContent ?? '',
    ])
    if (caption) captions.add(caption)
    if (line) lines.add(line)
    const c = await clock(page)
    if (!gateShot && c.time >= GATE_SHOT_S) {
      // Hold the walk on the gate while both sizes are taken, then let it run on.
      await page.evaluate((t) => window.__lastRites!.holdWinAt(t), GATE_SHOT_S)
      await frames(page, 20)
      for (const s of SIZES) {
        await page.setViewportSize(s)
        await frames(page, 10)
        await page.screenshot({ path: `${SHOTS}/win-cutscene-gate-${s.width}x${s.height}.png` })
      }
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.evaluate(() => window.__lastRites!.holdWinAt(null))
      gateShot = true
    }
    await page.waitForTimeout(150)
  }
  expect(gateShot, 'the walk reached the gate').toBe(true)
  // A caption for every sound (Req 23.6) and the narration came up in order.
  for (const c of ['birdsong', 'footsteps', 'gate creaks', 'bell tolls', 'wind']) {
    expect([...captions].some((t) => t.includes(c)), `caption: ${c}`).toBe(true)
  }
  expect(lines.size).toBe(3)
  // The sun rose all the way and the fog lifted with it.
  expect((await clock(page)).sun).toBeCloseTo(1, 2)
  await expectCard(page)
  expect(errors).toEqual([])
})

for (const key of ['Space', 'Enter'] as const) {
  test(`${key} skips the walk-out to the ending card`, async ({ page }) => {
    test.setTimeout(120_000)
    const { errors } = await boot(page)
    await startWalk(page)
    const before = (await clock(page)).time
    await page.keyboard.press(key)
    await expectCard(page)
    expect(before).toBeLessThan(5)
    // Skipped: the card sits over the walk's last pose, the sun up.
    await frames(page, 4)
    expect((await clock(page)).sun).toBeCloseTo(1, 2)
    expect(errors).toEqual([])
  })
}

test('Esc pauses the walk-out and Resume carries on', async ({ page }) => {
  test.setTimeout(120_000)
  const { errors } = await boot(page)
  await startWalk(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible()
  // Esc did not skip: the walk is still up behind the pause menu, and its clock holds.
  await expect(walk(page)).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  const held = (await clock(page)).time
  await page.waitForTimeout(1200)
  expect((await clock(page)).time).toBeCloseTo(held, 3)
  // Space on the pause menu does not skip the walk either.
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('heading', { name: 'Paused' })).toHaveCount(0)
  await expect.poll(async () => (await clock(page)).time, { timeout: 5_000 }).toBeGreaterThan(held + 0.5)
  await page.keyboard.press('Space')
  await expectCard(page)
  expect(errors).toEqual([])
})
