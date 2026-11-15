import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 09 task 24.8 (D8 performance): draw calls, frame times, lights and shadow casters in the
// hut, the open grounds at night with a full wave, Mausoleum Row, the catacombs and the boss
// fight, at 1366x768 and 1920x1080. Headless Chrome renders on SwiftShader (software), so the
// frame times are NOT real GPU fps. Compare areas with each other and with the budget (150 draw
// calls, 4 shadow-casting lights), not with 60 fps.
const SIZES = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]
interface Stop {
  name: string
  x: number
  z: number
  yaw: number
  night?: boolean
  wave?: boolean
  boss?: boolean
}
const STOPS: Stop[] = [
  { name: 'hut', x: 0, z: 1, yaw: 0 },
  { name: 'mausoleum-row', x: -23.8, z: -38, yaw: Math.PI },
  { name: 'catacombs', x: 25, z: 48, yaw: 0 },
  { name: 'grounds-night-wave', x: 0, z: 14, yaw: 0, night: true, wave: true },
  { name: 'boss-fight', x: 10, z: 0, yaw: 0, night: true, boss: true },
]

for (const size of SIZES) {
  test(`D8 frame cost per area at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(900_000)
    await page.setViewportSize(size)
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
        const phase = await page.evaluate(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase)
        if (phase !== 'night') {
          await page.evaluate(() => window.__lastRites!.skipToNight(2))
          await page.waitForFunction(
            () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
            undefined,
            { timeout: 60_000 },
          )
        }
      }
      await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: s.yaw }), stop)
      if (stop.wave) {
        // Fill the alive cap (12) with held shamblers near the player, on top of the real wave.
        await page.evaluate(() => {
          const h = window.__lastRites!
          const pts = Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return { x: Math.sin(a) * 9, z: 14 + Math.cos(a) * 9 }
          })
          h.holdZombies(h.spawnZombies(pts), 600)
        })
      }
      if (stop.boss) {
        await page.evaluate(() => {
          const h = window.__lastRites!
          h.holdZombies(h.spawnZombies([{ type: 'father-crane', x: 10, z: -6 }]), 600)
          h.showBossBar()
        })
      }
      await page.waitForTimeout(3000)
      await page.evaluate(() => window.__lastRites!.resetFrames())
      // Mean frame time over the same window the draw calls are counted in.
      const meanMs = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const t0 = performance.now()
            let n = 0
            const step = () => (++n < 40 ? requestAnimationFrame(step) : resolve((performance.now() - t0) / n))
            requestAnimationFrame(step)
          }),
      )
      const info = await page.evaluate(() => window.__lastRites!.renderInfo(10))
      const longestMs = await page.evaluate(() => window.__lastRites!.longestFrameMs())
      const lights = await page.evaluate(() => window.__lastRites!.lightCensus())
      const census = await page.evaluate(() => window.__lastRites!.drawCensus())
      result[stop.name] = {
        meanFrameMs: Math.round(meanMs * 10) / 10,
        longestFrameMs: Math.round(longestMs * 10) / 10,
        drawCalls: Math.round(info?.calls ?? 0),
        triangles: Math.round(info?.triangles ?? 0),
        lights,
        visibleMeshes: census?.total,
        shadowCasterMeshes: census?.shadowCasters,
        overDrawCallBudget: (info?.calls ?? 0) > 150,
      }
      if (lights) expect(lights.shadowCasting, `${stop.name}: shadow-casting lights`).toBeLessThanOrEqual(4)
    }
    mkdirSync('e2e/logs', { recursive: true })
    const out = { note: 'SwiftShader (software) numbers, not real GPU fps', ...size, ...result }
    writeFileSync(`e2e/logs/d8-perf-${size.width}x${size.height}.json`, JSON.stringify(out, null, 2))
    console.log(JSON.stringify(out))
  })
}
