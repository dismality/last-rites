import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 11o: the clue highlight hugs the clue (inverted hull, fades in within about 4 m),
// and the tutorial hint on the objective tracker's second line says where to go when the player
// is away from the object, and the key and action when near.

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

async function stand(page: Page, x: number, z: number, look?: [number, number, number]): Promise<void> {
  await page.evaluate(
    (s) => {
      const h = window.__lastRites!
      if (!s.look) return h.teleport(s.x, s.z)
      const eye = h.body()?.camera ?? [s.x, 1.6, s.z]
      const yaw = Math.atan2(-(s.look[0] - s.x), -(s.look[2] - s.z))
      const pitch = Math.atan2(s.look[1] - eye[1], Math.hypot(s.look[0] - s.x, s.look[2] - s.z))
      h.teleport(s.x, s.z, { yaw, pitch })
    },
    { x, z, look },
  )
  await page.waitForFunction(
    (s) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - s.x, b.feet[2] - s.z) < 0.3
    },
    { x, z },
  )
}

const outlines = (page: Page) =>
  page.evaluate(() => window.__lastRites!.runeCues()?.outlines ?? -1)

test.describe('objective hint and clue outline', () => {
  test.setTimeout(300_000)

  test('a clue spot shows a hugging outline near and none far', async ({ page }) => {
    await boot(page)
    // The burial notice: an upright parchment board at (7.6, 0.9, -4).
    await stand(page, 7.6, -2, [7.6, 0.9, -4])
    await page.waitForFunction(() => (window.__lastRites!.runeCues()?.outlines ?? 0) > 0, undefined, {
      timeout: 30_000,
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/clue-outline-near-1280x720.png' })

    await stand(page, 7.6, 12, [7.6, 0.9, -4])
    await page.waitForFunction(() => (window.__lastRites!.runeCues()?.outlines ?? 1) === 0, undefined, {
      timeout: 30_000,
    })
    expect(await outlines(page)).toBe(0)
    await page.screenshot({ path: 'e2e/screenshots/clue-outline-far-1280x720.png' })
  })

  test('the first-day hint says where to go away from the oil, and the key near it', async ({ page }) => {
    await boot(page)
    const second = page.locator('.hud-objective__second')
    // Step 1 (walk 3 m) comes first; walk it for real, then teleport to the table.
    await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
    await expect(second).not.toContainText('to move', { timeout: 60_000 })
    await page.evaluate(() => window.__lastRites!.release('MoveForward'))
    await stand(page, 0.9, -1)
    await expect(second).toContainText('E to pick up the oil')
    // Far away on the grounds.
    await stand(page, -20, 14)
    await expect(second).toContainText('Go to the hut')
    // One metre outside the door is closer than 6 m but a different building: still far.
    await stand(page, 0, 4)
    await expect(second).toContainText('Go to the hut')
    // Back at the table.
    await stand(page, 0.9, -1)
    await expect(second).toContainText('E to pick up the oil')
  })
})
