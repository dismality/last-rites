import { test, expect, type Page } from '@playwright/test'
import { SPAWN_POINTS } from '../src/data/zones'
import { LOOT_TABLE_MAP } from '../src/data/lootTables'

// Spec 09 task 24.3 (D3): digging and material spawns in real Chrome.
//
// Real: the dig is a held Interact on the hovered mound through the game's input module and fixed
// step; moving away is the real teleport; pickups are the real collectMaterial action; the new
// day is a real dawn -> day phase change (which fires the respawn).
// Not real: the hand-from-grave scare is queued through the Dev_Panel's forced-scare queue,
// because the natural roll (20% by day) is random. The roll itself is covered by unit tests.
type Stack = { item: string; qty: number }
type SpawnSnap = { world: { materials: Record<string, Stack[]> } }
type DigSnap = { active: boolean; progress: number; dugOnDay: Record<string, number> }

const GRAVES = SPAWN_POINTS.filter((p) => p.lootTable === 'grave-dig')
const OTHERS = SPAWN_POINTS.filter((p) => p.lootTable !== 'grave-dig' && !p.once)

const spawn = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('spawn') as SpawnSnap)
const digState = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('dig') as DigSnap)
const worldSnap = (page: Page) =>
  page.evaluate(() => window.__lastRites!.snapshot('world') as { phase: string; nightNumber: number })
const satchel = (page: Page) =>
  page.evaluate(() => {
    const inv = window.__lastRites!.snapshot('inventory') as { inventory: { slots: Stack[] } }
    return inv.inventory.slots
  })
const total = (slots: Stack[], id: string) => slots.filter((s) => s.item === id).reduce((a, s) => a + s.qty, 0)

async function faceGrave(page: Page, id: string, x: number, z: number): Promise<void> {
  await page.evaluate(([px, pz]) => window.__lastRites!.teleport(px, pz + 2, { yaw: 0, pitch: -0.3 }), [x, z])
  await page.waitForFunction(
    (gid) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === `dig:${gid}`,
    id,
    { timeout: 30_000 },
  )
}

async function emptySatchelKeepShovel(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/game/state/inventoryStore.ts')
    const inv = m.useInventoryStore.getState().inventory
    m.useInventoryStore.getState().setInventory({ ...inv, slots: [], hotbar: [null, null, null, null] } as typeof inv)
    window.__lastRites!.give('rusty-shovel', 1, 0)
    window.__lastRites!.equip(0)
  })
}

