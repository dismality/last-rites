import { test, expect, type Page } from '@playwright/test'

// Spec 09 task 11c: a cue (prompt, rune, outline, hand crosshair, targeting) shows only while
// pressing Interact would do something. Three real-input checks: a dug grave, a picked-up item and
// an examined clue.

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

/** Stand at (x, z), then turn to look at the mounted interactable `id`. */
async function aimAt(page: Page, id: string, x: number, z: number): Promise<void> {
  await page.evaluate((s) => window.__lastRites!.teleport(s.x, s.z), { x, z })
  await page.waitForFunction(
    (s) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - s.x, b.feet[2] - s.z) < 0.2
    },
    { x, z },
  )
  await page.waitForFunction((i) => window.__lastRites!.interactableCentre(i) !== null, id, { timeout: 30_000 })
  await page.evaluate(
    ({ id: i, x: sx, z: sz }) => {
      const h = window.__lastRites!
      const c = h.interactableCentre(i)!
      const eye = h.body()!.camera
      const yaw = Math.atan2(-(c[0] - eye[0]), -(c[2] - eye[2]))
      const pitch = Math.atan2(c[1] - eye[1], Math.hypot(c[0] - eye[0], c[2] - eye[2]))
      h.teleport(sx, sz, { yaw, pitch })
    },
    { id, x, z },
  )
}

const hoverId = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id ?? null)

