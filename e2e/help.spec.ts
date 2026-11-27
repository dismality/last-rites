import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 10 task 7.3 (Req 24.1-24.8): help for stuck players and judges, in real Chrome.
// - A new game in Developer mode from the real mode select (keyboard only) reaches the first
//   Minigame within 3 minutes of pressing Begin; the time is logged. (Playtest 2026-11-28: the
//   menu offers Normal and Developer mode only; both play Normal.)
// - Its day lasts the Normal 6 minutes.
// - After 2 minutes of day play without a clue the lantern flame leans toward the nearest unfound
//   clue, to the side it lies on.
// - The dawn card shows the next case's clue count (screenshot pair).
// The dev hook only positions the keeper, moves the clock and reads state.

const SHOTS = 'e2e/screenshots'
const LOGS = 'e2e/logs'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const

interface WorldSnap {
  phase: string
  phaseTime: number
  nightNumber: number
}
interface Hunch {
  sinceClueS: number
  found: number
  target: string | null
  at: number[] | null
}

const world = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
const hunch = (page: Page) => page.evaluate(() => window.__lastRites!.hunch() as Hunch)
const skew = async (page: Page) => Number(await page.locator('.lantern-gauge').getAttribute('data-hunch-skew'))

function frames(page: Page, n: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0
        const step = () => (++i < count ? requestAnimationFrame(step) : resolve())
        requestAnimationFrame(step)
      }),
    n,
  )
}

/** Walks to a prop (teleport is positioning only), aims at it and uses it with a real E press. */
async function useProp(page: Page, id: string): Promise<void> {
  const c = await page.evaluate((i) => window.__lastRites!.interactableCentre(i), id)
  expect(c, `${id} is mounted`).not.toBeNull()
  const [cx, cy, cz] = c!
  const stands = [
    [0, 1.2],
    [0, -1.2],
    [1.2, 0],
    [-1.2, 0],
    [0.9, 0.9],
    [-0.9, -0.9],
  ]
  const shell = page.locator('.minigame-shell')
  for (const [dx, dz] of [...stands, ...stands]) {
    if ((await shell.count()) > 0) break
    const x = cx + dx
    const z = cz + dz
    await page.evaluate(([px, pz]) => window.__lastRites!.teleport(px, pz), [x, z])
    await page.waitForFunction(
      ([px, pz]) => {
        const b = window.__lastRites!.body()
        return b !== null && Math.hypot(b.feet[0] - px, b.feet[2] - pz) < 0.3
      },
      [x, z],
    )
    const eye = (await page.evaluate(() => window.__lastRites!.body()!.camera)) as number[]
    const yaw = Math.atan2(-(cx - eye[0]), -(cz - eye[2]))
    const pitch = Math.atan2(cy - eye[1], Math.hypot(cx - eye[0], cz - eye[2]))
    await page.evaluate(([px, pz, y, p]) => window.__lastRites!.teleport(px, pz, { yaw: y, pitch: p }), [x, z, yaw, pitch])
    try {
      await page.waitForFunction(
        (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
        id,
        { timeout: 2_500 },
      )
    } catch {
      continue
    }
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(600)
    await page.keyboard.up('KeyE')
    await frames(page, 20)
  }
  await expect(shell, `E at ${id} opens its Minigame`).toBeVisible()
}

/** Title -> New Game -> Developer mode (arrow keys) -> Begin (Enter) -> intro skipped (Enter). */
async function beginDeveloperMode(page: Page): Promise<{ errors: string[]; begun: number }> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.setScreen('title'))
  await page.getByRole('button', { name: 'New Game' }).click()
  const radio = page.getByRole('radio', { name: /Developer mode/ })
  await expect(radio).toBeVisible()
  await page.getByRole('radio', { checked: true }).focus()
  for (let i = 0; i < 4 && !(await radio.isChecked()); i++) await page.keyboard.press('ArrowDown')
  await expect(radio).toBeChecked()
  await expect(page.getByText('The same game as Normal')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused()
  const begun = Date.now()
  await page.keyboard.press('Enter')
  // The intro plays for a story mode; Enter skips it like a player would.
  await page.waitForTimeout(800)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string; phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  expect(await page.evaluate(() => (window.__lastRites!.snapshot('progression') as { mode: string }).mode)).toBe('normal')
  return { errors, begun }
}

