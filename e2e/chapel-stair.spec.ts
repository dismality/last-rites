import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { zoneAt } from '../src/game/systems/zoneAt'

// Spec 09 task 11n-f: the chapel stair never traps the player and leads to the catacombs.
// Whistle at the altar (the player stands right against it), the altar slides without jitter or
// landing on the player, both sides of the altar reach the stair, going about three steps down
// fades to black and arrives in the catacomb corridor, the corridor gate leads back out, and
// Continue restores a save made in the catacombs. Screenshots at 1280x720 in e2e/screenshots/stair/.
// World coordinates: chapel centre (10, 5); altar trigger at z 9.5; stair opening x 9.35..10.65, z 9.75..10.85.

const DIR = 'e2e/screenshots/stair'

type Feet = [number, number, number]

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
  await page.evaluate(() => {
    window.__lastRites!.keepAlive(true)
    window.__lastRites!.setLantern(true, 100)
  })
}

const feet = (page: Page) => page.evaluate(() => window.__lastRites!.body()!.feet as Feet)
const gates = (page: Page) =>
  page.evaluate(
    () => (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } }).mystery.gates,
  )

async function walkFor(page: Page, action: 'MoveForward' | 'MoveBackward' | 'MoveLeft' | 'MoveRight', ms: number): Promise<void> {
  await page.evaluate((a) => window.__lastRites!.hold(a), action)
  await page.waitForTimeout(ms)
  await page.evaluate((a) => window.__lastRites!.release(a), action)
  await page.waitForTimeout(150)
}

/** Holds ction until done(feet) is true or maxMs pass (frame rates in headless Chrome vary). */
async function walkUntil(page: Page, action: 'MoveForward' | 'MoveBackward' | 'MoveLeft' | 'MoveRight', done: (f: Feet) => boolean, maxMs = 8000): Promise<Feet> {
  await page.evaluate((a) => window.__lastRites!.hold(a), action)
  const t0 = Date.now()
  let f = await feet(page)
  while (!done(f) && Date.now() - t0 < maxMs) {
    await page.waitForTimeout(60)
    f = await feet(page)
  }
  await page.evaluate((a) => window.__lastRites!.release(a), action)
  await page.waitForTimeout(150)
  return feet(page)
}

/** Opens the stair with the whistle from `from`, as the player does: aim at the altar hotspot and press E. */
async function blowWhistle(page: Page, from: { x: number; z: number }): Promise<void> {
  await page.evaluate(() => window.__lastRites!.give('bone-whistle'))
  const c = await page.evaluate(() => window.__lastRites!.interactableCentre('altar-whistle'))
  expect(c, 'altar-whistle hotspot mounted').not.toBeNull()
  const pitch = -Math.atan2(1.6 - c![1], c![2] - from.z)
  await page.evaluate(
    (a) => window.__lastRites!.teleport(a.x, a.z, { yaw: Math.PI, pitch: a.pitch }),
    { ...from, pitch },
  )
  await page.waitForTimeout(1500)
  for (let k = 0; k < 4 && !(await gates(page)).catacombs; k++) {
    await page.evaluate(() => window.__lastRites!.action('Interact', 250))
    await page.waitForTimeout(800)
  }
  expect((await gates(page)).catacombs, 'whistle opened the stair').toBe(true)
}

/** Samples the fade's opacity every frame in the page, from now on (window.__fadePeak). */
async function watchFade(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __fadePeak: number }
    w.__fadePeak = 0
    const tick = () => {
      const el = document.querySelector<HTMLElement>('.descent-fade')
      if (el) w.__fadePeak = Math.max(w.__fadePeak, Number(el.style.opacity))
      requestAnimationFrame(tick)
    }
    tick()
  })
}
const fadePeak = (page: Page) => page.evaluate(() => (window as unknown as { __fadePeak: number }).__fadePeak)

/** Turns on the spot to face +z (down the stair) without moving; skipped once the descent has begun. */
async function faceStair(page: Page): Promise<void> {
  if ((await fadePeak(page)) > 0) return
  const f = await feet(page)
  await page.evaluate((p) => window.__lastRites!.teleport(p[0], p[2], { y: p[1] + 0.02, yaw: Math.PI, pitch: -0.2 }), f)
  await page.waitForTimeout(500)
}

/** Holds forward (+z) until the player is in the catacomb corridor; checks the screen went black on the way. */
async function descend(page: Page, shotName?: string): Promise<Feet> {
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  let f = await feet(page)
  for (let i = 0; i < 120 && zoneAt(f[0], f[2]) !== 'catacombs'; i++) {
    await page.waitForTimeout(50)
    const o = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.descent-fade')
      return el ? Number(el.style.opacity) : 0
    })
    if (shotName && o > 0.3 && o < 0.95) {
      await page.screenshot({ path: `${DIR}/${shotName}-1280x720.png` })
      shotName = undefined
    }
    f = await feet(page)
  }
  const darkest = await fadePeak(page)
  console.log('descend ended at', JSON.stringify(f), 'darkest', darkest)
  expect(darkest, 'the screen went black').toBe(1)
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  await page.waitForTimeout(2500) // the fade back in
  return feet(page)
}

