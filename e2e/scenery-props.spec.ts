import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Spec 09 task 11n-d: every swapped prop seen in place at 1280x720 (e2e/screenshots/scenery/).
// The camera stands a few metres from each prop and looks at it; yaw 0 faces -Z, PI/2 faces -X.

const DIR = 'e2e/screenshots/scenery'

type View = { file: string; target: [number, number, number]; from: [number, number]; pitch?: number }

async function startRun(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 })
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

/** Rendered frames, so a teleport has drawn before the shot. */
async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count
        const step = () => (--left <= 0 ? done() : requestAnimationFrame(step))
        requestAnimationFrame(step)
      }),
    n,
  )
}

async function look(page: Page, v: View): Promise<void> {
  const [tx, ty, tz] = v.target
  const [px, pz] = v.from
  const yaw = Math.atan2(-(tx - px), -(tz - pz))
  const flat = Math.hypot(tx - px, tz - pz)
  const pitch = v.pitch ?? Math.atan2(ty - 1.6, flat)
  await page.evaluate((s) => window.__lastRites!.teleport(s.px, s.pz, { yaw: s.yaw, pitch: s.pitch }), { px, pz, yaw, pitch })
  await frames(page, 90)
  await page.screenshot({ path: `${DIR}/${v.file}.png` })
}

test.describe('swapped props in place (11n-d)', () => {
  test.beforeAll(() => mkdirSync(DIR, { recursive: true }))

  test('day props: statue, scare door, mounds, weapon rests and clue props', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)

    // Each weapon rest is mounted with its prop (the group stays when the weapon is taken).
    for (const id of ['wood-axe', 'shotgun', 'silver-sabre']) {
      expect(await page.evaluate((n) => window.__lastRites!.objectVisible(n), `weapon-pickup:${id}`), id).toBe(true)
    }
    const clues = await page.evaluate(() => window.__lastRites!.interactableIds('clue-clue-'))
    expect(clues.length).toBe(9)
    const mounds = await page.evaluate(() => window.__lastRites!.interactableIds('dig'))
    expect(mounds.length).toBeGreaterThan(0)
    const mound = await page.evaluate((id) => window.__lastRites!.interactableCentre(id), mounds[0])
    expect(mound).not.toBeNull()

    const views: View[] = [
      { file: 'prop-statue-oak-path', target: [-12, 1, -17], from: [-12, -13.5] },
      { file: 'prop-scare-door', target: [-21.8, 1.1, -51], from: [-19.6, -49.5] },
      { file: 'prop-grave-mound', target: [mound![0], 0.2, mound![2]], from: [mound![0] + 2.5, mound![2] + 2.5] },
      { file: 'prop-woodpile-axe', target: [-5, 0.5, 2], from: [-7.8, 4.4] },
      { file: 'prop-lodge-table-shotgun', target: [-23.8, 0.85, -41.5], from: [-23.8, -40.6] },
      { file: 'prop-sabre-plinth', target: [-18.9, 0.5, -59.3], from: [-18.9, -56.8] },
      { file: 'prop-clue-ledger-week', target: [7.6, 1, -4], from: [7.6, -1.6] },
      { file: 'prop-clue-row-statues', target: [-18.9, 0.6, -30], from: [-18.9, -27.6] },
      { file: 'prop-clue-empty-graves', target: [12.5, 0.1, -20.5], from: [12.5, -18.3] },
    ]
    for (const v of views) await look(page, v)

    // Dig the first mound for real (shovel in hand, hold Interact on it), then look at the open grave.
    await look(page, { file: 'prop-grave-mound-close', target: [mound![0], mound![1], mound![2]], from: [mound![0] + 1.2, mound![2] + 1.2] })
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForTimeout(6000)
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    await frames(page, 30)
    await look(page, { file: 'prop-grave-dug', target: [mound![0], 0, mound![2]], from: [mound![0] + 2.5, mound![2] + 2.5] })
  })

  test('night and dawn props: lamp post, merchant cart', async ({ page }) => {
    test.setTimeout(400_000)
    await startRun(page)
    await page.evaluate(() => window.__lastRites!.skipToNight(1))
    await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
    await page.evaluate(() => window.__lastRites!.killAll())
    await look(page, { file: 'prop-lamp-post-night', target: [4.8, 2, -3.5], from: [6.6, 0.8] })

    await page.evaluate(() => window.__lastRites!.skipToDawn())
    await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase !== 'night')
    await frames(page, 30)
    // Dawn waits for a boon; pick the first (key 1), then Silas stands at his cart for the
    // first part of the new day.
    await page.getByText('Choose a boon').waitFor({ timeout: 60_000 })
    await page.keyboard.press('Digit1')
    await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'day', undefined, {
      timeout: 60_000,
    })
    await page.waitForFunction(() => window.__lastRites!.interactableCentre('merchant') !== null, undefined, { timeout: 30_000 })
    await frames(page, 30)
    await look(page, { file: 'prop-merchant-cart', target: [-9, 1, 37], from: [-6, 33] })
  })
})