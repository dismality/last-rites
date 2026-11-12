import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { CHAPEL_DOORS } from '../src/data/cemeteryLayout'
import { MERCHANT_SPOT } from '../src/data/merchant'
import { CLUE_SPOTS } from '../src/data/tombstones'
import { WAVE_GRAVES } from '../src/data/waves'
import { DEFAULT_GRAPH, findPath, nearestNode } from '../src/game/systems/navigation'
import { CRANE_CRYPT_STEP } from '../src/data/cemeteryLayout'

// Spec 09 task 11i: the graveyard scene must not wall off the game. Real WASD walks (through the
// input module, steering with mouse movement) from the hut to every gameplay destination, following
// the zombie waypoint graph and finishing straight to the spot. A leg passes when the body ends up
// within 1.5 m. A blocked leg reports where it stalled and the colliders there (collidersNear).
// Headless Chrome renders on SwiftShader, so the sim runs slowly; legs have generous timeouts.

const HUT_START = { x: 0, z: 0 }
const ARRIVE_M = 1.5

interface Dest {
  name: string
  x: number
  z: number
}

const grounds = CLUE_SPOTS.filter((c) => ['clue-hut-boots', 'clue-empty-graves', 'clue-west-hill-glint', 'clue-ledger-week'].includes(c.clueId))
const DESTS: Dest[] = [
  { name: 'row-mouth', x: -20, z: -37 },
  { name: 'crane step', x: CRANE_CRYPT_STEP[0], z: CRANE_CRYPT_STEP[2] + 1.2 },
  { name: 'cat-mouth', x: 25, z: 37 },
  { name: 'merchant', x: MERCHANT_SPOT.silas[0] + 1.6, z: MERCHANT_SPOT.silas[2] },
  { name: 'chapel front door', x: CHAPEL_DOORS.front.standPoint[0], z: CHAPEL_DOORS.front.standPoint[2] },
  { name: 'chapel vestry door', x: CHAPEL_DOORS.vestry.standPoint[0], z: CHAPEL_DOORS.vestry.standPoint[2] },
  ...WAVE_GRAVES.map((g) => ({ name: `wave grave ${g.id}`, x: g.x, z: g.z })),
  ...grounds.map((c) => ({ name: `clue ${c.clueId}`, x: c.position[0], z: c.position[2] })),
]

/** Waypoint route from the hut to a destination: graph nodes, then the spot itself. */
function route(d: Dest): { x: number; z: number }[] {
  const from = nearestNode(DEFAULT_GRAPH, HUT_START)!
  const to = nearestNode(DEFAULT_GRAPH, { x: d.x, z: d.z })!
  const ids = findPath(DEFAULT_GRAPH, from, to) ?? []
  return [...ids.map((id) => DEFAULT_GRAPH.nodes.get(id)!), { x: d.x, z: d.z }]
}

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
}

interface Walk {
  ok: boolean
  feet: [number, number, number]
  distance: number
  stuckAt: { x: number; z: number } | null
  seconds: number
}

/** Walks the route with held W + Shift, steering the camera with mouse movement. */
function walk(page: Page, points: { x: number; z: number }[], timeoutMs: number): Promise<Walk> {
  return page.evaluate(
    async ({ points, timeoutMs, arrive }) => {
      const h = window.__lastRites!
      const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
      const yawOf = () => h.body()!.yaw
      // Calibrate radians per mouse unit: one nudge, read the change two frames later.
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
      const y0 = yawOf()
      h.input.mouseMove(40, 0)
      await frame()
      await frame()
      await frame()
      const k = wrap(yawOf() - y0) / 40 || -0.0025
      const t0 = performance.now()
      let i = 0
      let lastCheck = { t: t0, x: h.body()!.feet[0], z: h.body()!.feet[2] }
      h.hold('MoveForward')
      h.hold('Sprint')
      let result: Walk | null = null
      while (!result) {
        await frame()
        const feet = h.body()!.feet
        const target = points[i]
        const dx = target.x - feet[0]
        const dz = target.z - feet[2]
        const d = Math.hypot(dx, dz)
        const last = i === points.length - 1
        if (d < (last ? arrive - 0.3 : 1.2)) {
          if (last) {
            result = { ok: true, feet, distance: d, stuckAt: null, seconds: (performance.now() - t0) / 1000 }
            break
          }
          i++
          continue
        }
        const want = Math.atan2(-dx, -dz)
        const err = wrap(want - yawOf())
        if (Math.abs(err) > 0.01) h.input.mouseMove(Math.max(-300, Math.min(300, err / k)), 0)
        const now = performance.now()
        if (now - lastCheck.t > 10_000) {
          if (Math.hypot(feet[0] - lastCheck.x, feet[2] - lastCheck.z) < 0.5) {
            result = {
              ok: false,
              feet,
              distance: Math.hypot(points[points.length - 1].x - feet[0], points[points.length - 1].z - feet[2]),
              stuckAt: { x: feet[0], z: feet[2] },
              seconds: (now - t0) / 1000,
            }
            break
          }
          lastCheck = { t: now, x: feet[0], z: feet[2] }
        }
        if (now - t0 > timeoutMs) {
          result = {
            ok: false,
            feet,
            distance: Math.hypot(points[points.length - 1].x - feet[0], points[points.length - 1].z - feet[2]),
            stuckAt: null,
            seconds: (now - t0) / 1000,
          }
        }
      }
      h.release('MoveForward')
      h.release('Sprint')
      return result
    },
    { points, timeoutMs, arrive: ARRIVE_M },
  )
}