test.describe('interaction cues never mislead', () => {
  test.setTimeout(300_000)

  test('a dug grave loses its cues and gets them back the next day', async ({ page }) => {
    await boot(page)
    const GRAVE = { id: 'grave-oak-hollow', x: -15, z: 12 }
    const id = `dig:${GRAVE.id}`
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.setLantern(false)
      h.equip(0)
    })
    await aimAt(page, id, GRAVE.x, GRAVE.z + 1.5)
    await page.waitForFunction((i) => window.__lastRites!.snapshot('hover') !== null && (window.__lastRites!.snapshot('hover') as { id: string }).id === i, id, {
      timeout: 30_000,
    })
    await expect(page.locator('.hud-prompt')).toContainText('Hold E: Dig')
    const before = await page.evaluate((i) => window.__lastRites!.interactableCue(i), id)
    expect(before).toMatchObject({ targetable: true, actionable: true, prompt: 'Hold E: Dig' })

    // Dig it for real.
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForFunction(
      (g) => {
        const d = window.__lastRites!.snapshot('dig') as { dugOnDay: Record<string, number> }
        return d.dugOnDay[g] !== undefined
      },
      GRAVE.id,
      { timeout: 200_000 },
    )
    await page.evaluate(() => window.__lastRites!.release('Interact'))

    // Used up: not targetable, no hover, no prompt, rune faded out.
    await page.waitForFunction((i) => window.__lastRites!.interactableCue(i)?.targetable === false, id)
    await page.waitForFunction((i) => (window.__lastRites!.interactableCue(i)?.runeOpacity ?? 1) < 0.01, id, {
      timeout: 10_000,
    })
    expect(await hoverId(page)).toBeNull()
    await expect(page.locator('.hud-prompt:not(.hud-prompt--fading)')).toHaveCount(0, { timeout: 5_000 })
    await expect(page.locator('.hud-crosshair[data-interactable="true"]')).toHaveCount(0)
    const spent = await page.evaluate((i) => window.__lastRites!.interactableCue(i), id)
    expect(spent).toMatchObject({ targetable: false, prompt: null, pulse: false, fading: true })

    // The next day refills the grave and the cues come back.
    await page.evaluate(() => window.__lastRites!.setClock({ phase: 'day', night: 2, phaseTime: 1 }))
    await page.waitForFunction((i) => window.__lastRites!.interactableCue(i)?.targetable === true, id)
    await page.waitForFunction((i) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === i, id, {
      timeout: 30_000,
    })
    await expect(page.locator('.hud-prompt')).toContainText('Hold E: Dig')
  })

  test('a picked-up item fades and stops being targeted', async ({ page }) => {
    await boot(page)
    const stacks = (await page.evaluate(
      () =>
        (window.__lastRites!.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } })
          .world.materials['hut-shelf'],
    )) as { item: string }[]
    expect(stacks.some((s) => s.item === 'lamp-oil')).toBe(true)
    // Clear the other stacks first so nothing slides into the oil's place when it is taken and
    // the crosshair is left on empty shelf.
    const others = stacks.filter((s) => s.item !== 'lamp-oil').length
    await page.evaluate(
      (n) => {
        const h = window.__lastRites!
        for (let k = 0; k < n; k++) {
          const shelf = (h.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } }).world
            .materials['hut-shelf']
          h.collectMaterial('hut-shelf', shelf.findIndex((s) => s.item !== 'lamp-oil'))
        }
      },
      others,
    )
    const index = 0
    const id = `pickup:hut-shelf:${index}`
    await aimAt(page, id, 0.9, -1)
    await page.waitForFunction((i) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === i, id, {
      timeout: 15_000,
    })
    await expect(page.locator('.hud-prompt')).toContainText('E: Take')
    const before = await page.evaluate((i) => window.__lastRites!.interactableCue(i), id)
    expect(before!.bodyMeshes).toBeGreaterThan(0)

    // Sample the cue every 16 ms while a real E press takes the item.
    const run = await page.evaluate(async (i) => {
      const h = window.__lastRites!
      const ghost = `${i}~gone`
      const samples: Array<{ t: number; alpha: number | null; targetable: boolean | null; hover: string | null; body: number | null; rune: number | null; fadingPrompt: boolean }> = []
      const t0 = performance.now()
      const timer = setInterval(() => {
        const c = h.interactableCue(ghost)
        samples.push({
          t: performance.now() - t0,
          alpha: c ? c.alpha : null,
          targetable: c ? c.targetable : null,
          hover: (h.snapshot('hover') as { id: string } | null)?.id ?? null,
          body: c ? c.bodyMeshes : null,
          rune: c ? c.runeOpacity : null,
          fadingPrompt: document.querySelector('.hud-prompt--fading') !== null,
        })
      }, 16)
      // Held for 600 ms so a slow software-rendered frame cannot miss the key.
      h.hold('Interact')
      await new Promise((r) => setTimeout(r, 600))
      h.release('Interact')
      await new Promise((r) => setTimeout(r, 1800))
      clearInterval(timer)
      return samples
    }, id)

    const ghosts = run.filter((s) => s.alpha !== null)
    expect(ghosts.length, 'the taken item lingers while it fades').toBeGreaterThan(0)
    expect(ghosts.every((s) => s.targetable === false)).toBe(true)
    // Steady, never rising.
    for (let k = 1; k < ghosts.length; k++) expect(ghosts[k].alpha!).toBeLessThanOrEqual(ghosts[k - 1].alpha! + 1e-9)
    // The fading ghost is never hovered, its rune and meshes end at zero, and the prompt fades.
    expect(run.some((s) => s.hover?.endsWith('~gone'))).toBe(false)
    const last = ghosts[ghosts.length - 1]
    // Software rendering runs at a few frames per second, so the last sampled frame may sit a
    // little short of zero; the ghost is dropped just after the 0.5 s fade.
    expect(Math.min(...ghosts.map((s) => s.alpha!))).toBeLessThan(0.3)
    expect(last.alpha!).toBeLessThan(0.3)
    expect(last.rune!).toBeLessThan(0.3)
    expect(run.some((s) => s.fadingPrompt), 'the prompt fades instead of cutting').toBe(true)
    // Once the ghost has been dropped nothing is mounted under its id: the item is gone.
    expect(await page.evaluate((i) => window.__lastRites!.interactableCue(`${i}~gone`), id)).toBeNull()
    // The stack beside it slides into its place (a different item may be hovered now), but the
    // lamp oil is no longer lying on the shelf.
    const shelf = (await page.evaluate(
      () =>
        (window.__lastRites!.snapshot('spawn') as { world: { materials: Record<string, { item: string }[]> } })
          .world.materials['hut-shelf'],
    )) as { item: string }[]
    expect(shelf.some((s) => s.item === 'lamp-oil')).toBe(false)
    const inv = (await page.evaluate(() => window.__lastRites!.snapshot('inventory'))) as {
      inventory: { slots: { item: string }[] }
    }
    expect(inv.inventory.slots.some((s) => s.item === 'lamp-oil')).toBe(true)
  })

  test('an examined clue loses its cues and says it went to the journal', async ({ page }) => {
    await boot(page)
    const id = 'clue-clue-hut-boots'
    await aimAt(page, id, -2.2, 3.1)
    await page.waitForFunction((i) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === i, id, {
      timeout: 30_000,
    })
    await expect(page.locator('.hud-prompt')).toContainText('E: Examine')

    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    await expect(page.locator('.hud-toast')).toContainText('Added to your journal (J)', { timeout: 10_000 })
    await page.waitForFunction((i) => window.__lastRites!.interactableCue(i)?.targetable === false, id)
    await page.waitForFunction((i) => (window.__lastRites!.interactableCue(i)?.runeOpacity ?? 1) < 0.01, id, {
      timeout: 10_000,
    })
    await page.waitForFunction((i) => (window.__lastRites!.interactableCue(i)?.bodyMeshes ?? 0) === 0, id, {
      timeout: 10_000,
    })
    expect(await hoverId(page)).toBeNull()
    await expect(page.locator('.hud-prompt:not(.hud-prompt--fading)')).toHaveCount(0, { timeout: 5_000 })
  })
})
