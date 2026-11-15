import { test, expect } from '@playwright/test'
// Spec 09 task 19 (B13): Begin and Back are visible on the difficulty screen at 800x600.
for (const size of [
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
]) {
  test(`mode select shows Begin and Back at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/')
    await page.waitForFunction(() => window.__lastRites !== undefined)
    await page.evaluate(() => window.__lastRites!.setScreen('title'))
    await page.getByRole('button', { name: 'New Game' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (const name of ['Begin', 'Back']) {
      const box = await page.getByRole('button', { name }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)
    }
    // Keyboard: Tab reaches Begin with a visible focus ring.
    // A radio group is one tab stop, so one Tab from the checked radio lands on Begin.
    await page.getByRole('radio', { checked: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused()
    await page.screenshot({ path: `e2e/screenshots/mode-select-${size.width}x${size.height}.png` })
  })
}