test('D3: graves dig in 3 s, cancel on moving, once a day; materials refill each day', async ({ page }) => {
  test.setTimeout(300_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.5,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.equip(0))
  expect(GRAVES.map((g) => g.id)).toEqual(['grave-oak-hollow', 'grave-north-row', 'grave-low-field'])

  // --- Day 1 stock: every other point holds something from its own table --------------------
  const day1 = (await spawn(page)).world.materials
  for (const p of OTHERS) {
    const allowed = LOOT_TABLE_MAP[p.lootTable].entries.map((e) => e.item as string)
    expect(day1[p.id]?.length, `${p.id} stocked on day 1`).toBeGreaterThan(0)
    for (const s of day1[p.id]) expect(allowed, `${p.id} ${s.item}`).toContain(s.item)
  }
  expect(total(day1['hut-shelf'] ?? [], 'cloth')).toBeGreaterThanOrEqual(1)
  expect(total(day1['chapel-font'] ?? [], 'holy-water')).toBe(2)
  // Graves show nothing on the surface until dug.
  for (const g of GRAVES) expect(day1[g.id] ?? []).toEqual([])

  // --- Dig each grave ------------------------------------------------------------------------
  let first = true
  for (const g of GRAVES) {
    const [gx, , gz] = g.position
    await faceGrave(page, g.id, gx, gz)

    // Hold, then step away: the dig is cancelled and nothing drops.
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForFunction(() => (window.__lastRites!.snapshot('dig') as DigSnap).active, undefined, { timeout: 10_000 })
    await page.evaluate(([px, pz]) => window.__lastRites!.teleport(px, pz + 6, { yaw: 0, pitch: -0.3 }), [gx, gz])
    await page.waitForFunction(() => !(window.__lastRites!.snapshot('dig') as DigSnap).active, undefined, { timeout: 10_000 })
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    expect((await digState(page)).dugOnDay[g.id], `${g.id} not dug by a cancelled hold`).toBeUndefined()
    expect(((await spawn(page)).world.materials[g.id] ?? []).length).toBe(0)

    // A full hold digs it. Wall time is at least ~3 s; the loot lands on the grave only then.
    await faceGrave(page, g.id, gx, gz)
    const t0 = Date.now()
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForFunction(() => (window.__lastRites!.snapshot('dig') as DigSnap).active, undefined, { timeout: 10_000 })
    expect(((await spawn(page)).world.materials[g.id] ?? []).length, 'loot hidden mid-dig').toBe(0)
    await page.waitForFunction(
      (gid) => (window.__lastRites!.snapshot('dig') as DigSnap).dugOnDay[gid] === 1,
      g.id,
      { timeout: 30_000 },
    )
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2500)
    await page.evaluate(() => window.__lastRites!.release('Interact'))

    const loot = (await spawn(page)).world.materials[g.id] ?? []
    expect(loot.length, `${g.id} loot`).toBeGreaterThan(0)
    const allowed = LOOT_TABLE_MAP['grave-dig'].entries.map((e) => e.item as string)
    for (const s of loot) expect(allowed).toContain(s.item)
    if (first) expect(total(loot, 'bone'), 'first dig of the run gives 3+ bone').toBeGreaterThanOrEqual(3)
    first = false

    // A second hold the same day does nothing.
    await page.evaluate(() => window.__lastRites!.hold('Interact'))
    await page.waitForTimeout(800)
    expect((await digState(page)).active, `${g.id} cannot be dug twice`).toBe(false)
    await page.evaluate(() => window.__lastRites!.release('Interact'))
    await page.screenshot({ path: `e2e/screenshots/dig-${g.id}-1280x720.png` })
  }

  // --- Pick the dug loot up through the real action -------------------------------------------
  await emptySatchelKeepShovel(page)
  const dugLoot = (await spawn(page)).world.materials['grave-oak-hollow']
  const expectBone = total(dugLoot, 'bone')
  for (let i = 0; i < dugLoot.length; i++) await page.evaluate(() => window.__lastRites!.collectMaterial('grave-oak-hollow', 0))
  expect(total(await satchel(page), 'bone')).toBe(expectBone)
  expect((await spawn(page)).world.materials['grave-oak-hollow']).toEqual([])

  // --- Hand-from-grave: queued the way the Dev_Panel does, it slows the player ----------------
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ '/src/scene/scares/scareRuntime.ts')
    m.scareRuntime.forced.push('hand-from-grave')
    ;(window as unknown as { __rt: typeof m.scareRuntime }).__rt = m.scareRuntime
  })
  await page.waitForFunction(
    () => (window as unknown as { __rt: { slowLeft: number } }).__rt.slowLeft > 0,
    undefined,
    { timeout: 10_000 },
  )

  // --- Every other point: take its stock, then a new day refills it ---------------------------
  for (const p of OTHERS) {
    const n = ((await spawn(page)).world.materials[p.id] ?? []).length
    await emptySatchelKeepShovel(page)
    for (let i = 0; i < n; i++) await page.evaluate((id) => window.__lastRites!.collectMaterial(id, 0), p.id)
    expect((await spawn(page)).world.materials[p.id], `${p.id} emptied`).toEqual([])
  }

  await page.evaluate(() => window.__lastRites!.skipToDusk(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
  await page.evaluate(() => window.__lastRites!.skipToDawn())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dawn', undefined, {
    timeout: 60_000,
  })
  await page.evaluate(() => window.__lastRites!.pickAnyUpgrade())
  await page.evaluate(() => window.__lastRites!.setClock({ phaseTime: 9.9 }))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'day', undefined, {
    timeout: 60_000,
  })
  const day2 = await worldSnap(page)
  expect(day2.nightNumber).toBe(2)

  const refilled = (await spawn(page)).world.materials
  for (const p of OTHERS) expect(refilled[p.id]?.length, `${p.id} refilled on day 2`).toBeGreaterThan(0)
  // A dug grave keeps what was left on it, and can be dug again on the new day.
  const g0 = GRAVES[0]
  await emptySatchelKeepShovel(page)
  await faceGrave(page, g0.id, g0.position[0], g0.position[2])
  await page.evaluate(() => window.__lastRites!.hold('Interact'))
  await page.waitForFunction(
    (gid) => (window.__lastRites!.snapshot('dig') as DigSnap).dugOnDay[gid] === 2,
    g0.id,
    { timeout: 30_000 },
  )
  await page.evaluate(() => window.__lastRites!.release('Interact'))

  expect(errors).toEqual([])
})
