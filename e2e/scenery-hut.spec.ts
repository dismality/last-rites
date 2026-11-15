import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Spec 09 task 11n-b: the hut's Blender scene in the browser. Screenshots at 1280x720 into
// e2e/screenshots/scenery/: inside facing each wall (page 1 and the powder tin resting on their
// tables) and outside. Yaw 0 faces -Z (the workbench wall); PI/2 faces west, -PI/2 east, PI the door.

const DIR = 'e2e/screenshots/scenery'

async function startRun(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 180_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
}

async function shot(page: Page, file: string, v: { x: number; z: number; yaw: number; pitch: number }): Promise<void> {
  await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: s.yaw, pitch: s.pitch }), v)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${DIR}/${file}.png` })
}

test.describe('hut scenery (11n-b)', () => {
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  test('views of the hut inside and out', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
    await shot(page, 'hut-north-bench', { x: 0, z: 0.5, yaw: 0, pitch: -0.1 })
    // East table: hut shelf supplies and journal page 1.
    await shot(page, 'hut-east-table', { x: 0.6, z: -0.4, yaw: -Math.PI / 2 + 0.25, pitch: -0.4 })
    // West table with the powder tin, and the stove and cot beyond it.
    await shot(page, 'hut-west-table', { x: -0.6, z: -0.2, yaw: Math.PI / 2 - 0.2, pitch: -0.4 })
    await shot(page, 'hut-west-cot-boots', { x: 0, z: 0, yaw: Math.PI / 2 + 0.5, pitch: -0.3 })
    await shot(page, 'hut-south-door', { x: 0, z: 0, yaw: Math.PI, pitch: -0.05 })
    await shot(page, 'hut-east-vending', { x: 0, z: 1, yaw: -Math.PI / 2 - 0.3, pitch: -0.05 })
    // Outside, from the path south of the door, and from the north-east corner.
    await shot(page, 'hut-outside-door', { x: 0, z: 9, yaw: 0, pitch: 0.05 })
    await shot(page, 'hut-outside-corner', { x: 9, z: 7, yaw: -Math.PI / 2 + 0.7, pitch: 0.05 })
  })

  test('the hut items are still interactable and the walk to the bench is clear', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    const ids = await page.evaluate(() => window.__lastRites!.interactableIds())
    console.log('interactables', JSON.stringify(ids).slice(0, 600))
    expect(ids.some((i: string) => i.includes('workbench'))).toBe(true)
    await page.evaluate(() => window.__lastRites!.teleport(0, 1.5, { yaw: 0, pitch: 0 }))
    await page.waitForTimeout(1000)
    await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
    await page.waitForTimeout(6000)
    await page.evaluate(() => window.__lastRites!.release('MoveForward'))
    const feet = await page.evaluate(() => window.__lastRites!.body()!.feet)
    console.log('feet after walking to the bench', JSON.stringify(feet))
    expect(feet[2]).toBeLessThan(-1.2)
    expect(feet[2]).toBeGreaterThan(-1.9)
  })
})
