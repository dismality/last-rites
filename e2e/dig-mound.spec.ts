import { test, expect } from '@playwright/test'

// Task 12.3: by day with the lantern off, a grave mound still shows its rune and a clear prompt
// when the player faces it, and the prompt says a shovel is needed when none is in hand.
test('mound rune and dig prompt show by day with the lantern off', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.startRun('normal')
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.2,
    undefined,
    { timeout: 90_000 },
  )

  // Day, lantern off, standing south of the first mound and looking north (-Z) at it.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setLantern(false)
    h.teleport(-15, 14.5, { yaw: 0, pitch: -0.3 })
  })

  await page.waitForFunction(() => (window.__lastRites!.runeCues()?.visibleRunes ?? 0) > 0, undefined, {
    timeout: 30_000,
  })

  // Shovel in hand (the starting kit): a plain "Hold E: Dig" prompt with no warning note.
  const prompt = page.locator('.hud-prompt')
  await expect(prompt).toContainText('Dig', { timeout: 30_000 })
  await expect(prompt).not.toContainText('shovel')

  // Bandage in hand instead: the prompt names the shovel and its hotbar key.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('bandage', 1, 1)
    h.equip(1)
  })
  await expect(prompt).toContainText('Needs a shovel in hand: press 1')
  await expect(prompt).not.toContainText('Hold')
})
