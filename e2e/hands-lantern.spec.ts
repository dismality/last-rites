import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 6.6 (Req 7.2, 7.4, 7.9, 7.14, 7.16, 8.14, 8.21): the first-person hands and the
// lantern light. Each Grip_Class (pistol: revolver; haft: shovel, axe, club, sabre; long: shotgun),
// the lantern on the belt with the shotgun and its caption, the cage cookie and the shadow on the
// hut wall, low oil (redder, gutters at least double), oil out (one flare, then no emission) and
// Flashing lights off (no frame step over 10% of the base light).
// hands.glb, lantern.glb and lantern-cookie.png may still be placeholders: the weapon-only
// viewmodel and the generated cookie are then what the screenshots show, and the grip class and
// hand state are checked through the Debug_Hook (viewmodelState, lanternLightState).
// Screenshots at 1280x720 and 800x600 in e2e/screenshots/hands-lantern/.

const DIR = 'e2e/screenshots/hands-lantern'
const HOOK_CAPTION = 'Lantern hooked to your belt'
/** Flashing lights off: the largest allowed change of the light between two frames (fraction of base). */
const STEP_LIMIT = 0.1

type VM = {
  equipped: string | null
  grip: string
  gripExpected: string | null
  lanternMode: string
  acting: boolean
  shotgunEquipped: boolean
  hookCaptionShown: boolean
  missingArt: string[]
}
type LL = {
  on: boolean
  fuel: number
  signal: number
  gutterAmp: number
  color: string
  lowPass: boolean
  beam: boolean
  zeroAge: number | null
  spotIntensity: number
  fillIntensity: number
  emberIntensity: number
  flameScale: number
  glassEmissive: number
  anchor: 'glass' | 'belt'
  hasCookie: boolean
  castsShadow: boolean
  shadowMapSize: number
}
const vm = (page: Page) => page.evaluate(() => window.__lastRites!.viewmodelState() as VM)
const ll = (page: Page) => page.evaluate(() => window.__lastRites!.lanternLightState() as LL)

async function startRun(page: Page): Promise<string[]> {
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
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, {
    timeout: 30_000,
  })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  return errors
}

/** Night, so the lantern is the light that matters; the hut stays clear of the graves. */
async function toNight(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
    undefined,
    { timeout: 60_000 },
  )
}

/** In the hut, facing the east wall side where the vending machine stands. */
async function faceHutWall(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.__lastRites!.teleport(0.2, 1.85, { yaw: -Math.PI / 2, pitch: -0.1 }),
  )
  await page.waitForFunction(() => {
    const b = window.__lastRites!.body()
    return b !== null && Math.abs(b.feet[0] - 0.2) < 0.2
  })
}

const GIVE: Record<string, { slot: 1 | 2 | 3 | 0 }> = {
  'rusty-shovel': { slot: 0 },
  revolver: { slot: 1 },
  shotgun: { slot: 2 },
  'wood-axe': { slot: 3 },
  'silver-sabre': { slot: 3 },
  'bone-club': { slot: 3 },
  'sharpened-shovel': { slot: 3 },
}

async function equip(page: Page, id: string): Promise<void> {
  const { slot } = GIVE[id]
  await page.evaluate(
    ({ id, slot }) => {
      const h = window.__lastRites!
      if (id !== 'rusty-shovel') h.give(id as never, 1, slot as 1 | 2 | 3)
      h.equip(slot)
    },
    { id, slot },
  )
  await page.waitForFunction((id) => window.__lastRites!.viewmodelState().equipped === id, id, {
    timeout: 10_000,
  })
  // The grip follows the shown weapon once the swap has finished.
  await page.waitForFunction(
    () => {
      const s = window.__lastRites!.viewmodelState()
      return s.gripExpected !== null && s.grip === s.gripExpected
    },
    undefined,
    { timeout: 10_000 },
  )
  await page.waitForTimeout(500)
}

