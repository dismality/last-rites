import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 2.7 (Req 6.2, 6.6, 6.8, 6.9, 6.10, 6.11, 6.17, 8.21): the hut vending machine.
// Walk up to it, open it by day and at night, buy a row (the handle pulls, coins drop, the stock
// count drops, the Brisk Draught shows its effect ring), refuse for coins and for a full satchel,
// sold out, the dawn restock, a keyboard-only run, Esc reaching pause, and the machine still
// working with its model missing. Screenshots at 1280x720 and 800x600 in e2e/screenshots/vending/.

const DIR = 'e2e/screenshots/vending'
const MACHINE = { x: 2.83, z: 1.85 }

type VState = {
  open: boolean
  stockLeft: Record<string, number>
  visible: string[]
  lastPurchase: { row: string; handle: number; seq: number } | null
  coins: number
  near: boolean
  handleOffsets: number[]
}
const vstate = (page: Page) => page.evaluate(() => window.__lastRites!.vendingState() as VState)

async function startRun(page: Page): Promise<void> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 30_000 })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
}

/** From the middle of the hut, walk east until the machine is in reach and under the crosshair. */
async function walkToMachine(page: Page): Promise<void> {
  // yaw -PI/2 faces +X; a slight downward pitch puts the crosshair on the cabinet.
  await page.evaluate(() => window.__lastRites!.teleport(0.2, 1.85, { yaw: -Math.PI / 2, pitch: -0.15 }))
  await page.waitForFunction(() => {
    const b = window.__lastRites!.body()
    return b !== null && Math.abs(b.feet[0] - 0.2) < 0.2
  }, undefined, { timeout: 10_000 })
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.waitForFunction(() => window.__lastRites!.vendingState().near, undefined, { timeout: 10_000 })
  await page.waitForFunction(() => {
    const b = window.__lastRites!.body()
    return b !== null && b.feet[0] > 1.3
  }, undefined, { timeout: 10_000 })
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  // The walk can slide along the barrel beside the machine; square up in front of it to aim.
  await page.evaluate(() => window.__lastRites!.teleport(1.45, 1.85, { yaw: -Math.PI / 2, pitch: -0.15 }))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'vending',
    undefined,
    { timeout: 10_000 },
  )
}

async function interact(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.hold('Interact'))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__lastRites!.release('Interact'))
}

async function openMachine(page: Page) {
  await interact(page)
  const panel = page.getByRole('dialog', { name: 'Hollowmere Automatic Dispenser' })
  await expect(panel).toBeVisible()
  return panel
}

const row = (page: Page, id: string) => page.locator(`.vending__row[data-row="${id}"]`)

