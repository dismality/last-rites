import { test, expect, type Page } from '@playwright/test'
import { DEAD_NAMES } from '../src/data/cases'
import { WAVE_GRAVES } from '../src/data/waves'
import { glowingGrave } from '../src/game/systems/nameTheDead'

// Spec 10 task 11.3 (Req 28.6): Name the Dead in real Chrome. A Stage 2 night lights one grave
// with a name; the keeper walks up to it and holds the real E key for 3 s. The grave is sealed
// for the wave and the score rises by 100. A grave whose name no evidence gives is refused.
// The run seed is chosen here (with the game's own pure pick) so the first wave's name is known.

const SHOTS = 'e2e/screenshots'

type Snap = {
  glow: { graveId: string; name: string; wave: number; x: number; z: number } | null
  sealed: { graveId: string; wave: number } | null
  progress: number
  sealedCount: number
  score: number
}

/** A seed whose first Stage 2 wave lights a grave with a known-able name (or a stranger's). */
function seedFor(stranger: boolean): { seed: number; name: string } {
  for (let seed = 1; seed < 5000; seed++) {
    const g = glowingGrave(seed, 2, 0, WAVE_GRAVES)!
    const def = DEAD_NAMES.find((n) => n.name === g.name)!
    if ((def.clues.length === 0) === stranger) return { seed, name: g.name }
  }
  throw new Error('no seed')
}

const snap = (page: Page) => page.evaluate(() => window.__lastRites!.nameTheDead() as Snap)

/** Stage 2, its night begun for real (the clock is put just before dusk). */
async function stageTwoNight(page: Page, seed: number): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(async (s) => {
    const h = window.__lastRites!
    h.skipToStage(2)
    const p = await import(/* @vite-ignore */ '/src/game/state/progressionStore.ts')
    p.useProgressionStore.setState({ seed: s })
    h.skipToDusk()
  }, seed)
  await page.waitForFunction(() => window.__lastRites!.nameTheDead().glow !== null, undefined, { timeout: 60_000 })
}

/** Stands 1.6 m south of the glowing grave, looking down at it, until it is the hovered target. */
async function faceGrave(page: Page, g: { graveId: string; x: number; z: number }): Promise<void> {
  await page.evaluate(({ x, z }) => window.__lastRites!.teleport(x, z + 1.6, { yaw: 0, pitch: -0.6 }), g)
  await page.waitForFunction(
    (id) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === `name:${id}`,
    g.graveId,
    { timeout: 20_000 },
  )
}

test('hold E at the glowing grave: the name is spoken, the grave sealed and 100 scored', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })
  const { seed, name } = seedFor(false)
  await stageTwoNight(page, seed)

  const s0 = await snap(page)
  expect(s0.glow!.name).toBe(name)
  expect(s0.glow!.wave).toBe(0)
  // The label carries the rune and the name, not colour alone (Req 28.5).
  const label = page.getByTestId('named-grave-label')
  await expect(label).toContainText(name)
  await expect(label).toContainText('ᛞ')

  // The keeper has found the evidence that names this grave.
  const clue = DEAD_NAMES.find((n) => n.name === name)!.clues[0]
  await page.evaluate((id) => window.__lastRites!.giveClue(id), clue)

  await faceGrave(page, s0.glow!)
  await page.evaluate(() => window.__lastRites!.killAll())
  await page.waitForTimeout(300)
  const before = (await snap(page)).score

  // The real key, held: the ring and its caption show while the name is spoken.
  await page.keyboard.down('KeyE')
  await expect(page.getByTestId('name-hold')).toContainText(`Naming ${name}`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/name-the-dead-hold-1280x720.png` })
  await expect.poll(async () => (await snap(page)).sealed, { timeout: 6_000 }).toEqual({
    graveId: s0.glow!.graveId,
    wave: 0,
  })
  await page.keyboard.up('KeyE')

  const after = await snap(page)
  expect(after.sealedCount).toBe(1)
  expect(after.score - before).toBe(100)
  await expect(page.getByText(`[a name, spoken: ${name}]`)).toBeVisible()
  await expect(label).toHaveAttribute('data-sealed', 'true')
  await page.screenshot({ path: `${SHOTS}/name-the-dead-sealed-1280x720.png` })
  expect(errors).toEqual([])
})

test("a name no evidence gives is refused: \"You don't know who lies here.\"", async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  const { seed } = seedFor(true)
  await stageTwoNight(page, seed)
  const s0 = await snap(page)
  await faceGrave(page, s0.glow!)
  await page.evaluate(() => window.__lastRites!.killAll())
  const before = (await snap(page)).score
  await page.keyboard.down('KeyE')
  await expect(page.getByText("You don't know who lies here.")).toBeVisible()
  await page.waitForTimeout(3500)
  await page.keyboard.up('KeyE')
  const after = await snap(page)
  expect(after.sealed).toBeNull()
  expect(after.sealedCount).toBe(0)
  expect(after.score).toBe(before)
})
