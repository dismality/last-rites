import { test, expect } from '@playwright/test'

// Smoke: the game loads in real Chrome, a run starts through the debug hook without pointer lock,
// the sim advances, and store snapshots can be read.
test('loads, starts a run and reads snapshots', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)

  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('game') as { screen: string }).screen === 'game',
  )

  const mode = await page.evaluate(
    () => (window.__lastRites!.snapshot('progression') as { mode: string }).mode,
  )
  expect(mode).toBe('normal')

  // The world clock only moves while the fixed-step loop runs, which needs the scene mounted.
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )

  const all = await page.evaluate(() => window.__lastRites!.snapshotAll())
  expect(Object.keys(all)).toEqual(
    expect.arrayContaining(['world', 'wave', 'enemies', 'progression', 'inventory', 'player']),
  )
  const frame = await page.evaluate(() => window.__lastRites!.longestFrameMs())
  expect(frame).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('hook can skip to night, spawn zombies, give items and swing without pointer lock', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.2,
    undefined,
    { timeout: 90_000 },
  )

  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('bandage', 2)
    h.spawnZombies([{ x: 30, z: 30 }])
    h.skipToNight(1)
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
  )

  const inv = (await page.evaluate(() => window.__lastRites!.snapshot('inventory'))) as {
    inventory: { slots: { item: string; qty: number }[] }
  }
  // Crafted items take one slot each, so count across slots.
  const bandages = inv.inventory.slots.filter((s) => s.item === 'bandage').reduce((n, s) => n + s.qty, 0)
  expect(bandages).toBe(2)
  const enemies = (await page.evaluate(() => window.__lastRites!.snapshot('enemies'))) as unknown[]
  expect(enemies.length).toBeGreaterThan(0)

  // Attack goes through the real input module; a swing must not throw without pointer lock.
  await page.evaluate(() => window.__lastRites!.action('Attack', 100))
})
