import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 24.4 (D4): chapel repairs through the real UI. The repair panel opens at the
// chapel door (E), Cancel/Esc close it and E reopens it, each stage takes its cost, stage 1 fits the
// barricades, stage 2 makes the altar heal 25 HP and heal again the next day, stage 3 rings the bell,
// and all of it survives into the night.

type Slot = { item: string; qty: number }
const snap = <T>(page: Page, name: Parameters<NonNullable<Window['__lastRites']>['snapshot']>[0]) =>
  page.evaluate((n) => window.__lastRites!.snapshot(n), name) as Promise<T>

async function count(page: Page, item: string): Promise<number> {
  const inv = await snap<{ inventory: { slots: Slot[] } }>(page, 'inventory')
  return inv.inventory.slots.filter((s) => s.item === item).reduce((a, s) => a + s.qty, 0)
}

const chapelStages = async (page: Page) => (await snap<{ completedStages: string[] }>(page, 'chapel')).completedStages

test('chapel repairs: panel, costs, effects, daily altar heal, persistence into the night', async ({ page }) => {
  test.setTimeout(300_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.2,
    undefined,
    { timeout: 90_000 },
  )

  const panel = page.locator('.repair-ui')
  const confirm = page.locator('.repair-ui__btn--confirm')

  // Standing at the chapel door repair point (10, 0.5), out of the way of the barricade frames.
  await page.evaluate(() => window.__lastRites!.teleport(10, -0.5, { yaw: 0 }))
  await page.waitForTimeout(800)

  // No materials: the panel opens and Confirm is disabled, nothing is spent.
  await page.keyboard.press('KeyE')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Bar the Doors')
  await expect(confirm).toBeDisabled()

  // Esc closes it; a fresh E reopens it straight away (no need to walk off first); Cancel closes it.
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await page.keyboard.press('KeyE')
  await expect(panel).toBeVisible()
  await page.locator('.repair-ui__btn--cancel').click()
  await expect(panel).toBeHidden()

  // Materials for all three stages: 10 nails, 2 bone, 3 wax, 1 holy water, 2 cloth.
  const before = await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('iron-nail', 10)
    h.give('bone', 2)
    h.give('candle-wax', 3)
    h.give('holy-water', 1)
    h.give('cloth', 2)
    return true
  })
  expect(before).toBe(true)
  const nails0 = await count(page, 'iron-nail')
  const cloth0 = await count(page, 'cloth')
  const bone0 = await count(page, 'bone')
  expect(nails0).toBeGreaterThanOrEqual(10)

  // Stage 1: costs 4 nails and 2 bone, fits the barricades.
  expect((await snap<{ built: boolean }>(page, 'doors')).built).toBe(false)
  await page.keyboard.press('KeyE')
  await expect(panel).toContainText('Stage 1')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(panel).toBeHidden()
  expect(await chapelStages(page)).toEqual(['barDoor'])
  expect(await count(page, 'iron-nail')).toBe(nails0 - 4)
  expect(await count(page, 'bone')).toBe(bone0 - 2)
  const doors = await snap<{ built: boolean; doors: { front: number[]; vestry: number[] } }>(page, 'doors')
  expect(doors.built).toBe(true)
  expect(doors.doors.front).toHaveLength(2)
  expect(doors.doors.vestry).toHaveLength(2)

  // Stage 2: 3 wax and 1 holy water.
  await page.keyboard.press('KeyE')
  await expect(panel).toContainText('Relight the Altar')
  await confirm.click()
  expect(await chapelStages(page)).toEqual(['barDoor', 'altarSave'])
  expect(await count(page, 'candle-wax')).toBe(0)
  expect(await count(page, 'holy-water')).toBe(0)

  // Stage 3: 6 nails and 2 cloth.
  await page.keyboard.press('KeyE')
  await expect(panel).toContainText('Rehang the Bell')
  await confirm.click()
  expect(await chapelStages(page)).toEqual(['barDoor', 'altarSave', 'bellWarning'])
  expect(await count(page, 'iron-nail')).toBe(nails0 - 10)
  expect(await count(page, 'cloth')).toBe(cloth0 - 2)

  // Everything built: the panel says so and offers only Close.
  await page.keyboard.press('KeyE')
  await expect(panel).toContainText('All repairs are complete')
  await expect(confirm).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // Altar (10, 9.5): E heals 25 HP once per day.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setHealth(40)
    h.teleport(10, 8.5, { yaw: Math.PI })
  })
  await page.waitForTimeout(800)
  await page.keyboard.press('KeyE')
  await expect.poll(async () => (await snap<{ health: number }>(page, 'player')).health).toBe(65)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(300)
  expect((await snap<{ health: number }>(page, 'player')).health).toBe(65)

  // The repairs persist into the night, and the next dawn re-arms the altar.
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night', undefined, {
    timeout: 60_000,
  })
  expect(await chapelStages(page)).toHaveLength(3)
  expect((await snap<{ built: boolean }>(page, 'doors')).built).toBe(true)
  await page.evaluate(() => window.__lastRites!.solveCurrentCase())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dawn', undefined, {
    timeout: 90_000,
  })
  expect((await snap<{ altarHealedToday: boolean }>(page, 'chapel')).altarHealedToday).toBe(false)
  expect(await chapelStages(page)).toHaveLength(3)

  expect(errors).toEqual([])
})
