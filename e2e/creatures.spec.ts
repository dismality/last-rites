import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 7.7 (Req 2.2, 2.3, 2.4, 2.7, 2.8, 2.10, 2.13, 2.18, 2.20, 8.21): the new creatures.
// A crawler ambush with its face scare and 8 damage; a level swing misses it and a downward swing
// hits; the bride is seen only in the lantern cone or within 3 m, drains 20 oil, and takes no
// damage from lead; a hound pack circles and scatters on a gunshot; the Bestiary lists only seen
// creatures; no scripted event takes the player below 1 HP. Screenshots at 1280x720 and 800x600
// in e2e/screenshots/creatures/.

const DIR = 'e2e/screenshots/creatures'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]

type Creatures = ReturnType<NonNullable<Window['__lastRites']>['creatureState']>
const cstate = (page: Page): Promise<Creatures> => page.evaluate(() => window.__lastRites!.creatureState())
const health = (page: Page): Promise<number> =>
  page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)
const fuel = (page: Page): Promise<number> =>
  page.evaluate(() => (window.__lastRites!.snapshot('lantern') as { fuel: number }).fuel)
const pos = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window.__lastRites!.snapshot('player') as { position: number[] }).position)

/** A new Normal run, taken to the first night of stage 2 (crawlers and the bride are allowed). */
async function startNight(page: Page, size = SIZES[0]): Promise<void> {
  await page.setViewportSize(size)
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 30_000 })
  await page.evaluate(() => window.__lastRites!.skipToNight(2))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
    undefined,
    { timeout: 60_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.creatureState().seededNight === 2, undefined, {
    timeout: 15_000,
  })
  // Zombies of the night's waves are not under test: banish them as they rise.
  await page.evaluate(() => {
    setInterval(() => window.__lastRites!.killAll(), 100)
  })
}

async function shoot(page: Page, name: string, settleMs = 150): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize(size)
    if (settleMs > 0) await page.waitForTimeout(settleMs)
    await page.screenshot({ path: `${DIR}/${name}-${size.width}x${size.height}.png` })
  }
  await page.setViewportSize(SIZES[0])
}

/**
 * Spawns the dev crawler (3 m ahead, hidden) and puts the keeper `distM` from it, facing it, so
 * the next step bursts it. Returns its id.
 */
async function ambush(page: Page, distM: number): Promise<string> {
  const from = await pos(page)
  await page.evaluate(() => window.__lastRites!.spawnCrawlerAmbush())
  const c = (await cstate(page)).crawlers.find((e) => e.id.startsWith('dev-crawler'))!
  const dx = from[0] - c.x
  const dz = from[2] - c.z
  const len = Math.hypot(dx, dz) || 1
  const x = c.x + (dx / len) * distM
  const z = c.z + (dz / len) * distM
  await page.evaluate(
    ({ x, z, c }) =>
      window.__lastRites!.teleport(x, z, { yaw: Math.atan2(-(c.x - x), -(c.z - z)), pitch: 0 }),
    { x, z, c },
  )
  return c.id
}

for (const size of SIZES) {
  test(`crawler ambush: face scare, then 8 damage (${size.width}x${size.height})`, async ({ page }) => {
    test.setTimeout(180_000)
    await startNight(page, size)
    const hp0 = await health(page)
    const id = await ambush(page, 1.2)
    await page.waitForFunction(
      (i) => window.__lastRites!.creatureState().crawlers.find((c) => c.id === i)?.phase === 'emerged',
      id,
      { timeout: 10_000 },
    )
    // The zombie face comes up from the bottom within 1.5 m in front.
    await page.waitForFunction(() => window.__lastRites!.screenScareState().active !== null, undefined, {
      timeout: 10_000,
    })
    await page.screenshot({ path: `${DIR}/crawler-ambush-${size.width}x${size.height}.png` })
    // The grab lands once the face leaves: 8 damage, once.
    await page.waitForFunction((h) => (window.__lastRites!.snapshot('player') as { health: number }).health < h, hp0, {
      timeout: 15_000,
    })
    expect(await health(page)).toBe(hp0 - 8)
  })
}

