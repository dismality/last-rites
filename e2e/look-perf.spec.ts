import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Task 12.2 measurement: frame times while turning on the spot, through the input module.
// Headless SwiftShader frame times are pessimistic and synthetic input is not a real mouse, so this
// shows relative cost and hitches only. Run with LABEL=before|after.
const LABEL = process.env.LABEL ?? 'run'
const SPOTS: { name: string; x: number; z: number }[] = [
  { name: 'spawn', x: 0, z: 0 },
  { name: 'graveyard-key', x: -12, z: -18 },
  { name: 'headstones', x: -14, z: -14 },
]

test('turning on the spot', async ({ page }) => {
  test.setTimeout(600_000)
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )
  const results: Record<string, unknown> = {}
  for (const spot of SPOTS) {
    await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z), spot)
    await page.waitForTimeout(1500)
    const r = await page.evaluate(async () => {
      const h = window.__lastRites!
      const run = (frames: number, dx: number) =>
        new Promise<number[]>((resolve) => {
          const times: number[] = []
          let last = performance.now()
          let n = 0
          const step = (now: number) => {
            times.push(now - last)
            last = now
            h.input.mouseMove(dx, 0)
            if (++n < frames) requestAnimationFrame(step)
            else resolve(times)
          }
          requestAnimationFrame(step)
        })
      const stats = (t: number[]) => {
        const s = t.slice(5).sort((a, b) => a - b)
        const mean = s.reduce((a, b) => a + b, 0) / s.length
        return { mean, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], frames: s.length }
      }
      const still = stats(await run(80, 0))
      const turning = stats(await run(80, 14))
      return { still, turning, raycast: h.raycastCostMs(100) }
    })
    results[spot.name] = r
  }
  mkdirSync('e2e/logs', { recursive: true })
  writeFileSync(`e2e/logs/look-perf-${LABEL}.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
})
