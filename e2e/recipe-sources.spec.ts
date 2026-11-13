import { test, expect, type Page } from '@playwright/test'
// Spec 09 task 11m: an unknown recipe says where its missing ingredients are found, "Mark on map"
// drops a real pin, and the bench piles are the item models. Real keyboard and mouse.
const SHOTS = 'e2e/screenshots'

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

async function openBench(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(() => window.__lastRites!.teleport(0, -0.9, { yaw: 0, pitch: -0.65 }))
    await page.waitForFunction(
      () => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'workbench',
      undefined,
      { timeout: 20_000 },
    )
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    const open = await page.evaluate(
      () => (window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen,
    )
    if (open) return
  }
  throw new Error('the workbench did not open')
}

test('an unknown recipe says where to look, Mark on map pins it, and the bench shows the models', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await startRun(page)
  // One cloth held: Bandage is known and short by one; Bone Club has never seen a bone.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.keepAlive(true)
    h.give('cloth', 1)
  })
  await openBench(page)
  await page.waitForTimeout(800)

  const unknown = page.locator('.recipe-entry--unknown').first()
  await expect(unknown).toBeVisible()
  // The ingredient stays unnamed but says where it comes from.
  const unknownRow = unknown.locator('.ingredient-name--unknown').first()
  await expect(unknownRow).toContainText('???')
  await expect(unknownRow).toContainText('grave mounds')
  await expect(unknown).not.toContainText(/Bone 0\/3/)

  // A known recipe with a shortfall shows "Found: …" under the count.
  const bandage = page.locator('.recipe-entry', { hasText: 'Bandage' }).first()
  await expect(bandage).toContainText('Cloth 1/2')
  await expect(bandage.locator('.ingredient-found').first()).toContainText(/^Found: /)

  // Focus shows the tooltip with the plain-words summary.
  await unknown.focus()
  const tip = page.getByRole('tooltip')
  await expect(tip).toContainText('Needs 2 ingredients')
  await expect(tip).toContainText('You have: Cloth')
  await expect(tip).toContainText('Still to find: something')
  await page.screenshot({ path: `${SHOTS}/recipe-sources-unknown-1280x720.png` })

  // M on the focused row drops a pin through the real pin store.
  expect((await page.evaluate(() => window.__lastRites!.mapPins())).pins).toHaveLength(0)
  await page.keyboard.press('KeyM')
  await expect.poll(async () => (await page.evaluate(() => window.__lastRites!.mapPins())).pins.length).toBe(1)
  const pin = (await page.evaluate(() => window.__lastRites!.mapPins())).pins[0]
  expect(pin.name).toMatch(/grave mounds|coffins|hut shelf|catacomb/i)
  await expect(page.locator('.compass__marker--pin').first()).toBeVisible()
  await expect(unknown.locator('.recipe-entry__mark-note')).toContainText('Pinned')

  // The button does the same (a second pin).
  await unknown.getByRole('button', { name: /Mark the nearest source/ }).click()
  await expect.poll(async () => (await page.evaluate(() => window.__lastRites!.mapPins())).pins.length).toBe(2)

  // The same card at 800x600 stays inside the book.
  await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(500)
  await unknown.focus()
  await page.screenshot({ path: `${SHOTS}/recipe-sources-unknown-800x600.png` })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(500)

  // Bench stock: the piles are models. Fill the satchel with a few materials and shoot both sizes.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('bone', 6)
    h.give('cloth', 3)
    h.give('iron-nail', 5)
    h.give('lamp-oil', 2)
    h.give('candle-wax', 2)
    h.give('holy-water', 1)
  })
  await page.locator('.recipe-entry', { hasText: 'Bone Club' }).first().hover()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOTS}/bench-models-1280x720.png` })
  await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOTS}/bench-models-800x600.png` })
  // Cards still fit at 800x600: no row text wider than the recipe book.
  const overflow = await page.evaluate(() => {
    const book = document.querySelector('.recipe-book__inner') as HTMLElement | null
    return book ? book.scrollWidth - book.clientWidth : -1
  })
  expect(overflow).toBeLessThanOrEqual(1)
})