test('Developer mode from the mode select: the first Minigame within 3 minutes, and a 6-minute day', async ({ page }) => {
  test.setTimeout(240_000)
  const { errors, begun } = await beginDeveloperMode(page)
  const spawn = (await page.evaluate(() => window.__lastRites!.body()!.feet)) as number[]
  const shelf = (await page.evaluate(() => window.__lastRites!.interactableCentre('ledger-shelf')))!

  // The test positions the keeper, so the walk is estimated as in case1.spec: straight-line metres
  // from the spawn at walking speed (3.0 m/s, design bible §6), added to the measured time.
  await useProp(page, 'ledger-shelf')
  const wall = (Date.now() - begun) / 1000
  const gameSeconds = (await world(page)).phaseTime
  const metres = Math.hypot(shelf[0] - spawn[0], shelf[2] - spawn[2])
  const walkSeconds = metres / 3.0
  mkdirSync(LOGS, { recursive: true })
  writeFileSync(
    `${LOGS}/first-minigame.json`,
    JSON.stringify(
      { mode: 'normal', wallSecondsFromBegin: wall, gameSecondsIntoDay: gameSeconds, spawnToShelfMetres: metres, walkSeconds, limitSeconds: 180 },
      null,
      2,
    ),
  )
  console.log(
    `[help] Developer mode: first Minigame open ${wall.toFixed(1)} s after Begin (${gameSeconds.toFixed(1)} s into the day); ` +
      `walk from spawn ${metres.toFixed(1)} m = ${walkSeconds.toFixed(1)} s`,
  )
  expect(wall + walkSeconds).toBeLessThan(180)
  await expect(page.getByRole('dialog', { name: 'The parish ledger' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // The Normal day is 360 s: at 350 s dusk is still to come, at 355 s it arrives within seconds.
  await page.evaluate(() => window.__lastRites!.setClock({ phaseTime: 350 }))
  await page.waitForTimeout(1000)
  expect((await world(page)).phase).toBe('day')
  await page.evaluate(() => window.__lastRites!.setClock({ phaseTime: 355 }))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk', undefined, {
    timeout: 20_000,
  })
  expect(errors).toEqual([])
})

test("keeper's hunch: after 2 minutes without a clue the flame leans toward the nearest unfound clue", async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('short-vigil'))
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.waitForFunction(() => (window.__lastRites!.hunch() as Hunch).sinceClueS > 1)

  // Before two minutes: no hunch, the flame stands straight.
  expect((await hunch(page)).target).toBeNull()
  await expect.poll(() => skew(page)).toBe(0)

  // Two minutes of day play without a clue (the Dev_Panel's "Skip 2 minutes without a clue").
  await page.evaluate(() => window.__lastRites!.skipHunch(120))
  await expect.poll(async () => (await hunch(page)).target).not.toBeNull()
  const at = (await hunch(page)).at!

  // Stand 8 m west of the clue facing north: it is on the right, so the flame leans right.
  await page.evaluate(([x, z]) => window.__lastRites!.teleport(x - 8, z, { yaw: 0, pitch: 0 }), [at[0], at[2]])
  await expect.poll(() => skew(page), { timeout: 5_000 }).toBeGreaterThan(10)
  await frames(page, 10)
  await page.locator('.lantern-gauge').screenshot({ path: `${SHOTS}/hunch-flame-right.png` })
  // Facing south from the same spot, it is on the left.
  await page.evaluate(([x, z]) => window.__lastRites!.teleport(x - 8, z, { yaw: Math.PI, pitch: 0 }), [at[0], at[2]])
  await expect.poll(() => skew(page), { timeout: 5_000 }).toBeLessThan(-10)

  // A new clue ends the hunch and the flame straightens.
  await page.evaluate(() => window.__lastRites!.solveCurrentMinigame())
  await expect.poll(async () => (await hunch(page)).target).toBeNull()
  await expect.poll(() => skew(page), { timeout: 5_000 }).toBe(0)
  expect(errors).toEqual([])
})

test('the dawn card shows the next case\'s clue count', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('short-vigil'))
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.evaluate(() => window.__lastRites!.skipToDawn())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn', undefined, {
    timeout: 30_000,
  })
  const row = page.getByTestId('dawn-clues')
  await expect(row).toBeVisible()
  await expect(row).toHaveText(/^Clues found \(The Resurrection Men\): \d+\/\d+$/)
  // Dawn lasts 10 s: hold the clock at its start while both sizes are taken.
  await page.evaluate(() => window.__lastRites!.setClock({ phaseTime: 0.5 }))
  for (const s of SIZES) {
    await page.setViewportSize(s)
    await page.evaluate(() => window.__lastRites!.setClock({ phaseTime: 0.5 }))
    await frames(page, 10)
    await expect(row).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/dawn-card-clues-${s.width}x${s.height}.png` })
  }
  expect(errors).toEqual([])
})
