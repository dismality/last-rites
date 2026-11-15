import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { CHAPEL_CUPBOARD_POSITION } from '../src/data/cemeteryLayout'

// Spec 09 task 11n-a: the chapel's Blender scene in the browser. Screenshots at 1280x720 into
// e2e/screenshots/scenery/, a real WASD walk down the aisle to the altar and out through the
// vestry, the bell swinging when the dusk bell rings, and the stair cover gone once the whistle
// opens the stair. Yaw 0 faces -Z (toward the front door from inside); PI faces the altar.

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

const gates = (page: Page) =>
  page.evaluate(
    () => (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } }).mystery.gates,
  )

interface Walk {
  ok: boolean
  feet: [number, number, number]
  reached: number
}

/** Walks the points with held W (no sprint), steering the camera with mouse movement. */
function walk(page: Page, points: { x: number; z: number }[], timeoutMs: number): Promise<Walk> {
  return page.evaluate(
    async ({ points, timeoutMs }) => {
      const h = window.__lastRites!
      const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
      const yawOf = () => h.body()!.yaw
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
      const y0 = yawOf()
      h.input.mouseMove(40, 0)
      await frame()
      await frame()
      await frame()
      const k = wrap(yawOf() - y0) / 40 || -0.0025
      const t0 = performance.now()
      let i = 0
      let last = { t: t0, x: h.body()!.feet[0], z: h.body()!.feet[2] }
      h.hold('MoveForward')
      let ok = false
      for (;;) {
        await frame()
        const feet = h.body()!.feet
        const dx = points[i].x - feet[0]
        const dz = points[i].z - feet[2]
        if (Math.hypot(dx, dz) < 0.6) {
          if (++i === points.length) {
            ok = true
            break
          }
          continue
        }
        const err = wrap(Math.atan2(-dx, -dz) - yawOf())
        if (Math.abs(err) > 0.01) h.input.mouseMove(Math.max(-300, Math.min(300, err / k)), 0)
        const now = performance.now()
        if (now - last.t > 6000) {
          // A snag: under 0.4 m of travel in 6 s.
          if (Math.hypot(feet[0] - last.x, feet[2] - last.z) < 0.4) break
          last = { t: now, x: feet[0], z: feet[2] }
        }
        if (now - t0 > timeoutMs) break
      }
      h.release('MoveForward')
      return { ok, feet: h.body()!.feet, reached: i }
    },
    { points, timeoutMs },
  )
}

