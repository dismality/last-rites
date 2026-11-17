import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 11 task 2.1 / task 9 (Req 7.16, 8.14): the GPU benchmark before and after the horror pass,
// on the same scenes and resolution. Run once as "before" (task 2) and once as "after" (task 9):
//   cmd /c "set HORROR_PERF=after&& npx playwright test --project=perf horror-perf"
// The default is "before". Draw calls, mean and longest frame time and the shadow-light count are
// saved to e2e/logs/horror-perf-<tag>.json. Uses the machine's GPU (playwright.config.ts).
const TAG = process.env.HORROR_PERF === 'after' ? 'after' : 'before'
const SIZE = { width: 1920, height: 1080 }

interface Stop {
  name: string
  x: number
  z: number
  yaw: number
  night?: boolean
  wave?: boolean
}
const STOPS: Stop[] = [
  // Facing the vending machine and the bench from the middle of the hut.
  { name: 'hut', x: 0, z: 1, yaw: -Math.PI / 2 },
  { name: 'grounds-day', x: 0, z: 14, yaw: 0 },
  { name: 'mausoleum-row', x: -23.8, z: -38, yaw: Math.PI },
  { name: 'grounds-night-wave', x: 0, z: 14, yaw: 0, night: true, wave: true },
]

test(`horror pass GPU benchmark (${TAG})`, async ({ page }) => {
  test.setTimeout(600_000)
  await page.setViewportSize(SIZE)
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 120_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))

  const result: Record<string, unknown> = {}
  for (const stop of STOPS) {
    if (stop.night) {
      await page.evaluate(() => window.__lastRites!.skipToNight(2))
      await page.waitForFunction(
        () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
        undefined,
        { timeout: 60_000 },
      )
    }
    await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: s.yaw }), stop)
    if (stop.wave) {
      await page.evaluate(() => {
        const h = window.__lastRites!
        const pts = Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return { x: Math.sin(a) * 9, z: 14 + Math.cos(a) * 9 }
        })
        h.holdZombies(h.spawnZombies(pts), 600)
      })
    }
    await page.waitForTimeout(3000)
    await page.evaluate(() => window.__lastRites!.resetFrames())
    const meanMs = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const t0 = performance.now()
          let n = 0
          const step = () => (++n < 120 ? requestAnimationFrame(step) : resolve((performance.now() - t0) / n))
          requestAnimationFrame(step)
        }),
    )
    const info = await page.evaluate(() => window.__lastRites!.renderInfo(10))
    const longestMs = await page.evaluate(() => window.__lastRites!.longestFrameMs())
    const lights = await page.evaluate(() => window.__lastRites!.lightCensus())
    result[stop.name] = {
      meanFrameMs: Math.round(meanMs * 10) / 10,
      longestFrameMs: Math.round(longestMs * 10) / 10,
      drawCalls: Math.round(info?.calls ?? 0),
      triangles: Math.round(info?.triangles ?? 0),
      lights,
      // Recorded, not asserted: the baseline measures what is there; task 9 compares before and after.
      overDrawCallBudget: (info?.calls ?? 0) >= 150,
    }
    if (lights) expect(lights.shadowCasting, `${stop.name}: shadow-casting lights`).toBeLessThanOrEqual(4)
  }
  mkdirSync('e2e/logs', { recursive: true })
  const out = { tag: TAG, date: new Date().toISOString().slice(0, 10), renderer: 'headless Chrome, ANGLE D3D11 (GPU)', ...SIZE, ...result }
  writeFileSync(`e2e/logs/horror-perf-${TAG}.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out))
})
