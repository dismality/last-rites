import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 09 task 11i: frame cost of the graveyard scene. A 20 s scripted walk (four 5 s legs through
// open ground, walking forward while turning, through the input module). Run with
// LABEL=before|after. Headless Chrome renders on SwiftShader, so these numbers are pessimistic and
// are not real GPU frame rates; compare before with after only.
const LABEL = process.env.LABEL ?? 'run'
const LEGS: { x: number; z: number; yaw: number }[] = [
  { x: 0, z: 6, yaw: 0 },
  { x: -14, z: -10, yaw: 1.2 },
  { x: 14, z: 20, yaw: 3 },
  { x: -10, z: 28, yaw: 4.5 },
]

test('20 s walk frame cost', async ({ page }) => {
  test.setTimeout(420_000)
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 120_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.teleport(0, 6, { yaw: 0 }))
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.__lastRites!.resetFrames())
  let calls = 0
  let triangles = 0
  for (const leg of LEGS) {
    await page.evaluate((l) => window.__lastRites!.teleport(l.x, l.z, { yaw: l.yaw }), leg)
    await page.waitForTimeout(300)
    await page.evaluate(async () => {
      const h = window.__lastRites!
      h.hold('MoveForward')
      await new Promise<void>((resolve) => {
        const t0 = performance.now()
        const step = (now: number) => {
          h.input.mouseMove(4, 0)
          if (now - t0 < 5000) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      h.release('MoveForward')
    })
    const info = await page.evaluate(() => window.__lastRites!.renderInfo(20))
    calls = Math.max(calls, info?.calls ?? 0)
    triangles = Math.max(triangles, info?.triangles ?? 0)
  }
  const longestMs = await page.evaluate(() => window.__lastRites!.longestFrameMs())
  const result = { label: LABEL, longestMs, maxDrawCalls: calls, maxTriangles: triangles }
  mkdirSync('e2e/logs', { recursive: true })
  writeFileSync(`e2e/logs/graveyard-perf-${LABEL}.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
})
