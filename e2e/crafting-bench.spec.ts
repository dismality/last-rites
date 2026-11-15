import { test, expect, type Page } from '@playwright/test'
import { RECIPES } from '../src/data/recipes'
import { ITEM_MAP } from '../src/data/items'
import type { ItemId } from '../src/game/types'
// Spec 09 task 24.2 (D2): crafting and the workbench in real Chrome.
//
// Real: the bench is opened with a held Interact on the hovered bench, every recipe is crafted
// with a click on its Craft button, the 1.5 s timer is the game's own frame loop, a hit is the
// real damage path (hook.hurt), the upgrade is a real Buy click, the weapon pickups are the real
// pickup action, and the unlocks are the real store actions (stage dawn, journal page, pickup).
// Not real: the satchel is set to exactly a recipe's inputs before each craft (through the app's
// own inventory store, imported into the page from the dev server), because 12 satchel slots
// cannot hold every ingredient and every output at once.
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

/** Replaces the satchel (and hotbar) through the app's own inventory store. */
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

const readInv = (page: Page) =>
  page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/inventoryStore.ts')
    const inv = m.useInventoryStore.getState().inventory
    return { slots: inv.slots as Slot[], hotbar: inv.hotbar as (string | null)[] }
  })

const progress = (page: Page) =>
  page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/craftingStore.ts')
    return m.useCraftingStore.getState().craftingProgress
  })

const nameOf = (id: ItemId) => ITEM_MAP[id]?.name ?? id
const count = (slots: Slot[], id: string) => slots.filter((s) => s.item === id).reduce((a, s) => a + s.qty, 0)
const entryFor = (page: Page, id: ItemId) =>
  page.locator('.recipe-entry').filter({ has: page.getByRole('button', { name: `Craft ${nameOf(id)}`, exact: true }) })

