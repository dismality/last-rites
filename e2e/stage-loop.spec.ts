import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 1.7: the stage loop in real Chrome. Day has no zombies; a Story night keeps
// spawning waves; the dev "solve current case" ends it, living zombies collapse and dawn plays;
// Retry Night and Continue keep the Stage. State is read back through the dev-only Debug_Hook and
// waits are counted in rendered frames or polled state, never fixed wall-clock sleeps.

interface StageSnap {
  stage: number
  caseSolved: boolean
  nightElapsed: number
}
interface WaveSnap {
  phase: string
  waveIndex: number
  spawned: number
  stage?: number
}
interface WorldSnap {
  phase: string
  nightNumber: number
  phaseTime: number
}
interface EnemySnap {
  uid: string
  state: string
  hp: number
  type: string
}

const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const world = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
const waves = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('wave') as { waves: WaveSnap }).waves)
const enemies = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('enemies') as EnemySnap[])

/** Waits for `n` rendered frames. */
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

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  return errors
}

async function intoNight(page: Page, n: number): Promise<void> {
  await page.evaluate((k) => window.__lastRites!.skipToDusk(k), n)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate((k) => window.__lastRites!.skipToNight(k), n)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night')
}

test('stage 1: no zombies by day, endless night, solve collapses them, dawn plays', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)

  // Day: no zombies of any kind.
  expect((await world(page)).phase).toBe('day')
  expect((await stage(page)).stage).toBe(1)
  await frames(page, 120)
  expect(await enemies(page)).toHaveLength(0)

  await intoNight(page, 1)
  // Night: wave 1 spawns, and the night does not end by clearing: killing it brings wave 2 after the gap.
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0, undefined, {
    timeout: 60_000,
  })
  expect((await waves(page)).stage).toBe(1)
  expect((await waves(page)).phase).toBe('active')
  await page.waitForFunction(
    () => {
      window.__lastRites!.killAll()
      return (window.__lastRites!.snapshot('wave') as { waves: { waveIndex: number } }).waves.waveIndex >= 1
    },
    undefined,
    { timeout: 120_000, polling: 250 },
  )
  const w = await waves(page)
  expect(w.phase).not.toBe('done')
  expect((await world(page)).phase).toBe('night')
  expect((await stage(page)).caseSolved).toBe(false)

  // Let the next wave spawn, then solve the case: spawning stops, the living collapse, dawn begins.
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('enemies') as { state: string }[]).some((e) => e.state !== 'dying'),
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => window.__lastRites!.solveCurrentCase())
  expect((await stage(page)).caseSolved).toBe(true)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn', undefined, {
    timeout: 30_000,
  })
  expect((await waves(page)).phase).toBe('done')
  // Collapsed zombies fade out and leave; none are left standing.
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0,
    undefined,
    { timeout: 30_000 },
  )
  const log = await page.evaluate(() => window.__lastRites!.events().map((e) => e.type))
  expect(log).toContain('nightCleared')
  expect(log).toContain('dawnStarted')

  expect(errors).toEqual([])
})

test('Retry Night and Continue keep the Stage', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)

  // Skip to stage 2 (start of its day), then into its night.
  await page.evaluate(() => window.__lastRites!.skipToStage(2))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 2)
  expect((await world(page)).phase).toBe('day')
  await frames(page, 60)
  expect(await enemies(page)).toHaveLength(0)
  await intoNight(page, 2)
  expect((await stage(page)).stage).toBe(2)

  // Die, then Retry Night: back at dusk of the same stage, case unsolved.
  await page.evaluate(() => window.__lastRites!.keepAlive(false))
  await page.evaluate(() => window.__lastRites!.hurt(10_000))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('game') as { taken: boolean }).taken)
  await page.evaluate(() => window.__lastRites!.retryNight())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  let s = await stage(page)
  expect(s.stage).toBe(2)
  expect(s.caseSolved).toBe(false)
  expect((await world(page)).nightNumber).toBe(2)

  // Continue: save in stage 2, move to stage 3, then Continue restores stage 2.
  expect(await page.evaluate(() => window.__lastRites!.saveGame())).toBe(true)
  // setClock moves the night number without a phase change, so the new-day autosave stays quiet.
  await page.evaluate(() => window.__lastRites!.setClock({ night: 3 }))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 3)
  expect(await page.evaluate(() => window.__lastRites!.continueGame())).toBe(true)
  await frames(page, 30)
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 2, undefined, { timeout: 5_000 })
  s = await stage(page)
  expect(s.stage).toBe(2)
  expect((await world(page)).nightNumber).toBe(2)

  expect(errors).toEqual([])
})
