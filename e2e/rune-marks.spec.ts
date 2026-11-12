import { test, expect, type Page } from '@playwright/test'
import { BENCH_Z, CHAPEL_CENTER, CORRIDORS } from '../src/data/cemeteryLayout'
import { LANDMARKS } from '../src/data/mapLandmarks'

// Task 11j: the rune and mark images are wired in (interaction prompt, dawn picker, HUD compass and
// minimap, journal map) and each has a screenshot. Headless Chrome on SwiftShader, so slow frames.

const SHOTS = 'e2e/screenshots'

async function startRun(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

const loadedAt = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((e) => {
      const img = e as HTMLImageElement
      const r = img.getBoundingClientRect()
      return {
        loaded: img.complete && img.naturalWidth > 0,
        w: Math.round(r.width),
        h: Math.round(r.height),
        rendering: getComputedStyle(img).imageRendering,
      }
    }),
  )

test('prompt rune, HUD marks and journal map use the images', async ({ page }) => {
  test.setTimeout(240_000)
  await startRun(page)

  // 1. Interaction prompt: the hut-table oil, as in hut-oil.spec.ts.
  const SHELF: [number, number, number] = [1.8, 0.8, -1]
  const STAND = { x: 0.9, z: -1 }
  const stacks = (await page.evaluate(
    () =>
      (window.__lastRites!.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } })
        .world.materials['hut-shelf'],
  )) as { item: string }[]
  const index = stacks.findIndex((s) => s.item === 'lamp-oil')
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
  const yaw = Math.atan2(-(target.x - eye[0]), -(target.z - eye[2]))
  const pitch = Math.atan2(target.y - eye[1], Math.hypot(target.x - eye[0], target.z - eye[2]))
  await page.evaluate(({ x, z, yaw, pitch }) => window.__lastRites!.teleport(x, z, { yaw, pitch }), {
    ...STAND,
    yaw,
    pitch,
  })
  await page.waitForFunction(
    (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
    `pickup:hut-shelf:${index}`,
    { timeout: 15_000 },
  )
  await expect(page.locator('.hud-prompt')).toContainText('E: Take')
  const rune = page.locator('.hud-prompt img.hud-prompt__rune-img')
  await expect(rune).toHaveCount(1)
  expect(await loadedAt(page, '.hud-prompt img.hud-prompt__rune-img')).toEqual([
    { loaded: true, w: 32, h: 32, rendering: 'pixelated' },
  ])
  await expect(rune).toHaveAttribute('alt', 'ᚦ')
  const promptBox = (await page.locator('.hud-prompt').boundingBox())!
  await page.screenshot({
    path: `${SHOTS}/prompt-rune.png`,
    clip: {
      x: Math.max(0, promptBox.x - 40),
      y: Math.max(0, promptBox.y - 40),
      width: promptBox.width + 80,
      height: promptBox.height + 80,
    },
  })

  // 2. HUD compass and minimap: outside the hut so the chapel and hut marks sit on the strip.
  await page.evaluate(() => window.__lastRites!.teleport(0, 6, { yaw: -Math.PI / 2 }))
  await page.waitForFunction(() => document.querySelectorAll('.compass__marker[data-mark="img"]').length >= 2, undefined, {
    timeout: 15_000,
  })
  const marks = await loadedAt(page, '.compass__marker[data-mark="img"] .compass__mark')
  expect(marks.length).toBeGreaterThanOrEqual(2)
  for (const m of marks) expect(m).toEqual({ loaded: true, w: 20, h: 20, rendering: 'pixelated' })
  // Text stays beside the image: never an image alone.
  const labels = await page.locator('.compass__marker .compass__text').allTextContents()
  expect(labels.join('|')).toMatch(/Chapel/)
  expect(labels.join('|')).toMatch(/Hut/)
  await page.waitForTimeout(600)
  const c = (await page.locator('.compass').boundingBox())!
  const m = (await page.locator('[data-testid="minimap"]').boundingBox())!
  const x0 = Math.max(0, Math.min(c.x, m.x) - 10)
  const y0 = 0
  await page.screenshot({
    path: `${SHOTS}/hud-marks.png`,
    clip: {
      x: x0,
      y: y0,
      width: Math.min(1280 - x0, Math.max(c.x + c.width, m.x + m.width) + 10 - x0),
      height: Math.max(c.y + c.height, m.y + m.height) + 10,
    },
  })

  // 3. Journal map: visit each landmark so its cell is explored, then open the Map tab.
  const stops: Array<[number, number]> = [
    [0, BENCH_Z],
    [CHAPEL_CENTER[0], CHAPEL_CENTER[2]],
    ...CORRIDORS.map((cr): [number, number] => [cr.centerX, cr.entranceZ]),
    ...LANDMARKS.filter((l) => l.kind === 'relic' && !l.nightOnly)
      .slice(0, 2)
      .map((l): [number, number] => [l.position[0], l.position[2]]),
    [0, 6],
  ]
  for (const [x, z] of stops) {
    await page.evaluate(([sx, sz]) => window.__lastRites!.teleport(sx, sz), [x, z])
    await page.waitForTimeout(400)
    // The map reveals a cell only while the player moves, so take a few steps there.
    await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
    await page.waitForTimeout(250)
    await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  }
  await page.keyboard.press('KeyJ')
  await page.getByRole('tab', { name: 'Map' }).click()
  const canvas = page.locator('.journal-map__canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(3500) // ink animation and image load
  await expect(page.locator('.journal-map__legend')).toContainText('Workbench')
  await page.screenshot({ path: `${SHOTS}/journal-map-marks.png` })
})

test('dawn picker shows the boon rune image beside the boon icon', async ({ page }) => {
  test.setTimeout(240_000)
  await startRun(page)
  await page.evaluate(() => {
    window.__lastRites!.keepAlive(true)
    window.__lastRites!.skipToDawn()
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('progression') as { pendingPick: string[] | null }).pendingPick !== null,
    undefined,
    { timeout: 60_000 },
  )
  await expect(page.locator('.dawn-picker__card')).toHaveCount(3)
  await page.waitForTimeout(500)
  const art = await loadedAt(page, '.dawn-picker__art')
  const runes = await loadedAt(page, '.dawn-picker__rune-img')
  expect(art).toHaveLength(3)
  expect(runes).toHaveLength(3)
  for (const a of art) expect(a).toEqual({ loaded: true, w: 64, h: 64, rendering: 'pixelated' })
  for (const r of runes) expect(r).toEqual({ loaded: true, w: 32, h: 32, rendering: 'pixelated' })
  await page.screenshot({ path: `${SHOTS}/dawn-picker-runes.png` })
})
