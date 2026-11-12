import { test, expect } from '@playwright/test'

// Spec 09, B4: the oil on the hut table shows "E: Take" with the crosshair on it, and a real E
// press takes it. Step 2 finishing on that pickup is covered by tests/tutorialOrder.test.ts.

const SHELF: [number, number, number] = [1.8, 0.8, -1]
const STAND = { x: 0.9, z: -1 }

test('the hut table oil shows "E: Take" and a real E press takes it', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)

  const stacks = (await page.evaluate(
    () =>
      (window.__lastRites!.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } })
        .world.materials['hut-shelf'],
  )) as { item: string }[]
  const index = stacks.findIndex((s) => s.item === 'lamp-oil')
  expect(index).toBeGreaterThanOrEqual(0)

  // MaterialPickups lays stacks out 0.35 m apart along x; the tin's centre is 0.06 m up.
  const target = { x: SHELF[0] + index * 0.35, y: SHELF[1] + 0.06, z: SHELF[2] }
  await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: -Math.PI / 2 }), STAND)
  await page.waitForFunction(
    (s) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - s.x, b.feet[2] - s.z) < 0.2
    },
    STAND,
  )
  const eye = (await page.evaluate(() => window.__lastRites!.body()!.camera)) as number[]
  // forward is (-sin yaw, -cos yaw); pitch is positive looking up.
  const yaw = Math.atan2(-(target.x - eye[0]), -(target.z - eye[2]))
  const pitch = Math.atan2(target.y - eye[1], Math.hypot(target.x - eye[0], target.z - eye[2]))
  await page.evaluate(
    ({ x, z, yaw, pitch }) => window.__lastRites!.teleport(x, z, { yaw, pitch }),
    { ...STAND, yaw, pitch },
  )

  const id = `pickup:hut-shelf:${index}`
  await page.waitForFunction(
    (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
    id,
    { timeout: 10_000 },
  )
  await expect(page.locator('.hud-prompt')).toContainText('E: Take')

  // Held for 600 ms: a 150 ms tap can fall between two slow software-rendered frames and be missed.
  await page.evaluate(() => window.__lastRites!.hold('Interact'))
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__lastRites!.release('Interact'))
  await page.waitForFunction(() => {
    const inv = window.__lastRites!.snapshot('inventory') as { inventory: { slots: { item: string }[] } }
    return inv.inventory.slots.some((s) => s.item === 'lamp-oil')
  })
})
