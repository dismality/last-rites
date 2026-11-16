import { test, expect, type Page } from '@playwright/test'
import type { ItemId } from '../src/game/types'

// Spec 10 task 10.4 (Req 27.1, 27.4, 27.6): tiered crafting at the real workbench, in real Chrome.
// The bench opens with a held Interact; the Iron Head (a component) and then the Tier 2 Sharpened
// Shovel are crafted with real Craft clicks, on the game's own 1.5 s timer. The satchel is set
// through the app's own inventory store (as in crafting-bench.spec), and Tier 2 is unlocked by the
// real stage 1 dawn unlock.

const SHOTS = 'e2e/screenshots'
type Slot = { item: ItemId; qty: number }

async function startRun(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

async function openBench(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(() => window.__lastRites!.teleport(0, -0.9, { yaw: 0, pitch: -0.65 }))
    await page.waitForFunction(
      () => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'workbench',
      undefined,
      { timeout: 20_000 },
    )
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    const open = await page.evaluate(
      () => (window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen,
    )
    if (open) return
  }
  throw new Error('the workbench did not open')
}

async function setSatchel(page: Page, slots: Slot[], hotbar: (ItemId | null)[] = [null, null, null, null]): Promise<void> {
  await page.evaluate(
    async ({ slots, hotbar }) => {
      const m = await import(/* @vite-ignore */ '/src/game/state/inventoryStore.ts')
      const inv = m.useInventoryStore.getState().inventory
      m.useInventoryStore.getState().setInventory({ ...inv, slots, hotbar } as typeof inv)
    },
    { slots, hotbar },
  )
}

const slots = (page: Page) =>
  page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/inventoryStore.ts')
    return m.useInventoryStore.getState().inventory.slots as Slot[]
  })
const count = (s: Slot[], id: string) => s.filter((x) => x.item === id).reduce((a, x) => a + x.qty, 0)
const entry = (page: Page, name: string) =>
  page.locator('.recipe-entry').filter({ has: page.locator('.recipe-entry__name', { hasText: new RegExp(`^${name}$`) }) })

test('craft the Iron Head, then the Tier 2 Sharpened Shovel at the workbench', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })
  await startRun(page)
  await page.evaluate(async () => {
    const unlock = await import(/* @vite-ignore */ '/src/game/state/caseSolvedWatcher.ts')
    unlock.unlockStageRecipes(1) // stage 1 dawn: Tier 2 and its components
  })
  // Everything for both crafts: 2 nails + 1 plank for the head, then 2 nails + 1 plank + 2 cloth
  // and the rusty shovel for the Tier 2 shovel.
  await setSatchel(
    page,
    [
      { item: 'rusty-shovel', qty: 1 },
      { item: 'iron-nail', qty: 4 },
      { item: 'wood-plank', qty: 2 },
      { item: 'cloth', qty: 2 },
    ],
    ['rusty-shovel', null, null, null],
  )
  await openBench(page)

  // The book groups by tier and tags each recipe (Req 27.1, 27.4).
  const heads = page.getByTestId('tier-head')
  await expect(heads.first()).toHaveText('Tier 1 · Stage 1')
  await expect(heads.filter({ hasText: 'Tier 2' })).toHaveCount(1)
  const shovel = entry(page, 'Sharpened Shovel')
  await expect(shovel.locator('.recipe-entry__tier')).toHaveText('Tier 2')
  // The shovel waits on its component, and says so.
  await expect(shovel).not.toHaveClass(/recipe-entry--craftable/)
  await expect(shovel.getByTestId('tier-note')).toHaveText('Needs component: Iron Head (craft it first)')
  await shovel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/tiered-crafting-needs-component-1280x720.png` })

  // 1. The Iron Head, with a real click.
  const head = entry(page, 'Iron Head')
  await head.scrollIntoViewIfNeeded()
  await head.getByRole('button', { name: 'Craft Iron Head', exact: true }).click()
  await expect.poll(async () => count(await slots(page), 'iron-head'), { timeout: 8_000 }).toBe(1)
  let s = await slots(page)
  expect(count(s, 'iron-nail')).toBe(2)
  expect(count(s, 'wood-plank')).toBe(1)

  // 2. The Tier 2 Sharpened Shovel: the component and its materials go, the tool is upgraded.
  await expect(shovel).toHaveClass(/recipe-entry--craftable/)
  await expect(shovel.getByTestId('tier-note')).toHaveCount(0)
  await shovel.scrollIntoViewIfNeeded()
  await shovel.getByRole('button', { name: 'Craft Sharpened Shovel', exact: true }).click()
  await expect.poll(async () => count(await slots(page), 'sharpened-shovel'), { timeout: 8_000 }).toBe(1)
  s = await slots(page)
  for (const gone of ['iron-head', 'iron-nail', 'wood-plank', 'cloth', 'rusty-shovel']) expect(count(s, gone), gone).toBe(0)
  await page.screenshot({ path: `${SHOTS}/tiered-crafting-done-1280x720.png` })
  expect(errors).toEqual([])
})