async function shoot(page: Page, name: string): Promise<void> {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${DIR}/${name}-${size.width}x${size.height}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

test('the vending machine sells by day and at night, refuses, sells out and restocks', async ({ page }) => {
  test.setTimeout(240_000)
  await startRun(page)

  // The machine in the hut, from where the keeper walks up to it.
  await page.evaluate(() => window.__lastRites!.teleport(0, 1.85, { yaw: -Math.PI / 2, pitch: -0.1 }))
  await page.waitForTimeout(1200)
  await shoot(page, 'machine-in-hut')

  await walkToMachine(page)
  await expect(page.locator('.hud-prompt')).toContainText('E: Trade')

  // Day: four rows without guns, each with name, price, "N left" and a blurb.
  await page.evaluate(() => window.__lastRites!.setCoins(0))
  const panel = await openMachine(page)
  expect((await vstate(page)).visible).toEqual(['lamp-oil', 'kola-tonic', 'brisk-draught', 'bandage'])
  await expect(row(page, 'brisk-draught')).toContainText('Brisk Draught')
  await expect(row(page, 'brisk-draught')).toContainText('15 coins')
  await expect(row(page, 'brisk-draught')).toContainText('1 left')
  await expect(row(page, 'brisk-draught')).toContainText('25% faster for 60 seconds')

  // Refused for coins: nothing changes and the shortfall is named.
  await row(page, 'kola-tonic').getByRole('button').click()
  await expect(page.getByTestId('vending-refusal')).toHaveText('Need 18 coins, you have 0 (18 short)')
  expect((await vstate(page)).stockLeft['kola-tonic']).toBe(1)
  expect((await vstate(page)).coins).toBe(0)

  // Buy: coins drop, stock drops, the handle pulls out and springs back, the goods land.
  await page.evaluate(() => window.__lastRites!.setCoins(100))
  await row(page, 'brisk-draught').getByRole('button').click()
  await expect(page.getByTestId('vending-refusal')).toHaveText('')
  await page.waitForFunction(() => window.__lastRites!.vendingState().handleOffsets[4] > 0.03, undefined, { timeout: 3000 })
  let s = await vstate(page)
  expect(s.coins).toBe(85)
  expect(s.stockLeft['brisk-draught']).toBe(0)
  expect(s.lastPurchase).toMatchObject({ row: 'brisk-draught', handle: 4 })
  await expect(row(page, 'brisk-draught')).toContainText('Sold out')
  // The line ends in an info dot ("i"), so match the number alone.
  await expect(page.getByTestId('vending-coins')).toHaveText(/^Grave Coins: 85(?!\d)/)
  await shoot(page, 'panel-day')
  await page.waitForFunction(() => window.__lastRites!.vendingState().handleOffsets.every((o) => Math.abs(o) < 0.005), undefined, { timeout: 3000 })

  // Sold out: a further purchase is refused and leaves the coins.
  // aria-disabled, but still pressable so the refusal can say why; Playwright would wait for it.
  await row(page, 'brisk-draught').getByRole('button').click({ force: true })
  await expect(page.getByTestId('vending-refusal')).toHaveText('Sold out')
  expect((await vstate(page)).coins).toBe(85)

  // The world keeps running behind the panel, and Esc still reaches pause.
  const t0 = await page.evaluate(() => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime)
  await page.waitForTimeout(600)
  const t1 = await page.evaluate(() => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime)
  expect(t1).toBeGreaterThan(t0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden()
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toBeHidden()

  // The Brisk Draught shows its effect ring when used.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('brisk-draught', 0, 1)
    h.equip(1)
  })
  expect(await page.evaluate(() => window.__lastRites!.consumeHeld())).toBe(true)
  await expect(page.locator('.effect-icons__item')).toContainText(/(60|59|58)s/)

  // A full satchel refuses and names it; coins and stock stay.
  await page.evaluate(() => {
    const h = window.__lastRites!
    const fill = ['bone', 'iron-nail', 'candle-wax', 'cloth', 'grave-salt', 'wood-plank', 'bone-club', 'nail-bomb', 'salt-circle', 'tallow-candle', 'lantern-refill', 'holy-water-flask', 'lantern-trap', 'wood-axe']
    for (const id of fill) h.give(id as never, 1)
  })
  await walkToMachine(page)
  await openMachine(page)
  const before = await vstate(page)
  await row(page, 'bandage').getByRole('button').click()
  await expect(page.getByTestId('vending-refusal')).toHaveText('Your satchel is full')
  s = await vstate(page)
  expect(s.coins).toBe(before.coins)
  expect(s.stockLeft.bandage).toBe(before.stockLeft.bandage)
  await shoot(page, 'panel-refused-full')
  await page.getByRole('button', { name: 'Close' }).click()

  // A fresh run for the night, so the satchel has room for the revolver.
  await startRun(page)

  // Night: the machine still opens, and a gun's ammo row appears once the gun is owned.
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night', undefined, { timeout: 60_000 })
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('revolver', 1)
    h.setCoins(30)
  })
  await walkToMachine(page)
  await openMachine(page)
  expect((await vstate(page)).visible[0]).toBe('revolver-cartridge')
  await row(page, 'revolver-cartridge').getByRole('button').click()
  s = await vstate(page)
  expect(s.coins).toBe(18)
  expect(s.stockLeft['revolver-cartridge']).toBe(1)
  await expect(row(page, 'revolver-cartridge')).toContainText('1 left')
  await shoot(page, 'panel-night')
  await page.getByRole('button', { name: 'Close' }).click()

  // Dawn restocks every row.
  await page.evaluate(() => window.__lastRites!.skipToDawn())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dawn', undefined, { timeout: 60_000 })
  s = await vstate(page)
  expect(s.stockLeft).toEqual({ 'revolver-cartridge': 2, 'shotgun-shell': 2, 'lamp-oil': 3, 'kola-tonic': 1, 'brisk-draught': 1, bandage: 2 })
})

test('the vending panel works by keyboard alone, with a visible focus ring', async ({ page }) => {
  test.setTimeout(150_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.setCoins(10))
  await walkToMachine(page)
  await openMachine(page)
  // A real browser frees the pointer for an overlay; headless play fakes the lock, so let go of it.
  await page.evaluate(() => window.__lastRites!.lockless(false))

  // Tab to the Lamp Oil buy button and press Enter.
  const buy = row(page, 'lamp-oil').getByRole('button')
  for (let i = 0; i < 12 && !(await buy.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(buy).toBeFocused()
  const outline = await buy.evaluate((b) => getComputedStyle(b).outlineStyle)
  expect(outline).not.toBe('none')
  await page.keyboard.press('Enter')
  const s = await vstate(page)
  expect(s.coins).toBe(5)
  expect(s.stockLeft['lamp-oil']).toBe(2)
  await expect(row(page, 'lamp-oil')).toContainText('2 left')
  await shoot(page, 'panel-keyboard-focus')
})

test('the machine stays usable with its model missing (placeholder cabinet)', async ({ page }) => {
  test.setTimeout(150_000)
  await page.route('**/assets/models/props/vending-machine.glb', (r) => r.fulfill({ status: 404, body: '' }))
  await startRun(page)
  // The loading screen let the missing file through; the placeholder cabinet stands in.
  expect(await page.evaluate(() => window.__lastRites!.objectVisible('Vending machine (placeholder)'))).toBe(true)
  await page.evaluate(() => window.__lastRites!.setCoins(10))
  await walkToMachine(page)
  await openMachine(page)
  await row(page, 'bandage').getByRole('button').click()
  expect((await vstate(page)).stockLeft.bandage).toBe(1)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.evaluate(() => window.__lastRites!.teleport(0, 1.85, { yaw: -Math.PI / 2, pitch: -0.1 }))
  await page.waitForTimeout(800)
  await shoot(page, 'placeholder-cabinet')
})
