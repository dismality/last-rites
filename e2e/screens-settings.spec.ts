import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 24.9 (D9): every menu at three sizes. Buttons are reachable (in the viewport or by
// scrolling the panel), keyboard Tab shows a visible focus ring, settings keep their defaults and
// persist, rebinding works, Esc pauses, and reduced motion changes the first-run defaults.

const SIZES = [
  { width: 800, height: 600 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]
const SETTINGS_KEY = 'last-rites-settings'

async function boot(page: Page, size = SIZES[1]): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize(size)
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  return errors
}

async function toTitle(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.setScreen('title'))
  await expect(page.getByRole('heading', { name: 'Last Rites' })).toBeVisible()
}

async function startRun(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
}

/** Every button of the open dialog can be scrolled into view and ends inside the viewport. */
async function expectButtonsReachable(page: Page, label: string): Promise<void> {
  const dialog = page.getByRole('dialog').last()
  const buttons = dialog.getByRole('button')
  const n = await buttons.count()
  expect(n, `${label} has buttons`).toBeGreaterThan(0)
  const vp = page.viewportSize()!
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i)
    await b.scrollIntoViewIfNeeded()
    const box = await b.boundingBox()
    expect(box, `${label} button ${i}`).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width)
  }
}

/** Tabs through a dialog: every stop shows an outline, and focus never leaves the dialog. */
async function expectVisibleFocus(page: Page, label: string, stops = 6): Promise<void> {
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      const cs = getComputedStyle(el)
      const style = el.closest('[role="dialog"]') ? cs.outlineStyle : 'outside'
      return { style, width: parseFloat(cs.outlineWidth), tag: el.tagName, text: el.textContent?.slice(0, 20) }
    })
    expect(r, `${label} stop ${i}`).not.toBeNull()
    expect(r!.style, `${label} stop ${i} stays in the dialog`).not.toBe('outside')
    if (r!.tag === 'INPUT' || r!.tag === 'BUTTON' || r!.tag === 'SELECT') {
      expect(r!.style, `${label} outline on ${r!.tag} ${r!.text}`).not.toBe('none')
      expect(r!.width).toBeGreaterThanOrEqual(2)
    }
  }
}

for (const size of SIZES) {
  test(`content warning, title, settings, credits at ${size.width}x${size.height}`, async ({ page }) => {
    const errors = await boot(page, size)
    // The game opens on the content warning.
    await page.evaluate(() => window.__lastRites!.setScreen('title'))
    await page.evaluate(() => {
      localStorage.removeItem('last-rites-settings')
    })
    await page.reload()
    await page.waitForFunction(() => window.__lastRites !== undefined)
    const warning = page.getByRole('dialog', { name: 'Content Warning' })
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Jumpscares')
    await expect(warning).toContainText('Flashing lights')
    await expectButtonsReachable(page, 'content warning')
    await expectVisibleFocus(page, 'content warning', 3)
    await page.screenshot({ path: `e2e/screenshots/screens-warning-${size.width}x${size.height}.png` })

    // Its Settings link opens settings, and Back returns to the warning.
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(warning).toBeVisible()

    await toTitle(page)
    await expectButtonsReachable(page, 'title')
    await expectVisibleFocus(page, 'title', 6)
    await page.screenshot({ path: `e2e/screenshots/screens-title-${size.width}x${size.height}.png` })

    await page.getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await expectButtonsReachable(page, 'settings')
    await page.screenshot({ path: `e2e/screenshots/screens-settings-${size.width}x${size.height}.png` })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Credits' }).click()
    await expect(page.getByRole('dialog', { name: 'Credits' })).toBeVisible()
    await expectButtonsReachable(page, 'credits')
    await page.screenshot({ path: `e2e/screenshots/screens-credits-${size.width}x${size.height}.png` })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Achievements' }).click()
    await expect(page.getByRole('dialog', { name: /Achievements/ })).toBeVisible()
    await expectButtonsReachable(page, 'achievements')
    await page.screenshot({ path: `e2e/screenshots/screens-achievements-${size.width}x${size.height}.png` })
    expect(errors).toEqual([])
  })
}

test('settings show the documented defaults, save on change and keep them after a reload', async ({ page }) => {
  await boot(page)
  await page.evaluate((k) => localStorage.removeItem(k), SETTINGS_KEY)
  await page.reload()
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await toTitle(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByLabel('Scare intensity')).toHaveValue('full')
  await expect(dialog.getByLabel('Flashing lights')).toBeChecked()
  await expect(dialog.getByLabel('Camera shake')).toBeChecked()
  await expect(dialog.getByLabel('Head bob')).toBeChecked()
  await expect(dialog.getByLabel('Invert Y')).not.toBeChecked()
  await expect(dialog.getByLabel('Subtitles')).toBeChecked()
  await expect(dialog.getByLabel('Accessible HUD')).not.toBeChecked()
  await expect(dialog.getByLabel('Tutorial prompts')).toBeChecked()
  await expect(dialog.getByLabel('Damage numbers')).toBeChecked()
  await expect(dialog.getByLabel('Field of view')).toHaveValue('75')
  await expect(dialog.getByLabel('Mouse sensitivity')).toHaveValue('1')
  await expect(dialog.getByLabel('Master volume')).toHaveValue('80')
  await expect(dialog.getByLabel('Music volume')).toHaveValue('60')
  await expect(dialog.getByLabel('Sound effects volume')).toHaveValue('80')
  await expect(dialog.getByLabel('Ambience volume (wind, rain, crows)')).toHaveValue('80')
  await expect(dialog.getByLabel('Voice volume (narration)')).toHaveValue('90')
  await expect(dialog.getByLabel('Strange noises volume (0 turns them off)')).toHaveValue('60')
  await expect(dialog.getByLabel('Brightness (gamma)')).toHaveValue('1')

  await dialog.getByLabel('Scare intensity').selectOption('reduced')
  await dialog.getByLabel('Invert Y').check()
  await dialog.getByLabel('Field of view').fill('90')
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), SETTINGS_KEY)
  expect(saved).toMatchObject({ scareIntensity: 'reduced', invertY: true, fov: 90 })

  await page.reload()
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await toTitle(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const again = page.getByRole('dialog', { name: 'Settings' })
  await expect(again.getByLabel('Scare intensity')).toHaveValue('reduced')
  await expect(again.getByLabel('Invert Y')).toBeChecked()
  await expect(again.getByLabel('Field of view')).toHaveValue('90')
})

