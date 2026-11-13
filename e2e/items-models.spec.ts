import { mkdirSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 11k: every item is drawn with its Blender model. Each model is seen at its spot,
// under the crosshair (targetable, with the 11c prompt), and screenshotted to e2e/screenshots/items/.

const SHOTS = 'e2e/screenshots/items'
mkdirSync(SHOTS, { recursive: true })

const MATERIALS = [
  'bone',
  'iron-nail',
  'candle-wax',
  'holy-water',
  'cloth',
  'lamp-oil',
  'grave-salt',
  'wood-plank',
  'black-powder',
  'lead-shot',
  'silver-filings',
] as const

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

/** Stand at (x, z), then turn to look at the centre of the mounted interactable `id`. */
async function aimAt(page: Page, id: string, x: number, z: number): Promise<[number, number]> {
  await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z), { x, z })
  await page.waitForFunction(
    (s) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - s.x, b.feet[2] - s.z) < 0.2
    },
    { x, z },
  )
  await page.waitForFunction((i) => window.__lastRites!.interactableCentre(i) !== null, id, { timeout: 30_000 })
  return page.evaluate(
    ({ id: i, x: sx, z: sz }) => {
      const h = window.__lastRites!
      const c = h.interactableCentre(i)!
      const eye = h.body()!.camera
      const yaw = Math.atan2(-(c[0] - eye[0]), -(c[2] - eye[2]))
      const pitch = Math.atan2(c[1] - eye[1], Math.hypot(c[0] - eye[0], c[2] - eye[2]))
      h.teleport(sx, sz, { yaw, pitch })
      return [yaw, pitch] as [number, number]
    },
    { id, x, z },
  )
}

/**
 * The centre of a thin or crossed model (a bone, an axe) can be empty air, so nudge the aim around
 * it until the crosshair is on a mesh. The hover still comes from the game's own raycast.
 */
async function sweepUntilHovered(
  page: Page,
  id: string,
  x: number,
  z: number,
  yaw: number,
  pitch: number,
): Promise<void> {
  const NUDGES = [0, 0.025, -0.025, 0.05, -0.05, 0.08, -0.08]
  for (const dp of NUDGES) {
    for (const dy of NUDGES) {
      await page.evaluate((a) => window.__lastRites!.teleport(a.x, a.z, { yaw: a.yaw, pitch: a.pitch }), {
        x,
        z,
        yaw: yaw + dy,
        pitch: pitch + dp,
      })
      await page.waitForTimeout(120)
      const hovered = await page.evaluate(
        (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
        id,
      )
      if (hovered) return
    }
  }
  throw new Error('no hover after sweeping')
}

/** Looks at `id` from (x, z), expects the crosshair to land on it, and saves a screenshot. */
async function seen(page: Page, id: string, x: number, z: number, shot: string): Promise<void> {
  const [yaw, pitch] = await aimAt(page, id, x, z)
  try {
    await sweepUntilHovered(page, id, x, z, yaw, pitch)
  } catch (e) {
    const got = await page.evaluate((i) => ({
      hover: window.__lastRites!.snapshot('hover'),
      body: window.__lastRites!.body(),
      cue: window.__lastRites!.interactableCue(i),
      centre: window.__lastRites!.interactableCentre(i),
      world: window.__lastRites!.snapshot('world'),
    }), id)
    await page.screenshot({ path: `${SHOTS}/FAILED-${shot}.png` })
    throw new Error(`crosshair is not on ${id}: ${JSON.stringify(got)}`, { cause: e })
  }
  const cue = await page.evaluate((i) => window.__lastRites!.interactableCue(i), id)
  expect(cue, id).toMatchObject({ targetable: true })
  // Let the rune and the frame settle, then keep the hover outline in the shot.
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${shot}.png` })
}

test.describe('items use their Blender models', () => {
  test.setTimeout(300_000)

  test('each material lies on the ground as its model and can be targeted', async ({ page }) => {
    await boot(page)
    const SPOT = { id: 'grounds-coffin-east', x: 28, z: -12 }
    await page.evaluate(
      (s) => {
        const h = window.__lastRites!
        h.setSpawnStacks(s.id, s.items)
      },
      { id: SPOT.id, items: [...MATERIALS] },
    )
    for (const [i, item] of MATERIALS.entries()) {
      const id = `pickup:${SPOT.id}:${i}`
      await seen(page, id, SPOT.x + i * 0.35, SPOT.z + 1.1, `material-${item}`)
      // The group carries the item's name and at least one mesh: the model, not nothing.
      expect(await page.evaluate((n) => window.__lastRites!.meshesUnder(n), item), item).toBeGreaterThan(0)
    }
  })

  test('the journal page and the oil in the hut', async ({ page }) => {
    await boot(page)
    const STAND = { x: 0.9, z: -1 }
    await seen(page, 'fixed:fx-page-1', STAND.x, STAND.z, 'journal-page-hut')
    const stacks = (await page.evaluate(
      () =>
        (window.__lastRites!.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } })
          .world.materials['hut-shelf'],
    )) as { item: string }[]
    const oil = stacks.findIndex((s) => s.item === 'lamp-oil')
    expect(oil).toBeGreaterThanOrEqual(0)
    await seen(page, `pickup:hut-shelf:${oil}`, STAND.x, STAND.z, 'lamp-oil-hut')
  })

  test('each weapon pickup lies on its prop as its model', async ({ page }) => {
    await boot(page)
    const SPOTS = [
      { id: 'wood-axe', x: -5, z: 3.3 },
      { id: 'revolver', x: 9.2, z: 7.6 },
      { id: 'shotgun', x: -23.8, z: -40.2 },
      { id: 'silver-sabre', x: -18.9, z: -58.1 },
    ] as const
    for (const s of SPOTS) await seen(page, `weapon:${s.id}`, s.x, s.z, `pickup-${s.id}`)
  })

  test('each held weapon is its model, clear of the camera at 1280x720 and 800x600', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.setClock({ phase: 'day', phaseTime: 10 })
      h.teleport(0, 12, { yaw: 0, pitch: 0 })
    })
    const HELD = ['rusty-shovel', 'sharpened-shovel', 'bone-club', 'wood-axe', 'silver-sabre', 'revolver', 'shotgun'] as const
    for (const id of HELD) {
      await page.evaluate((item) => {
        const h = window.__lastRites!
        h.give(item, 1, 0)
        h.equip(0)
      }, id)
      for (const size of [
        { width: 1280, height: 720 },
        { width: 800, height: 600 },
      ]) {
        await page.setViewportSize(size)
        await page.waitForTimeout(900)
        await page.screenshot({ path: `${SHOTS}/held-${id}-${size.width}x${size.height}.png` })
      }
    }
  })
})