test('a level swing misses a crawler and a downward swing hits it', async ({ page }) => {
  test.setTimeout(180_000)
  await startNight(page)
  const id = await ambush(page, 1.2)
  await page.waitForFunction(
    (i) => window.__lastRites!.creatureState().crawlers.find((c) => c.id === i)?.phase === 'emerged',
    id,
    { timeout: 10_000 },
  )
  const light = await page.evaluate(() => window.__lastRites!.creatureAttack('light', 15))
  expect(light).toHaveLength(1)
  expect(light[0]).toMatchObject({ miss: true, damage: 0, killed: false })
  expect((await page.evaluate(() => window.__lastRites!.creatureHp())).hp[id]).toBeUndefined()

  const heavy = await page.evaluate(() => window.__lastRites!.creatureAttack('heavy', 15))
  expect(heavy[0]).toMatchObject({ miss: false, damage: 15, killed: false })
  expect((await page.evaluate(() => window.__lastRites!.creatureHp())).hp[id]).toBe(20)

  // A bullet is not a level swing either: it hits for its full damage (35 HP crawler, now at 20).
  const shot = await page.evaluate(() => window.__lastRites!.creatureAttack('lead', 25))
  expect(shot[0]).toMatchObject({ miss: false, damage: 25, killed: true })
  expect((await cstate(page)).crawlers.some((c) => c.id === id)).toBe(false)
})

test('a crawler grab never takes the keeper below 1 HP', async ({ page }) => {
  test.setTimeout(180_000)
  await startNight(page)
  await page.evaluate(() => window.__lastRites!.setHealth(5))
  await ambush(page, 1.2)
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('player') as { health: number }).health < 5,
    undefined,
    { timeout: 15_000 },
  )
  // 8 damage from 5 HP: clamped to 1, and the run goes on.
  expect(await health(page)).toBe(1)
  // (A later grab that begins at 1 HP is a new event and is not clamped: hurtGuard.)
  expect(await page.evaluate(() => (window.__lastRites!.snapshot('game') as { taken: boolean }).taken)).toBe(false)
})

test('the bride shows only in the cone or within 3 m, takes no lead, and drinks 20 oil', async ({ page }) => {
  test.setTimeout(180_000)
  await startNight(page)
  await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
  // Open ground, clear of the hut and chapel walls that stop her (Req 2.9), with her path to the
  // north of the keeper free.
  await page.evaluate(() => window.__lastRites!.teleport(-15, 15, { yaw: 0, pitch: 0 }))
  await page.waitForFunction(() => Math.abs((window.__lastRites!.snapshot('player') as { position: number[] }).position[0] + 15) < 0.5, undefined, { timeout: 5000 })
  const p = await pos(page)
  const yaw0 = await page.evaluate(() => (window.__lastRites!.snapshot('player') as { yaw: number }).yaw)
  const msg = await page.evaluate(() => window.__lastRites!.spawnBride())
  expect(msg).toContain('Hollow Bride appears')
  const turn = (yaw: number) =>
    page.evaluate(({ x, z, yaw }) => window.__lastRites!.teleport(x, z, { yaw, pitch: 0 }), {
      x: p[0],
      z: p[2],
      yaw,
    })
  const dist = async () => {
    const s = await cstate(page)
    const q = await pos(page)
    return Math.hypot(s.bride.x - q[0], s.bride.z - q[2])
  }

  // Back turned: she is out of the cone and further than 3 m, so she is not drawn.
  await turn(yaw0 + Math.PI)
  await page.waitForTimeout(250)
  let s = await cstate(page)
  expect(s.bride.alive).toBe(true)
  expect(await dist()).toBeGreaterThan(3)
  expect(s.bride.visible).toBe(false)

  // Facing her with the lantern lit: she is in the cone.
  await turn(yaw0)
  await page.waitForFunction(() => window.__lastRites!.creatureState().bride.visible, undefined, { timeout: 5000 })
  await shoot(page, 'bride-in-cone', 0)

  // Lead passes through her with a no-effect cue; blessed damage lands.
  const lead = await page.evaluate(() => window.__lastRites!.creatureAttack('lead', 34))
  expect(lead[0]).toMatchObject({ damage: 0, noEffect: true, killed: false })
  let hp = await page.evaluate(() => window.__lastRites!.creatureHp())
  expect(hp.hp.bride).toBeUndefined()
  expect(hp.noEffectCount).toBe(1)
  const blessed = await page.evaluate(() => window.__lastRites!.creatureAttack('blessed', 15))
  expect(blessed[0]).toMatchObject({ damage: 15, noEffect: false })
  hp = await page.evaluate(() => window.__lastRites!.creatureHp())
  expect(hp.hp.bride).toBe(45)
  expect((await cstate(page)).seen).toContain('bride')

  // Her touch drinks 20 oil and she vanishes for 30 to 60 s.
  const f0 = await fuel(page)
  await page.waitForFunction(() => !window.__lastRites!.creatureState().bride.alive, undefined, { timeout: 15_000 })
  await page.waitForFunction((f) => (window.__lastRites!.snapshot('lantern') as { fuel: number }).fuel < f - 15, f0, {
    timeout: 8000,
  })
  const f1 = await fuel(page)
  expect(f1).toBeGreaterThanOrEqual(f0 - 22)
  expect(f1).toBeLessThanOrEqual(f0 - 18)
  s = await cstate(page)
  expect(s.bride.returnIn).toBeGreaterThan(25)
  expect(s.bride.returnIn).toBeLessThanOrEqual(60)
})

