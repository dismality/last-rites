import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 11l: the big map on M with up to three clickable pins. Real mouse and keyboard.
// Headless Chrome, so frame times are not meaningful here; only behaviour is checked.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]

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

const pinsOf = (page: Page) => page.evaluate(() => window.__lastRites!.mapPins())

/** Distance in metres the first compass pin marker shows ("① 23 m"), or null with none. */
async function compassPinMetres(page: Page, slot = 1): Promise<number | null> {
  const el = page.locator('.compass__marker--pin').nth(slot - 1)
  if ((await el.count()) === 0) return null
  const text = (await el.textContent()) ?? ''
  const m = /(\d+)\s*m/.exec(text)
  return m ? Number(m[1]) : null
}

test('M opens the big map; a click drops a pin that shows on the compass, minimap and world and clears on arrival', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await page.waitForTimeout(600)

  await page.keyboard.press('KeyM')
  const map = page.locator('.bigmap')
  await expect(map).toBeVisible()
  expect((await pinsOf(page)).mapOpen).toBe(true)
  // Opening the map shows the pause-like freeze, not the pause menu.
  await expect(page.getByRole('dialog', { name: /paused/i })).toHaveCount(0)

  // A wheel turn zooms; then click a spot straight above the player (north).
  const box = (await page.locator('.bigmap__canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -200)
  await page.waitForTimeout(150)
  await page.mouse.click(cx, cy - 200)
  await expect.poll(async () => (await pinsOf(page)).pins.length).toBe(1)
  const pin = (await pinsOf(page)).pins[0]
  expect(pin.slot).toBe(1)
  expect(Math.abs(pin.x)).toBeLessThan(6) // straight north of the player at x = 0
  expect(pin.z).toBeLessThan(24 - 7)
  await page.screenshot({ path: `${SHOTS}/big-map-pin-placed-1280x720.png` })

  // Esc closes the map (and does not pause).
  await page.keyboard.press('Escape')
  await expect(map).toHaveCount(0)
  expect((await pinsOf(page)).mapOpen).toBe(false)
  await expect(page.getByRole('dialog', { name: /paused/i })).toHaveCount(0)

  // Compass: "① N m". Minimap: the label names the pin. World: one beacon.
  await expect.poll(() => compassPinMetres(page)).not.toBeNull()
  const marker = (await page.locator('.compass__marker--pin').first().textContent()) ?? ''
  expect(marker).toContain('①')
  await expect(page.locator('.minimap__canvas')).toHaveAttribute('aria-label', /Pin 1 \d+ metres/)
  expect((await pinsOf(page)).beacons).toBe(1)
  await page.evaluate(() => window.__lastRites!.setSetting('showPinsInWorld', false))
  await expect.poll(async () => (await pinsOf(page)).beacons).toBe(0)
  await page.evaluate(() => window.__lastRites!.setSetting('showPinsInWorld', true))
  await expect.poll(async () => (await pinsOf(page)).beacons).toBe(1)
  await page.screenshot({ path: `${SHOTS}/big-map-pin-hud-1280x720.png` })

  // Walking toward it: the compass distance drops.
  const d0 = (await compassPinMetres(page))!
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  // Frame rate varies with machine load, so wait for the drop instead of timing the walk.
  await expect
    .poll(async () => (await compassPinMetres(page)) ?? 0, { timeout: 8000, intervals: [250] })
    .toBeLessThan(d0)
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  await page.waitForTimeout(300)
  expect(await compassPinMetres(page)).not.toBeNull()

  // Arriving within 2 m clears it, with the caption.
  await page.evaluate(({ x, z }) => window.__lastRites!.teleport(x, z + 1.5, { yaw: 0 }), pin)
  await expect.poll(async () => (await pinsOf(page)).pins.length).toBe(0)
  await expect(page.getByText('[pin reached]')).toBeVisible()
  await expect.poll(() => compassPinMetres(page)).toBeNull()
})

test('M and N work from the keyboard alone: place, select, remove, minimap toggle, journal map click', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
  await page.waitForTimeout(600)

  // N toggles the minimap (it moved off M).
  await expect(page.locator('.minimap')).toBeVisible()
  await page.keyboard.press('KeyN')
  await expect(page.locator('.minimap')).toHaveCount(0)
  await page.keyboard.press('KeyN')
  await expect(page.locator('.minimap')).toBeVisible()

  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toBeVisible()
  await expect(page.locator('.bigmap__canvas')).toBeFocused()
  // The cursor starts at the player; arrows walk it north and east, Enter drops pins.
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  let state = await pinsOf(page)
  expect(state.pins.map((p) => p.slot)).toEqual([1, 2])
  expect(state.pins[1].x).toBeGreaterThan(state.pins[0].x)
  await expect(page.locator('.bigmap__pins li')).toHaveCount(2)

  // 1 selects pin 1 (cursor jumps there); Delete removes it.
  await page.keyboard.press('Digit1')
  await page.keyboard.press('Delete')
  state = await pinsOf(page)
  expect(state.pins.map((p) => p.slot)).toEqual([2])

  // + and - zoom without error; the legend's Clear all is reachable and works.
  await page.keyboard.press('Equal')
  await page.keyboard.press('Minus')
  await page.getByRole('button', { name: 'Clear all' }).click()
  expect((await pinsOf(page)).pins).toHaveLength(0)

  // M closes it again.
  await page.keyboard.press('KeyM')
  await expect(page.locator('.bigmap')).toHaveCount(0)

  // The Journal map tab is editable too: a click drops a pin.
  await page.keyboard.press('KeyJ')
  await page.getByRole('tab', { name: 'Map' }).click()
  const canvas = page.locator('.journal-map__canvas')
  await expect(canvas).toBeVisible()
  const b = (await canvas.boundingBox())!
  await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.3)
  await expect.poll(async () => (await pinsOf(page)).pins.length).toBe(1)
  await page.keyboard.press('KeyJ')
})

