import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 09 task 11n (scenery swap): frame cost standing in each place the scenery changes: the
// chapel, the hut, the catacombs and the open grounds. Each stop teleports there, lets the scene
// settle, then records the longest frame and the draw calls and triangles. Run with
// LABEL=before|after. Headless Chrome renders on SwiftShader, so the numbers are pessimistic;
// compare before with after only. Reused by 11n-b, 11n-c and 11n-d.
const LABEL = process.env.LABEL ?? 'run'
const STOPS: { name: string; x: number; z: number; yaw: number }[] = [
  { name: 'chapel', x: 10, z: 0, yaw: 0 },
  { name: 'hut', x: 0, z: 1, yaw: 0 },
  { name: 'catacombs', x: 25, z: 48, yaw: 0 },
  { name: 'grounds', x: 0, z: 14, yaw: 0 },
]

test('frame cost per scenery stop', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 120_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  const result: Record<string, { longestMs: number; calls: number; triangles: number }> = {}
  for (const stop of STOPS) {
    await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: s.yaw }), stop)
    await page.waitForTimeout(2500)
    await page.evaluate(() => window.__lastRites!.resetFrames())
    await page.waitForTimeout(4000)
    const info = await page.evaluate(() => window.__lastRites!.renderInfo(20))
    const longestMs = await page.evaluate(() => window.__lastRites!.longestFrameMs())
    result[stop.name] = { longestMs, calls: info?.calls ?? 0, triangles: info?.triangles ?? 0 }
  }
  mkdirSync('e2e/logs', { recursive: true })
  writeFileSync(`e2e/logs/scenery-perf-${LABEL}.json`, JSON.stringify({ label: LABEL, ...result }, null, 2))
  console.log(JSON.stringify({ label: LABEL, ...result }))
})
