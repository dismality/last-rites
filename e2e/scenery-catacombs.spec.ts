import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Spec 09 task 11n-c: the catacombs, the gates, the ossuary door and the avenue rails from the
// Blender models. Screenshots at 1280x720 into e2e/screenshots/scenery/. Yaw 0 faces -Z, PI faces
// +Z (down the corridor), PI/2 faces west (-X), -PI/2 east.

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
  await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
}

async function shot(
  page: Page,
  file: string,
  v: { x: number; z: number; yaw: number; pitch: number },
  wait = 2500,
): Promise<void> {
  await page.evaluate(
    (s) => window.__lastRites!.teleport(s.x, s.z, { yaw: s.yaw, pitch: s.pitch }),
    v,
  )
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${DIR}/${file}.png` })
}

const gates = (page: Page) =>
  page.evaluate(
    () =>
      (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } })
        .mystery.gates,
  )

/** Interact until the gate flips open (the real Interact path, as graveyard-walk does). */
async function useGate(page: Page, id: string): Promise<boolean> {
  for (let k = 0; k < 5; k++) {
    await page.evaluate(() => window.__lastRites!.action('Interact', 250))
    await page.waitForTimeout(500)
    if ((await gates(page))[id]) return true
  }
  return false
}

test.describe('catacombs scenery (11n-c)', () => {
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  test('portal, bone walls, ledge items, bier, ossuary door and the heart', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await shot(page, 'catacombs-portal', { x: 25, z: 35, yaw: Math.PI, pitch: 0.05 })
    await shot(page, 'catacombs-bone-walls', { x: 25, z: 44, yaw: Math.PI, pitch: -0.05 })
    await shot(page, 'catacombs-ledge-a', { x: 25.3, z: 45, yaw: Math.PI / 2, pitch: -0.35 })
    await shot(page, 'catacombs-ledge-b', { x: 24.9, z: 50, yaw: -Math.PI / 2, pitch: -0.35 })
    await shot(page, 'catacombs-ledge-c', { x: 25.3, z: 54.6, yaw: Math.PI / 2, pitch: -0.35 })
    await shot(page, 'catacombs-bier', { x: 25.7, z: 52.9, yaw: Math.PI / 2, pitch: -0.55 })
    await shot(page, 'catacombs-ossuary-door', { x: 25, z: 53.6, yaw: Math.PI, pitch: -0.05 })
    // The door opens with the key at its gate; the heart then lies on the reliquary altar.
    await page.evaluate(() => {
      window.__lastRites!.give('iron-ossuary-key')
      window.__lastRites!.teleport(25, 54.4, { yaw: Math.PI, pitch: 0 })
    })
    await page.waitForTimeout(1500)
    expect(await useGate(page, 'ossuary'), 'ossuary door opened with the key').toBe(true)
    await page.waitForTimeout(1800)
    await shot(page, 'catacombs-heart-altar', { x: 25, z: 56.5, yaw: Math.PI, pitch: -0.45 })
    const ids = await page.evaluate(() => window.__lastRites!.interactableIds())
    expect(ids.some((i: string) => i.includes('fx-heart'))).toBe(true)
    expect(ids.some((i: string) => i.includes('fx-shroud'))).toBe(true)
    expect(ids.some((i: string) => i.includes('fx-page-4'))).toBe(true)
  })

  test('the gates lift whole, and the avenue rails stand', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    // Mausoleum Row: the crypt key at the gate.
    await page.evaluate(() => {
      window.__lastRites!.give('rusted-crypt-key')
      window.__lastRites!.teleport(-20, -38.4, { yaw: 0, pitch: 0 })
    })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${DIR}/gate-row-closed.png` })
    await page.evaluate(() => window.__lastRites!.action('Interact', 250))
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${DIR}/gate-row-lifting.png` })
    expect(await useGate(page, 'mausoleum-row'), 'Row gate opened').toBe(true)
    await page.waitForTimeout(1500)
    await shot(page, 'gate-row-open-rails', { x: -20, z: -38.5, yaw: 0, pitch: 0 })
    // Catacombs: the whistle, at the corridor gate.
    await page.evaluate(() => {
      window.__lastRites!.give('bone-whistle')
      window.__lastRites!.teleport(25, 38.4, { yaw: Math.PI, pitch: 0 })
    })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${DIR}/gate-catacombs-closed.png` })
    // The whistle works at the chapel altar, not at the gate (gateHints site: altar), so the lift
    // happens out of sight; the shots are the closed gate and the open mouth afterwards.
    const c = await page.evaluate(() => window.__lastRites!.interactableCentre('altar-whistle'))
    expect(c, 'altar-whistle hotspot mounted').not.toBeNull()
    const pitch = -Math.atan2(1.6 - c![1], c![2] - 8.6)
    await page.evaluate(
      (p) => window.__lastRites!.teleport(10, 8.6, { yaw: Math.PI, pitch: p }),
      pitch,
    )
    await page.waitForTimeout(1500)
    expect(await useGate(page, 'catacombs'), 'whistle opened the catacombs').toBe(true)
    await page.waitForTimeout(1800)
    await shot(page, 'gate-catacombs-open', { x: 25, z: 38.4, yaw: Math.PI, pitch: 0 })
  })
})
