import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 8.5 (Req 3.4, 3.6, 8.21): zombie look variants. Zombies with known uids are spawned
// through the Dev_Panel hooks (real enemy store). The pure `lookIndex(uid)` choice is asserted
// through the Debug_Hook. Where the model has look-N meshes, exactly one is visible and it is the
// chosen one; where it has none (the delivered zombie.glb today), only the base mesh is shown
// (Req 3.6). Screenshots at 1280x720 and 800x600 in e2e/screenshots/zombie-looks/.

const DIR = 'e2e/screenshots/zombie-looks'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]

type Looks = ReturnType<NonNullable<Window['__lastRites']>['zombieLooks']>
const looks = (page: Page): Promise<Looks> => page.evaluate(() => window.__lastRites!.zombieLooks())

async function startRun(page: Page): Promise<void> {
  await page.setViewportSize(SIZES[0])
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 30_000 })
}

/** Waits until every zombie has a model in the scene. */
async function modelsReady(page: Page, count: number): Promise<Looks> {
  await page.waitForFunction(
    (n) => {
      const l = window.__lastRites!.zombieLooks()
      return l.length >= n && l.every((z) => z.meshes !== null && z.meshes.length > 0)
    },
    count,
    { timeout: 30_000 },
  )
  return looks(page)
}

/** The mesh names this zombie shows, and whether its model carries look-N meshes at all. */
function describeLook(z: Looks[number]): { shown: string[]; hasLookMeshes: boolean } {
  const meshes = z.meshes ?? []
  return {
    shown: meshes.filter((m) => m.visible).map((m) => m.name),
    hasLookMeshes: meshes.some((m) => /^look-[0-3]$/.test(m.name)),
  }
}

test.describe('zombie looks', () => {
  test('a group shows all four looks, one body each, and a uid keeps its look', async ({ page }) => {
    test.setTimeout(180_000)
    await startRun(page)

    await page.evaluate(() => window.__lastRites!.spawnLookGroup())
    const group = await modelsReady(page, 4)

    // All four looks appear in the group (Req 3.4): the pure choice per uid.
    expect(group.map((z) => z.look).sort()).toEqual([0, 1, 2, 3])

    for (const z of group) {
      const { shown, hasLookMeshes } = describeLook(z)
      if (hasLookMeshes) {
        // Exactly one look mesh visible, and it is the chosen one.
        const visibleLooks = shown.filter((n) => n.startsWith('look-'))
        expect(visibleLooks, z.uid).toEqual([`look-${z.look}`])
      } else {
        // zombie.glb has no look-N meshes yet: the base mesh alone is shown (Req 3.6).
        expect(shown.length, z.uid).toBeGreaterThan(0)
        expect(shown.length, z.uid).toBe(z.meshes!.length)
        test.info().annotations.push({ type: 'note', description: 'model has no look-N meshes; base mesh only' })
      }
    }

    // The same uid gives the same look: spawn a known uid, remove it, spawn it again.
    const uid = 'look-check-7'
    await page.evaluate((u) => window.__lastRites!.spawnZombiesWithUids([u]), uid)
    const first = (await modelsReady(page, 5)).find((z) => z.uid === uid)!
    await page.evaluate(() => window.__lastRites!.killAll())
    await page.waitForFunction(() => window.__lastRites!.zombieLooks().length === 0, undefined, {
      timeout: 30_000,
    })
    await page.evaluate((u) => window.__lastRites!.spawnZombiesWithUids([u]), uid)
    const second = (await modelsReady(page, 1)).find((z) => z.uid === uid)!
    expect(second.look).toBe(first.look)
    expect(describeLook(second).shown).toEqual(describeLook(first).shown)
  })

  test('screenshots of a group', async ({ page }) => {
    test.setTimeout(180_000)
    await startRun(page)
    // Out of the hut, on the open grounds, so the group is not behind a wall.
    await page.evaluate(() => window.__lastRites!.teleport(-6, 12, { yaw: 0, pitch: 0 }))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__lastRites!.spawnLookGroup())
    await modelsReady(page, 4)
    await page.waitForTimeout(500)
    for (const size of SIZES) {
      await page.setViewportSize(size)
      await page.waitForTimeout(150)
      await page.screenshot({ path: `${DIR}/group-${size.width}x${size.height}.png` })
    }
  })
})