test('a hound pack circles at 4 to 6 m and scatters on a gunshot', async ({ page }) => {
  test.setTimeout(180_000)
  await startNight(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.evaluate(() => window.__lastRites!.spawnHoundPack())
  const around = async () => {
    const s = await cstate(page)
    const q = await pos(page)
    const hs = s.packs.flatMap((k) => k.hounds)
    return {
      n: hs.length,
      dists: hs.map((h) => Math.hypot(h.x - q[0], h.z - q[2])),
      angles: hs.map((h) => Math.atan2(h.z - q[2], h.x - q[0])),
    }
  }
  await page.waitForTimeout(1500)
  const a = await around()
  expect(a.n).toBe(3)
  const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length
  expect(mean(a.dists)).toBeGreaterThan(3)
  expect(mean(a.dists)).toBeLessThan(7)
  await page.waitForTimeout(1200)
  const b = await around()
  // They go round the keeper: at least one hound's bearing has changed.
  const moved = a.angles.some((ang, i) => Math.abs(Math.atan2(Math.sin(b.angles[i] - ang), Math.cos(b.angles[i] - ang))) > 0.1)
  expect(moved).toBe(true)
  await shoot(page, 'hound-circling', 0)

  await page.evaluate(() => window.__lastRites!.fireShot())
  await page.waitForTimeout(1500)
  const c = await around()
  expect(mean(c.dists)).toBeGreaterThan(mean(b.dists) + 1)
  await shoot(page, 'hound-scatter', 0)
})

test('the Creatures page lists only creatures the keeper has seen', async ({ page }) => {
  test.setTimeout(180_000)
  await startNight(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await page.getByRole('tab', { name: 'Creatures', exact: true }).click()
  await expect(page.locator('.bestiary__card')).toHaveCount(0)
  await expect(page.locator('.bestiary')).not.toContainText('Corpse Hound')
  await page.keyboard.press('KeyJ')

  // A hound pack is seen the moment it forms; the crawler and the bride have not been.
  await page.evaluate(() => window.__lastRites!.spawnHoundPack())
  await page.waitForFunction(() => window.__lastRites!.creatureState().seen.includes('hound'), undefined, {
    timeout: 5000,
  })
  expect((await cstate(page)).seen).toEqual(['hound'])
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Creatures', exact: true }).click()
  await expect(page.locator('.bestiary__card')).toHaveCount(1)
  const bestiary = page.locator('.bestiary')
  await expect(bestiary).toContainText('Corpse Hound')
  await expect(bestiary).toContainText('What works')
  await expect(bestiary).not.toContainText('Pale Crawler')
  await expect(bestiary).not.toContainText('Hollow Bride')
  await shoot(page, 'creatures-page')
})