test('D2: every recipe crafts in 1.5 s at the bench, a hit cancels, upgrades and consumables work', async ({ page }) => {
  test.setTimeout(420_000)
  await startRun(page)
  await openBench(page)
  await page.waitForTimeout(500)

  // --- Unlocks: four at the start, the rest through the real events -------------------------
  await expect(page.locator('.recipe-entry--locked')).toHaveCount(RECIPES.length - 4)
  await page.evaluate(async () => {
    const h = window.__lastRites!
    const unlock = await import(/* @vite-ignore */ '/src/game/state/caseSolvedWatcher.ts')
    const crafting = await import(/* @vite-ignore */ '/src/game/state/craftingStore.ts')
    unlock.unlockStageRecipes(1) // stage 1 dawn: shovel, flask, lantern trap
    unlock.unlockStageRecipes(2) // stage 2 dawn: nail bomb, blessed rounds
    crafting.useCraftingStore.getState().applyUnlockEvent({ type: 'journalRead', page: 3 })
    h.takePickup('revolver')
    h.takePickup('shotgun')
  })
  await expect(page.locator('.recipe-entry--locked')).toHaveCount(0)
  await expect(page.locator('.recipe-book__list > .recipe-entry')).toHaveCount(RECIPES.length)
  await page.waitForTimeout(300)

  // --- Every recipe -------------------------------------------------------------------------
  const timings: string[] = []
  for (const r of RECIPES) {
    const out = r.output.item
    const inputs: Slot[] = r.inputs.map((i) => ({ item: i.item, qty: i.qty }))
    if (r.consumesTool) inputs.push({ item: r.consumesTool, qty: 1 })
    const hotbar: (ItemId | null)[] = [r.consumesTool ?? null, null, null, null]

    // One short of the first input: not craftable, no rune, no Craft button.
    const short = inputs.map((s, i) => (i === 0 ? { ...s, qty: s.qty - 1 } : s)).filter((s) => s.qty > 0)
    await setSatchel(page, short, hotbar)
    await expect(page.getByRole('button', { name: `Craft ${nameOf(out)}`, exact: true })).toHaveCount(0)

    // Exactly enough: craftable, with the rune and the Craft button.
    await setSatchel(page, inputs, hotbar)
    const entry = entryFor(page, out)
    await expect(entry, `${r.id} entry`).toHaveCount(1)
    await expect(entry).toHaveClass(/recipe-entry--craftable/)
    await expect(entry.locator('.recipe-entry__rune')).toBeVisible()

    // Hover pulses the matching bench piles through the highlight set.
    await entry.hover()
    const lit = await page.evaluate(async () => {
      const m = await import(/* @vite-ignore */ '/src/game/state/craftingStore.ts')
      return [...m.useCraftingStore.getState().highlightedItems] as string[]
    })
    for (const i of r.inputs) expect(lit, `${r.id} highlight`).toContain(i.item)

    // Timed inside the page, from the store change that starts the craft to the one that ends it.
    await page.evaluate(async () => {
      const m = await import(/* @vite-ignore */ '/src/game/state/craftingStore.ts')
      const w = window as unknown as { __craftMs?: number }
      w.__craftMs = undefined
      let t0 = 0
      const off = m.useCraftingStore.subscribe((s, prev) => {
        if (!prev.craftingProgress && s.craftingProgress) t0 = performance.now()
        if (prev.craftingProgress && !s.craftingProgress) {
          w.__craftMs = performance.now() - t0
          off()
        }
      })
    })
    await entry.getByRole('button', { name: `Craft ${nameOf(out)}`, exact: true }).click()
    await expect.poll(() => progress(page), { timeout: 5_000 }).not.toBeNull()
    await expect.poll(() => progress(page), { timeout: 8_000 }).toBeNull()
    const took = await page.evaluate(() => (window as unknown as { __craftMs: number }).__craftMs)
    timings.push(`${r.id}=${Math.round(took)}ms`)
    expect(took, `${r.id} duration`).toBeGreaterThanOrEqual(1400)
    expect(took, `${r.id} duration`).toBeLessThan(2500)

    const after = await readInv(page)
    expect(count(after.slots, out), `${r.id} output`).toBe(r.output.qty)
    for (const i of r.inputs) if (i.item !== out) expect(count(after.slots, i.item), `${r.id} ${i.item} left`).toBe(0)
    if (r.consumesTool) {
      expect(count(after.slots, r.consumesTool), `${r.id} tool consumed`).toBe(0)
      expect(after.hotbar[0], `${r.id} keeps its hotbar slot`).toBe(out)
    }
  }
  console.log('craft timings', timings.join(' '))

  // --- A hit cancels and consumes nothing ---------------------------------------------------
  await setSatchel(page, [{ item: 'cloth', qty: 2 }])
  await entryFor(page, 'bandage').getByRole('button', { name: 'Craft Bandage' }).click()
  await expect.poll(() => progress(page)).not.toBeNull()
  await page.waitForTimeout(500)
  await page.evaluate(() => window.__lastRites!.hurt(5))
  await expect.poll(() => progress(page), { timeout: 3_000 }).toBeNull()
  await page.waitForTimeout(1500)
  const cancelled = await readInv(page)
  expect(count(cancelled.slots, 'cloth')).toBe(2)
  expect(count(cancelled.slots, 'bandage')).toBe(0)

  // --- A full satchel says so instead of failing silently -----------------------------------
  const fillers: ItemId[] = ['bone', 'candle-wax', 'lamp-oil', 'iron-nail', 'holy-water', 'grave-salt', 'black-powder', 'lead-shot', 'silver-filings', 'wood-plank']
  await setSatchel(page, [
    { item: 'rusty-shovel', qty: 1 },
    ...fillers.map((item) => ({ item, qty: 1 })),
    { item: 'cloth', qty: 3 },
  ])
  await entryFor(page, 'bandage').getByRole('button', { name: 'Craft Bandage' }).click()
  await expect(page.locator('.hud-toast')).toContainText('Satchel full', { timeout: 6_000 })
  const full = await readInv(page)
  expect(count(full.slots, 'cloth')).toBe(3)
  expect(count(full.slots, 'bandage')).toBe(0)
  await page.screenshot({ path: `${SHOTS}/crafting-satchel-full-1280x720.png` })

  // --- Upgrades tab: the revolver is owned, so Larger Cylinder is offered --------------------
  await setSatchel(page, [
    { item: 'revolver', qty: 1 },
    { item: 'iron-nail', qty: 4 },
    { item: 'lead-shot', qty: 2 },
  ])
  await page.getByRole('button', { name: 'Upgrades', exact: true }).click()
  const card = page.locator('.recipe-entry', { hasText: 'Larger Cylinder' })
  await expect(card).toContainText('6 → 8')
  await expect(card).toContainText('4 iron nails')
  await page.screenshot({ path: `${SHOTS}/crafting-upgrades-1280x720.png` })
  await card.getByRole('button', { name: /Buy Larger Cylinder/ }).click()
  await expect(card).toContainText('Bought')
  const bought = await readInv(page)
  expect(count(bought.slots, 'iron-nail')).toBe(0)
  expect(count(bought.slots, 'lead-shot')).toBe(0)
  expect((await page.evaluate(() => window.__lastRites!.snapshot('combat') as { upgrades: string[] })).upgrades).toContain('up-revolver-cylinder')

  // --- Durability: the tools made above start at their full durability ----------------------
  await page.getByRole('button', { name: 'Recipes', exact: true }).click()
  await setSatchel(page, [{ item: 'bone-club', qty: 1 }, { item: 'sharpened-shovel', qty: 1 }], ['bone-club', 'sharpened-shovel', null, null])
  await expect
    .poll(async () => (await page.evaluate(() => window.__lastRites!.snapshot('combat') as { durability: Record<string, number> })).durability, { timeout: 5_000 })
    .toMatchObject({ 'bone-club': 30, 'sharpened-shovel': 50 })

  // --- Consumable: a crafted bandage heals 30 -----------------------------------------------
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => (window.__lastRites!.snapshot('uiWorld') as { workbenchOpen: boolean }).workbenchOpen)).toBe(false)
  await setSatchel(page, [{ item: 'bandage', qty: 1 }], ['bandage', null, null, null])
  await page.evaluate(() => {
    window.__lastRites!.equip(0)
    window.__lastRites!.hurt(40)
  })
  const hp = () => page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)
  const before = await hp()
  expect(before).toBeLessThanOrEqual(60)
  expect(await page.evaluate(() => window.__lastRites!.consumeHeld())).toBe(true)
  await expect.poll(hp, { timeout: 6_000 }).toBe(before + 30)
  expect(count((await readInv(page)).slots, 'bandage')).toBe(0)
})