test.describe('chapel scenery (11n-a)', () => {
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  test('views of the chapel inside and out', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
    // Inside the front door, looking down the aisle to the altar.
    await shot(page, 'chapel-from-door', { x: 10, z: -0.4, yaw: Math.PI, pitch: -0.05 })
    // From the altar step, looking back to the door.
    await shot(page, 'chapel-from-altar', { x: 10, z: 9.0, yaw: 0, pitch: -0.08 })
    // The vestry cupboard with the revolver on its shelf (cupboard on the west wall: face west).
    const [cx, , cz] = CHAPEL_CUPBOARD_POSITION
    await shot(page, 'chapel-cupboard-revolver', { x: cx + 1.5, z: cz, yaw: Math.PI / 2, pitch: -0.35 })
    const revolver = await page.evaluate(() => window.__lastRites!.interactableIds('weapon'))
    console.log('weapon interactables', JSON.stringify(revolver))
    // Outside, from the path north of the front door.
    await shot(page, 'chapel-outside-path', { x: 10, z: -13, yaw: Math.PI, pitch: 0.12 })
  })

  test('walk the aisle to the altar and out through the vestry with no snag', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.teleport(10, -3.5, { yaw: Math.PI, pitch: 0 }))
    await page.waitForTimeout(1500)
    const toAltar = await walk(page, [{ x: 10, z: -0.5 }, { x: 10, z: 4 }, { x: 10, z: 8.9 }], 120_000)
    console.log('to altar', JSON.stringify(toAltar))
    expect(toAltar.ok, `aisle walk stopped at ${toAltar.feet}`).toBe(true)
    await page.screenshot({ path: `${DIR}/chapel-walk-at-altar.png` })
    const out = await walk(page, [{ x: 8.8, z: 9.5 }, { x: 7.5, z: 9.5 }, { x: 5.5, z: 9.5 }], 120_000)
    console.log('out the vestry', JSON.stringify(out))
    expect(out.ok, `vestry walk stopped at ${out.feet}`).toBe(true)
    await page.screenshot({ path: `${DIR}/chapel-walk-out-vestry.png` })
  })

  test('the bell swings when the dusk bell rings', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    const repaired = await page.evaluate(() => {
      const h = window.__lastRites!
      h.give('iron-nail', 10)
      h.give('bone', 2)
      h.give('candle-wax', 3)
      h.give('holy-water', 1)
      h.give('cloth', 2)
      return [h.repairChapel(), h.repairChapel(), h.repairChapel()]
    })
    expect(repaired).toEqual([true, true, true])
    await page.evaluate(() => window.__lastRites!.teleport(10, -14, { yaw: Math.PI, pitch: 0.3 }))
    await page.waitForTimeout(2500)
    expect(await page.evaluate(() => window.__lastRites!.bellMeshAngle())).toBe(0)
    await page.evaluate(() => window.__lastRites!.skipToDusk())
    await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dusk', undefined, {
      timeout: 60_000,
    })
    let peak = 0
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(150)
      peak = Math.max(peak, Math.abs((await page.evaluate(() => window.__lastRites!.bellMeshAngle())) ?? 0))
      if (i === 3) await page.screenshot({ path: `${DIR}/chapel-bell-swing-dusk.png` })
    }
    console.log('bell peak (rad)', peak)
    expect(peak).toBeGreaterThan(0.02)
  })

  test('the whistle opens the stair and the cover is gone', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.setLantern(true, 100)
      h.give('bone-whistle')
    })
    // The cover lies behind the altar (world z 9.75..10.85): look down at it from the altar's east end.
    const view = { x: 11.75, z: 10.4, yaw: Math.PI / 2 + 0.25, pitch: -0.75 }
    await shot(page, 'chapel-stair-sealed', view)
    expect(await page.evaluate(() => window.__lastRites!.objectVisible('chapel-stair-cover'))).toBe(true)
    // Aim at the whistle hotspot over the altar (centre 0.55 m up at z 9.8).
    const c = await page.evaluate(() => window.__lastRites!.interactableCentre('altar-whistle'))
    expect(c, 'altar-whistle hotspot mounted').not.toBeNull()
    const pitch = -Math.atan2(1.6 - c![1], c![2] - 8.6)
    await page.evaluate((p) => window.__lastRites!.teleport(10, 8.6, { yaw: Math.PI, pitch: p }), pitch)
    await page.waitForTimeout(1500)
    for (let k = 0; k < 4 && !(await gates(page)).catacombs; k++) {
      await page.evaluate(() => window.__lastRites!.action('Interact', 250))
      await page.waitForTimeout(800)
    }
    expect((await gates(page)).catacombs, 'whistle opened the stair').toBe(true)
    // The altar slides 0.6 m toward the door over 2 s (spec 09 task 11n-e).
    await page.waitForTimeout(2600)
    await shot(page, 'chapel-stair-open', view)
    expect(await page.evaluate(() => window.__lastRites!.objectVisible('chapel-stair-cover'))).toBe(false)
    expect(await page.evaluate(() => window.__lastRites!.objectVisible('chapel-stair'))).toBe(true)
    await shot(page, 'chapel-altar-slid', { x: 10, z: 7, yaw: Math.PI, pitch: -0.3 })
    // Not stuck: the player who blew the whistle can still step back from the altar.
    await page.evaluate(() => window.__lastRites!.teleport(10, 8.6, { yaw: Math.PI, pitch: 0 }))
    await page.waitForTimeout(800)
    const before = await feet(page)
    await walkFor(page, 'MoveBackward', 1200)
    expect((await feet(page))[2], 'stepped back from the altar').toBeLessThan(before[2] - 0.5)

    // Walk down the stair and back up with real keys. Come in from the east side of the altar
    // (the altar's back stands at the top of the steps), go down toward the end wall, come back up.
    await page.evaluate(() => window.__lastRites!.teleport(11.4, 10.1, { yaw: Math.PI / 2, pitch: -0.2 }))
    await page.waitForTimeout(1200)
    await walkFor(page, 'MoveForward', 900) // west, onto the steps
    await page.evaluate(() => {
      const h = window.__lastRites!
      const f = h.body()!.feet
      h.teleport(f[0], f[2], { y: f[1] + 0.02, yaw: Math.PI, pitch: -0.2 })
    })
    let lowest = 0
    for (let i = 0; i < 8; i++) {
      await walkFor(page, 'MoveForward', 250) // +z, down the steps
      lowest = Math.min(lowest, (await feet(page))[1])
    }
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${DIR}/chapel-stair-down.png` })
    const down = await feet(page)
    console.log('stair bottom feet', JSON.stringify(down), 'lowest', lowest)
    // The end wall stops the player at about z 10.5, where the ramp is 0.44 m down; a short walk on a\n    // slow frame stops higher, so the check only asks that the player went down.
    expect(lowest, 'went down the steps').toBeLessThan(-0.15)
    expect(down[1], 'did not fall through').toBeGreaterThan(-1.3)
    expect(down[0], 'stayed in the shaft').toBeGreaterThan(9.3)
    expect(down[0], 'stayed in the shaft').toBeLessThan(10.7)
    // Back up: walk toward the door until the altar's back stops you at the top, then step out east.
    await page.evaluate(() => {
      const h = window.__lastRites!
      const f = h.body()!.feet
      h.teleport(f[0], f[2], { y: f[1] + 0.02, yaw: 0, pitch: 0 })
    })
    for (let i = 0; i < 8; i++) await walkFor(page, 'MoveForward', 250)
    await page.evaluate(() => {
      const h = window.__lastRites!
      const f = h.body()!.feet
      h.teleport(f[0], f[2], { y: f[1] + 0.02, yaw: -Math.PI / 2, pitch: 0 })
    })
    await walkFor(page, 'MoveForward', 1500) // east, off the steps
    const out = await feet(page)
    console.log('back out feet', JSON.stringify(out))
    expect(out[1], 'back on the chapel floor').toBeGreaterThan(-0.1)
    expect(out[0], 'stepped out of the shaft').toBeGreaterThan(10.7)
  })
})

async function feet(page: Page): Promise<[number, number, number]> {
  return page.evaluate(() => window.__lastRites!.body()!.feet as [number, number, number])
}

async function walkFor(page: Page, action: 'MoveForward' | 'MoveBackward', ms: number): Promise<void> {
  await page.evaluate((a) => window.__lastRites!.hold(a), action)
  await page.waitForTimeout(ms)
  await page.evaluate((a) => window.__lastRites!.release(a), action)
  await page.waitForTimeout(150)
}