test.describe('chapel stair (11n-f)', () => {
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  test('whistle against the altar: the altar slides, never stuck or jittering, never on the player', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    // Right against the altar's front face: its collider starts at world z 9.5, the capsule is 0.35.
    await blowWhistle(page, { x: 10, z: 9.1 })
    const zs: number[] = []
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(100)
      zs.push((await feet(page))[2])
    }
    console.log('player z during the slide', zs.map((z) => z.toFixed(2)).join(' '))
    await page.screenshot({ path: `${DIR}/altar-slid-1280x720.png` })
    for (let i = 1; i < zs.length; i++) {
      // Pushed toward the door, never back into the altar, and no jitter beyond a hair.
      expect(zs[i], `step ${i}`).toBeLessThanOrEqual(zs[i - 1] + 0.01)
    }
    expect(zs[zs.length - 1], 'ahead of the slid altar (front face 8.9)').toBeLessThan(8.9 - 0.3)
    // Free to move afterwards.
    const before = await feet(page)
    await walkFor(page, 'MoveBackward', 800)
    expect((await feet(page))[2]).toBeLessThan(before[2] - 0.3)
  })

  for (const side of ['left', 'right'] as const) {
    test(`walk round the ${side} of the altar, down the stair and arrive in the catacombs`, async ({ page }) => {
      test.setTimeout(400_000)
      await startRun(page)
      await blowWhistle(page, { x: 10, z: 9.1 })
      await page.waitForTimeout(2600)
      await watchFade(page)
      // Round the altar with real keys: strafe out to the side, forward past it, strafe back to the stair.
      // Facing +z (yaw PI), the player's left is +x.
      const out = side === 'left' ? 'MoveLeft' : 'MoveRight'
      const back = side === 'left' ? 'MoveRight' : 'MoveLeft'
      await page.evaluate(() => window.__lastRites!.teleport(10, 8.4, { yaw: Math.PI, pitch: -0.1 }))
      await page.waitForTimeout(600)
      // Strafe out past the altar's end (x 8.85 or 11.15 is the altar edge 0.95 plus the capsule), then forward.
      const edge = side === 'left' ? (f: Feet) => f[0] > 11.4 : (f: Feet) => f[0] < 8.6
      await walkUntil(page, out, edge)
      const behind = await walkUntil(page, 'MoveForward', (f) => f[2] > 10.3)
      console.log(side, 'behind the altar', JSON.stringify(behind))
      expect(behind[2], 'got past the altar').toBeGreaterThan(9.9)
      await page.screenshot({ path: `${DIR}/walk-${side}-1280x720.png` })
      const inOpening = await walkUntil(page, back, (f) => Math.abs(f[0] - 10) < 0.3) // into the opening
      console.log(side, 'in the opening', JSON.stringify(inOpening))
      await faceStair(page)
      const arrived = await descend(page, side === 'left' ? 'descent-fading' : undefined)
      console.log(side, 'arrived', JSON.stringify(arrived))
      expect(zoneAt(arrived[0], arrived[2])).toBe('catacombs')
      expect(Math.abs(arrived[0] - 25)).toBeLessThan(1.2)
      expect(arrived[1], 'on the corridor floor').toBeGreaterThan(-0.1)
      expect(arrived[2], 'inside the corridor, near the gate').toBeLessThan(44)
      await page.screenshot({ path: `${DIR}/catacombs-arrival-${side}-1280x720.png` })
    })
  }

  test('walk back out through the corridor gate; Continue from a save made in the catacombs', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await blowWhistle(page, { x: 10, z: 9.1 })
    await page.waitForTimeout(2600)
    await watchFade(page)
    await page.evaluate(() => window.__lastRites!.teleport(8.6, 9.2, { yaw: Math.PI, pitch: -0.1 }))
    await page.waitForTimeout(600)
    await walkUntil(page, 'MoveForward', (f) => f[2] > 10.3)
    await page.evaluate(() => window.__lastRites!.teleport(9.9, 10.1, { yaw: Math.PI, pitch: -0.2 }))
    await page.waitForTimeout(600)
    const arrived = await descend(page)
    expect(zoneAt(arrived[0], arrived[2])).toBe('catacombs')
    // Out through the gate: the corridor mouth at z 40; face -z (yaw 0) and walk.
    await page.evaluate((p) => window.__lastRites!.teleport(p[0], p[2], { yaw: 0, pitch: 0 }), arrived)
    await page.waitForTimeout(600)
    await walkFor(page, 'MoveForward', 2200)
    const out = await feet(page)
    console.log('out through the gate', JSON.stringify(out))
    expect(out[2], 'through the gate onto the grounds').toBeLessThan(39.5)
    await page.screenshot({ path: `${DIR}/corridor-gate-out-1280x720.png` })
    // A save made in the catacombs: Continue puts the player back in the corridor.
    await page.evaluate(() => window.__lastRites!.teleport(25, 45, { yaw: 0, pitch: 0 }))
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => window.__lastRites!.saveGame())).toBe(true)
    await page.evaluate(() => window.__lastRites!.teleport(0, 0, { yaw: 0, pitch: 0 }))
    await page.waitForTimeout(600)
    expect(await page.evaluate(() => window.__lastRites!.continueGame())).toBe(true)
    await page.waitForTimeout(1500)
    const loaded = await feet(page)
    expect(Math.hypot(loaded[0] - 25, loaded[2] - 45)).toBeLessThan(0.5)
    expect(zoneAt(loaded[0], loaded[2])).toBe('catacombs')
    await page.screenshot({ path: `${DIR}/continue-in-catacombs-1280x720.png` })
  })
})