async function shoot(page: Page, name: string): Promise<void> {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${DIR}/${name}-${size.width}x${size.height}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

/** Samples the light signal on every animation frame; resolves with the largest step and the extremes. */
function sampleSignal(page: Page, ms: number) {
  return page.evaluate(
    (ms) =>
      new Promise<{ maxStep: number; min: number; max: number; frames: number }>((resolve) => {
        const h = window.__lastRites!
        const t0 = performance.now()
        let prev = h.lanternLightState().signal
        let maxStep = 0
        let min = prev
        let max = prev
        let frames = 0
        const tick = () => {
          const s = h.lanternLightState().signal
          maxStep = Math.max(maxStep, Math.abs(s - prev))
          min = Math.min(min, s)
          max = Math.max(max, s)
          prev = s
          frames++
          if (performance.now() - t0 < ms) requestAnimationFrame(tick)
          else resolve({ maxStep, min, max, frames })
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

test('each grip class follows the weapon in hand', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = await startRun(page)
  await toNight(page)
  await faceHutWall(page)
  await page.evaluate(() => window.__lastRites!.setLantern(true, 100))

  const expected: Record<string, string> = {
    revolver: 'pistol',
    'rusty-shovel': 'haft',
    'wood-axe': 'haft',
    'bone-club': 'haft',
    'sharpened-shovel': 'haft',
    'silver-sabre': 'haft',
    shotgun: 'long',
  }
  // Screenshots: one weapon per grip class; the state check covers every weapon.
  const shots: Record<string, string> = {
    revolver: 'grip-pistol-revolver',
    'rusty-shovel': 'grip-haft-shovel',
    shotgun: 'grip-long-shotgun',
  }
  for (const id of [
    'revolver',
    'rusty-shovel',
    'wood-axe',
    'bone-club',
    'sharpened-shovel',
    'silver-sabre',
    'shotgun',
  ]) {
    await equip(page, id)
    const s = await vm(page)
    expect(s.grip, `${id} grip`).toBe(expected[id])
    expect(s.gripExpected, `${id} table`).toBe(expected[id])
    // The lantern hand: on the belt only with the shotgun.
    await expect
      .poll(async () => (await vm(page)).lanternMode, { timeout: 5_000 })
      .toBe(id === 'shotgun' ? 'belt' : 'held')
    if (shots[id]) await shoot(page, shots[id])
  }
  // Placeholder status is recorded for the write-up, not asserted: the viewmodel runs either way.
  console.log(`missing art: ${JSON.stringify((await vm(page)).missingArt)}`)
  expect(errors).toEqual([])
})

test('the shotgun hooks the lantern to the belt once, with its caption', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await startRun(page)
  await toNight(page)
  await faceHutWall(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setSetting('flashingLights', true)
    h.setScareSetting('subtitles', true)
    h.setLantern(true, 100)
  })
  await equip(page, 'rusty-shovel')
  expect((await vm(page)).lanternMode).toBe('held')
  expect((await ll(page)).anchor).toBe('glass')

  await equip(page, 'shotgun')
  await expect.poll(async () => (await vm(page)).lanternMode, { timeout: 5_000 }).toBe('belt')
  await expect(page.locator('.hud-subtitles')).toContainText(HOOK_CAPTION)
  expect((await vm(page)).hookCaptionShown).toBe(true)
  // The light moves to the belt hook and stays on (Req 7.8).
  await expect.poll(async () => (await ll(page)).anchor).toBe('belt')
  const belt = await ll(page)
  expect(belt.beam).toBe(true)
  expect(belt.spotIntensity).toBeGreaterThan(0)
  await shoot(page, 'belt-lantern-shotgun')

  // Back to a haft weapon: the lantern returns to the hand within a second; the caption is once per run.
  await equip(page, 'rusty-shovel')
  await expect.poll(async () => (await vm(page)).lanternMode, { timeout: 5_000 }).toBe('held')
  await expect.poll(async () => (await ll(page)).anchor).toBe('glass')
  await expect(page.locator('.hud-subtitles__line', { hasText: HOOK_CAPTION })).toHaveCount(0, {
    timeout: 15_000,
  })
  await equip(page, 'shotgun')
  await expect.poll(async () => (await vm(page)).lanternMode, { timeout: 5_000 }).toBe('belt')
  await page.waitForTimeout(800)
  await expect(page.locator('.hud-subtitles__line', { hasText: HOOK_CAPTION })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the lantern is one shadow-casting spot with a cookie, and lights the hut wall', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const errors = await startRun(page)
  await toNight(page)
  await faceHutWall(page)
  await equip(page, 'rusty-shovel')
  await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
  await expect
    .poll(async () => (await ll(page)).spotIntensity, { timeout: 10_000 })
    .toBeGreaterThan(0)
  const s = await ll(page)
  expect(s.castsShadow).toBe(true)
  expect(s.shadowMapSize).toBeLessThanOrEqual(1024)
  // The cage cookie, or the generated soft round standing in for it.
  expect(s.hasCookie).toBe(true)
  expect(s.fillIntensity).toBeGreaterThan(0)
  const census = await page.evaluate(() => window.__lastRites!.lightCensus())
  expect(census!.shadowCasting).toBeLessThanOrEqual(4)
  // With Low graphics the cookie goes and the shadow stays (Req 7.15).
  await page.evaluate(() => window.__lastRites!.setSetting('lowGraphics', true))
  await expect.poll(async () => (await ll(page)).hasCookie, { timeout: 5_000 }).toBe(false)
  expect((await ll(page)).castsShadow).toBe(true)
  await page.evaluate(() => window.__lastRites!.setSetting('lowGraphics', false))
  await expect.poll(async () => (await ll(page)).hasCookie, { timeout: 5_000 }).toBe(true)
  await page.waitForTimeout(500)
  await shoot(page, 'cage-shadows-hut-wall')
  expect(errors).toEqual([])
})

test('low oil is redder and gutters at least twice as hard; at 0 oil one flare, then no emission', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const errors = await startRun(page)
  await toNight(page)
  await faceHutWall(page)
  await equip(page, 'rusty-shovel')
  await page.evaluate(() => window.__lastRites!.setSetting('flashingLights', true))

  await page.evaluate(() => window.__lastRites!.setLantern(true, 60))
  await expect.poll(async () => (await ll(page)).fuel).toBeGreaterThan(50)
  await page.waitForTimeout(400)
  const normal = await ll(page)
  const normalSpread = await sampleSignal(page, 2500)

  await page.evaluate(() => window.__lastRites!.setLantern(true, 10))
  await expect
    .poll(async () => (await ll(page)).gutterAmp)
    .toBeGreaterThanOrEqual(normal.gutterAmp * 2)
  const low = await ll(page)
  const a = channels(normal.color)
  const b = channels(low.color)
  // Redder: the share of red grows and green shrinks.
  expect(b.r / (b.r + b.g + b.b)).toBeGreaterThan(a.r / (a.r + a.g + a.b))
  expect(b.g).toBeLessThan(a.g)
  const lowSpread = await sampleSignal(page, 2500)
  console.log(
    `signal range normal ${normalSpread.min.toFixed(2)}..${normalSpread.max.toFixed(2)}, low ${lowSpread.min.toFixed(2)}..${lowSpread.max.toFixed(2)}`,
  )
  expect(lowSpread.max - lowSpread.min).toBeGreaterThan(normalSpread.max - normalSpread.min)
  await shoot(page, 'low-oil')

  // Out: record the beam over the first moments after oil reaches 0.
  const flare = await page.evaluate(
    () =>
      new Promise<{ peak: number; litFrames: number }>((resolve) => {
        const h = window.__lastRites!
        h.setLantern(true, 0)
        const t0 = performance.now()
        let peak = 0
        let litFrames = 0
        const tick = () => {
          const s = h.lanternLightState()
          peak = Math.max(peak, s.spotIntensity)
          if (s.spotIntensity > 0) litFrames++
          if (performance.now() - t0 < 1200) requestAnimationFrame(tick)
          else resolve({ peak, litFrames })
        }
        requestAnimationFrame(tick)
      }),
  )
  expect(flare.peak, 'a flare at 0 oil').toBeGreaterThan(0)
  const out = await ll(page)
  expect(out.spotIntensity).toBe(0)
  expect(out.fillIntensity).toBe(0)
  expect(out.flameScale).toBe(0)
  expect(out.glassEmissive).toBe(0)
  expect(out.beam).toBe(false)
  await shoot(page, 'oil-out')
  expect(errors).toEqual([])
})

test('Flashing lights off keeps the light steady', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = await startRun(page)
  await toNight(page)
  await faceHutWall(page)
  await equip(page, 'rusty-shovel')

  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setSetting('flashingLights', false)
    h.setLantern(true, 100)
  })
  await expect.poll(async () => (await ll(page)).lowPass).toBe(true)
  const steady = await sampleSignal(page, 5000)
  console.log(`flashing off, full oil: ${JSON.stringify(steady)}`)
  expect(steady.frames).toBeGreaterThan(30)
  expect(steady.maxStep).toBeLessThanOrEqual(STEP_LIMIT)

  // Low oil is where the gutter is strongest; with Flashing lights off it must stay as steady.
  await page.evaluate(() => window.__lastRites!.setLantern(true, 10))
  await expect.poll(async () => (await ll(page)).fuel).toBeLessThan(15)
  const steadyLow = await sampleSignal(page, 5000)
  console.log(`flashing off, low oil: ${JSON.stringify(steadyLow)}`)
  expect(steadyLow.maxStep).toBeLessThanOrEqual(STEP_LIMIT)

  // Out of oil: a slow fade, not a flare. The oil runs dry on its own (1% per 3 s at night) from a
  // drop left in the lantern, so what is measured is the fade, not the jump of setting fuel by hand.
  await page.evaluate(() => window.__lastRites!.setLantern(true, 0.3))
  await page.waitForTimeout(300)
  const fade = await page.evaluate(
    () =>
      new Promise<{ maxStep: number; reachedZero: boolean; endIntensity: number }>((resolve) => {
        const h = window.__lastRites!
        // The real light (spot intensity over its level just before the oil ran out).
        const base = Math.max(h.lanternLightState().spotIntensity, 1e-6)
        let prev = 1
        let maxStep = 0
        let zeroAt: number | null = null
        const tick = () => {
          const st = h.lanternLightState()
          const s = st.spotIntensity / base
          maxStep = Math.max(maxStep, Math.abs(s - prev))
          prev = s
          if (st.fuel <= 0) zeroAt ??= performance.now()
          if (zeroAt === null || performance.now() - zeroAt < 1800) requestAnimationFrame(tick)
          else resolve({ maxStep, reachedZero: true, endIntensity: st.spotIntensity })
        }
        requestAnimationFrame(tick)
      }),
  )
  console.log(`flashing off, oil running out: ${JSON.stringify(fade)}`)
  expect(fade.reachedZero).toBe(true)
  expect(fade.endIntensity).toBe(0)
  expect(fade.maxStep).toBeLessThanOrEqual(STEP_LIMIT)

  // And the light is still a real light: lit again once there is oil.
  await page.evaluate(() => window.__lastRites!.setLantern(true, 100))
  await expect
    .poll(async () => (await ll(page)).spotIntensity, { timeout: 5_000 })
    .toBeGreaterThan(0)
  await shoot(page, 'flashing-off-steady')
  expect(errors).toEqual([])
})