test('rebinding takes a key, refuses a conflict and Esc', async ({ page }) => {
  await boot(page)
  await page.evaluate((k) => localStorage.removeItem(k), SETTINGS_KEY)
  await toTitle(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const bind = (name: RegExp) => page.getByRole('button', { name })
  await bind(/^Interact.*Activate to rebind/).click()
  await page.keyboard.press('KeyG')
  await expect(bind(/^Interact: G\./)).toBeVisible()
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), SETTINGS_KEY)
  expect(saved.bindings.Interact).toBe('KeyG')

  // A key already in use changes nothing and says so.
  await bind(/^Interact.*Activate to rebind/).click()
  await page.keyboard.press('KeyW')
  await expect(page.getByRole('alert').filter({ hasText: 'already bound' })).toBeVisible()
  await expect(bind(/^Interact: G\./)).toBeVisible()

  // Esc cancels the capture and the dialog stays open.
  await bind(/^Interact.*Activate to rebind/).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await expect(bind(/^Interact: G\./)).toBeVisible()
})

test('first-run defaults follow prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.evaluate((k) => localStorage.removeItem(k), SETTINGS_KEY)
  await page.reload()
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await toTitle(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByLabel('Camera shake')).not.toBeChecked()
  await expect(dialog.getByLabel('Head bob')).not.toBeChecked()
})

for (const size of SIZES) {
  test(`mode select, pause, satchel, journal, death at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(400_000)
    const errors = await boot(page, size)
    await toTitle(page)
    await page.getByRole('button', { name: 'New Game' }).click()
    const mode = page.getByRole('dialog')
    await expect(mode).toBeVisible()
    await expectButtonsReachable(page, 'mode select')
    await expectVisibleFocus(page, 'mode select', 4)
    await page.screenshot({ path: `e2e/screenshots/screens-mode-${size.width}x${size.height}.png` })
    await page.getByRole('button', { name: 'Back' }).click()

    await startRun(page)

    // Esc pauses at any time, and Esc again resumes.
    await page.keyboard.press('Escape')
    const pause = page.getByRole('dialog', { name: 'Paused' })
    await expect(pause).toBeVisible()
    await expectButtonsReachable(page, 'pause')
    await expectVisibleFocus(page, 'pause', 4)
    await page.screenshot({ path: `e2e/screenshots/screens-pause-${size.width}x${size.height}.png` })
    await page.getByRole('button', { name: 'Settings' }).click()
    await expectButtonsReachable(page, 'pause settings')
    await page.keyboard.press('Escape')
    await expect(pause).toBeVisible()
    await page.getByRole('button', { name: 'Quit to Title' }).click()
    await expect(page.getByRole('heading', { name: 'Quit to Title?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stay' })).toBeFocused()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(pause).toHaveCount(0)

    // Satchel on Tab, journal on J; both close with the same key.
    await page.keyboard.press('Tab')
    await expect(page.locator('.satchel__cell').first()).toBeVisible()
    await page.screenshot({ path: `e2e/screenshots/screens-satchel-${size.width}x${size.height}.png` })
    await page.keyboard.press('Tab')
    await expect(page.locator('.satchel__cell')).toHaveCount(0)

    await page.keyboard.press('KeyJ')
    const journal = page.getByRole('dialog', { name: 'Journal' })
    await expect(journal).toBeVisible()
    const tabs = journal.getByRole('tab')
    const count = await tabs.count()
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click()
      // Software GL makes each 1080p capture take about a minute, so large sizes shoot one tab only.
      if (size.width < 1920 || i === 0) {
        await page.screenshot({ path: `e2e/screenshots/screens-journal-${i}-${size.width}x${size.height}.png` })
      }
    }
    await page.keyboard.press('Escape')
    await expect(journal).toHaveCount(0)

    // Death screen: Retry Night and Quit are reachable, and Esc does not dismiss it.
    await page.evaluate(() => window.__lastRites!.keepAlive(false))
    await page.evaluate(() => window.__lastRites!.hurt(10_000))
    const taken = page.getByRole('dialog', { name: /taken/i })
    await expect(taken).toBeVisible({ timeout: 30_000 })
    await expectButtonsReachable(page, 'death')
    await page.keyboard.press('Escape')
    await expect(taken).toBeVisible()
    await page.screenshot({ path: `e2e/screenshots/screens-death-${size.width}x${size.height}.png` })
    expect(errors).toEqual([])
  })
}

test('ending screen can be skipped with Space and reached by keyboard', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = await boot(page)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.startEnding('rest'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('game') as { screen: string }).screen === 'ending',
    undefined,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(1500)
  await page.keyboard.press('Space')
  await expect(page.locator('.ending__stat').first()).toBeVisible({ timeout: 30_000 })
  await expectButtonsReachable(page, 'ending')
  await page.screenshot({ path: 'e2e/screenshots/screens-ending-1366x768.png' })
  expect(errors).toEqual([])
})