for (const size of SIZES) {
  test(`big map panels stay on screen and apart at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(size)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.teleport(0, 24, { yaw: 0 }))
    await page.evaluate(() => {
      window.__lastRites!.placePin(0, 0, 'Keeper hut')
      window.__lastRites!.placePin(-20, -30)
      window.__lastRites!.placePin(30, 10)
    })
    await page.waitForTimeout(400)
    await page.keyboard.press('KeyM')
    await expect(page.locator('.bigmap')).toBeVisible()
    await page.waitForTimeout(500)

    const rect = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
    const help = await rect('.bigmap__panel--help')
    const legend = await rect('.bigmap__panel--legend')
    const canvas = await rect('.bigmap__canvas')
    expect(canvas.w).toBeGreaterThanOrEqual(size.width - 1)
    expect(canvas.h).toBeGreaterThanOrEqual(size.height - 1)
    for (const p of [help, legend]) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w).toBeLessThanOrEqual(size.width)
      expect(p.y + p.h).toBeLessThanOrEqual(size.height)
    }
    // The two panels never touch.
    expect(help.x + help.w).toBeLessThan(legend.x)
    // The overlay covers the HUD completely: nothing from the HUD shows through the map.
    const top = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('.bigmap') !== null,
      [size.width / 2, 20],
    )
    expect(top).toBe(true)
    await expect(page.locator('.bigmap__pins li')).toHaveCount(3)
    await page.screenshot({ path: `${SHOTS}/big-map-${size.width}x${size.height}.png` })

    // Closed again, the HUD pieces are back and the pins sit on the compass.
    await page.keyboard.press('KeyM')
    await expect(page.locator('.bigmap')).toHaveCount(0)
    await expect.poll(() => compassPinMetres(page, 1)).not.toBeNull()
    await page.screenshot({ path: `${SHOTS}/big-map-hud-${size.width}x${size.height}.png` })
  })
}
