#!/usr/bin/env node
// Screenshots of fixed viewpoints in the world, for judging art changes side by side.
//   node tools/video/looks.mjs OUT_DIR [tag]     (needs `npm run dev` on port 5173)
// Uses the GPU in a hidden Chrome; nothing on screen. Files: OUT_DIR/<view>-<tag>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'tools/video/out/looks'
const TAG = process.argv[3] ?? 'now'
mkdirSync(OUT, { recursive: true })

/** [name, x, z, yaw, pitch, phase] — yaw 0 looks north (-z). */
const VIEWS = [
  ['hut-front', 2.5, 7.5, 0.35, -0.02, 'day'],
  ['hut-wall', 3.9, 1.5, 1.57, -0.05, 'day'],
  ['hut-inside', 0, 2.2, 0, -0.25, 'day'],
  ['graves', -11, -9, 0.6, -0.12, 'day'],
  ['headstone-close', -14.5, -14.2, 0.75, -0.3, 'day'],
  ['chapel', 4, 12, 0.3, 0.08, 'day'],
  ['path-gate', 0, 30, Math.PI, 0.0, 'day'],
  ['night-yard', -4, 18, 0.2, -0.05, 'night'],
]

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => window.__lastRites !== undefined, undefined, { timeout: 120_000 })
await page.evaluate(() => window.__lastRites.startRun('normal'))
await page.waitForFunction(() => window.__lastRites.body() !== null, undefined, { timeout: 120_000 })
await page.evaluate(() => {
  const h = window.__lastRites
  h.keepAlive(true)
  h.setSetting('showControlHints', false)
})
const frames = (n) =>
  page.evaluate(
    (c) =>
      new Promise((r) => {
        let i = 0
        const s = () => (++i < c ? requestAnimationFrame(s) : r())
        requestAnimationFrame(s)
      }),
    n,
  )
let phase = 'day'
for (const [name, x, z, yaw, pitch, want] of VIEWS) {
  if (want !== phase) {
    await page.evaluate(() => {
      window.__lastRites.skipToDusk(1)
      window.__lastRites.skipToNight(1)
    })
    await page.waitForFunction(() => window.__lastRites.snapshot('world').phase === 'night', undefined, { timeout: 30_000 })
    await page.evaluate(() => window.__lastRites.killAll())
    phase = want
  }
  await page.evaluate(([px, pz, y, p]) => window.__lastRites.teleport(px, pz, { yaw: y, pitch: p }), [x, z, yaw, pitch])
  await frames(90)
  await page.screenshot({ path: join(OUT, `${name}-${TAG}.png`) })
  console.log('shot', name)
}
await browser.close()