test('walk from the hut to every destination', async ({ page }) => {
  test.setTimeout(3_000_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  // The Row gate is locked until the key is used on it (the real Interact path). Open it first, so
  // the crane step leg tests the graveyard and not the gate bars.
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('rusted-crypt-key')
    h.teleport(-20, -38.4, { yaw: 0, pitch: 0 })
  })
  await page.waitForTimeout(1500)
  for (let k = 0; k < 4; k++) {
    await page.evaluate(() => window.__lastRites!.action('Interact', 250))
    await page.waitForTimeout(700)
    const gates = await page.evaluate(
      () => (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } }).mystery.gates,
    )
    if (gates['mausoleum-row']) break
  }
  const report: Record<string, unknown>[] = []
  const gateOpen = await page.evaluate(
    () => (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } }).mystery.gates,
  )
  expect(gateOpen['mausoleum-row'], 'Row gate opened with the key').toBe(true)
  for (const d of DESTS.filter((x) => process.env.ONLY_LEG === undefined || x.name === process.env.ONLY_LEG)) {
    await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z, { yaw: 0 }), HUT_START)
    await page.waitForTimeout(600)
    const w = await walk(page, route(d), 150_000)
    let near: unknown = null
    if (!w.ok) {
      near = await page.evaluate(
        ({ x, z }) =>
          window.__lastRites!
            .collidersNear(x, z, 2.5)
            .filter((c) => c.halfExtents === null || c.halfExtents[0] < 20)
            .map((c) => ({ owner: c.owner, shape: c.shape, at: c.translation, half: c.halfExtents, rotY: c.rotationY })),
        w.stuckAt ?? { x: w.feet[0], z: w.feet[2] },
      )
    }
    const line = {
      dest: d.name,
      target: [d.x, d.z],
      ok: w.ok,
      endsAt: w.feet.map((v) => Math.round(v * 100) / 100),
      distance: Math.round(w.distance * 100) / 100,
      seconds: Math.round(w.seconds * 10) / 10,
      stuckAt: w.stuckAt,
      near,
    }
    report.push(line)
    console.log(JSON.stringify(line))
  }
  mkdirSync('e2e/logs', { recursive: true })
  writeFileSync('e2e/logs/graveyard-walk.json', JSON.stringify(report, null, 2))
  expect(report.filter((r) => !r.ok).map((r) => r.dest)).toEqual([])
})

test('screenshots of the new graveyard', async ({ page }) => {
  test.setTimeout(400_000)
  await startRun(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  mkdirSync('e2e/screenshots', { recursive: true })
  const shots = [
    // Hut door, looking north-west across the grounds.
    { file: 'graveyard-hut-nw', x: 0, z: 6.2, yaw: Math.PI / 4, pitch: -0.05 },
    // Mausoleum Row from its gate, looking up the avenue.
    { file: 'graveyard-row-gate', x: -20, z: -35.5, yaw: 0, pitch: 0 },
    // The south grounds from the chapel vestry, looking south-west.
    { file: 'graveyard-south-vestry', x: 5.5, z: 9.5, yaw: 2.6, pitch: -0.05 },
  ]
  for (const s of shots) {
    await page.evaluate((v) => window.__lastRites!.teleport(v.x, v.z, { yaw: v.yaw, pitch: v.pitch }), s)
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `e2e/screenshots/${s.file}.png` })
  }
})
