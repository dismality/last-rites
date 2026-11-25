import { test, expect, type Page } from '@playwright/test'

// Stage 2 (The Resurrection Men) in real Chrome, after the playtest story pass. The three fresh
// graves are looked at with E; minigames 2a (the burial register), 2b (the watch log), 2c (the boots)
// and 2d (Kerr's locker) are opened with a real E at the real props and solved with the real mouse,
// or keyboard only, a wrong answer first. The print is taken at the robbed grave and the whistle
// from the opened locker. At night the altar is given a wrong name, then the right one. The dev hook
// only sets up (start, stage, positioning, clock, kill stragglers) and reads state.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
const CASE_ID = 'resurrection-men'
const GRAVES = ['cobb', 'reade', 'finch'] as const
/** Clicks of "Turn on" from the first crest (owl on a book) to the Vane raven on a coffin. */
const RAVEN_TURNS = 2

interface WorldSnap {
  phase: string
}
interface StageSnap {
  stage: number
  caseSolved: boolean
  altar: { lockedUntil: number; wrong: number }
}
interface CaseSnap {
  cases: Record<
    string,
    { found: string[]; minigames: string[]; wrongAnswers: number; gravesSeen: string[]; printTaken: boolean }
  >
  closed: string[]
  doubt: { doubt: number }
}

const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseState = (page: Page) => page.evaluate(() => window.__lastRites!.caseState() as CaseSnap)
const progress = async (page: Page) => (await caseState(page)).cases[CASE_ID]
const keyItems = (page: Page) =>
  page.evaluate(
    () => (window.__lastRites!.snapshot('inventory') as { inventory: { keyItems: string[] } }).inventory.keyItems,
  )
const enemyCount = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length)

function frames(page: Page, n: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0
        const step = () => (++i < count ? requestAnimationFrame(step) : resolve())
        requestAnimationFrame(step)
      }),
    n,
  )
}

async function boot(page: Page): Promise<{ errors: string[] }> {
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
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.evaluate(() => window.__lastRites!.skipToStage(2))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 2)
  return { errors }
}

async function intoNight(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToDusk(2))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.skipToNight(2))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night')
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0, undefined, {
    timeout: 60_000,
  })
  await page.evaluate(() => window.__lastRites!.killAll())
}

/** Walks to a prop, looks at it, waits for the crosshair to hover it and presses a real E, until `done`. */
async function usePropUntil(page: Page, id: string, done: () => Promise<boolean>): Promise<void> {
  const c = await page.evaluate((i) => window.__lastRites!.interactableCentre(i), id)
  expect(c, `${id} is mounted`).not.toBeNull()
  const [cx, cy, cz] = c!
  const stands = [
    [1.2, 0],
    [0, 1.2],
    [0, -1.2],
    [-1.2, 0],
    [0.9, 0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [-0.9, -0.9],
  ]
  let hovered = false
  for (const [dx, dz] of [...stands, ...stands]) {
    if (await done()) break
    const x = cx + dx
    const z = cz + dz
    await page.evaluate(([px, pz]) => window.__lastRites!.teleport(px, pz), [x, z])
    await page.waitForFunction(
      ([px, pz]) => {
        const b = window.__lastRites!.body()
        return b !== null && Math.hypot(b.feet[0] - px, b.feet[2] - pz) < 0.3
      },
      [x, z],
    )
    const eye = (await page.evaluate(() => window.__lastRites!.body()!.camera)) as number[]
    const yaw = Math.atan2(-(cx - eye[0]), -(cz - eye[2]))
    const pitch = Math.atan2(cy - eye[1], Math.hypot(cx - eye[0], cz - eye[2]))
    await page.evaluate(([px, pz, y, p]) => window.__lastRites!.teleport(px, pz, { yaw: y, pitch: p }), [x, z, yaw, pitch])
    try {
      await page.waitForFunction(
        (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
        id,
        { timeout: 2_500 },
      )
      hovered = true
    } catch {
      continue
    }
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(600)
    await page.keyboard.up('KeyE')
    await frames(page, 20)
  }
  expect(hovered, `crosshair reaches ${id}`).toBe(true)
  expect(await done(), `E at ${id} did its work`).toBe(true)
}

async function openMinigame(page: Page, id: string): Promise<void> {
  const shell = page.locator('.minigame-shell')
  await usePropUntil(page, id, async () => (await shell.count()) > 0)
  await expect(shell).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true)
}

async function closeMinigame(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)
}

async function shoot(page: Page, name: string): Promise<void> {
  await frames(page, 30)
  for (const s of SIZES) {
    await page.setViewportSize(s)
    await frames(page, 8)
    await page.screenshot({ path: `${SHOTS}/${name}-${s.width}x${s.height}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await frames(page, 6)
}

const result = (page: Page) => page.locator('.minigame-shell__result')

/** Looks at the three fresh graves with E, as every route needs them. */
async function walkTheGraves(page: Page): Promise<void> {
  for (const g of GRAVES) {
    await usePropUntil(page, `fresh-grave-${g}`, async () => (await progress(page)).gravesSeen.includes(g))
  }
}

/** Takes the whistle from the opened locker: E shows its examine view, Esc puts it away into the satchel. */
async function takeWhistle(page: Page): Promise<void> {
  const putAway = page.getByRole('button', { name: /Put away/ })
  await usePropUntil(
    page,
    'fixed:fx-bone-whistle',
    async () => (await putAway.count()) > 0 || (await keyItems(page)).includes('bone-whistle'),
  )
  if ((await putAway.count()) > 0) await page.keyboard.press('Escape')
  await expect.poll(() => keyItems(page)).toContain('bone-whistle')
}

test('mouse: graves, register, watch log, boots and locker wrong then right, then both altar answers', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const { errors } = await boot(page)
  await walkTheGraves(page)

  // 2a: Thomas Reade's grave marked wrong first, then every line right.
  await openMinigame(page, 'burial-register')
  await expect(page.getByRole('dialog', { name: 'The burial register' })).toBeVisible()
  const row = (g: string) => page.locator(`.register__row[data-grave="${g}"]`)
  await row('reade').getByRole('button', { name: 'It doesn’t match' }).click()
  await expect.poll(async () => (await progress(page)).wrongAnswers).toBe(1)
  await expect(row('reade').locator('.register__verdict')).toHaveCount(0)
  await row('cobb').getByRole('button', { name: 'The grave agrees' }).click()
  await row('reade').getByRole('button', { name: 'The grave agrees' }).click()
  await shoot(page, 'case2-2a')
  await row('finch').getByRole('button', { name: 'It doesn’t match' }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2a')
  expect((await progress(page)).found).toContain('robbed-grave')
  await closeMinigame(page)

  // 2b: a signed box first (nothing wrong there), then the empty midnight box.
  await openMinigame(page, 'watch-logbook')
  await page.locator('.watch__sign').first().click()
  expect((await progress(page)).minigames).not.toContain('2b')
  await page.locator('.watch__sign--empty').first().click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2b')
  await shoot(page, 'case2-2b')
  await closeMinigame(page)

  // The print at Arthur Finch's grave.
  await usePropUntil(page, 'boot-print', async () => (await progress(page)).printTaken)

  // 2c: the visitor's boot first, then Kerr's.
  await openMinigame(page, 'lodge-boots')
  await page.getByRole('button', { name: "A visitor's narrow boot" }).click()
  await expect(result(page)).toContainText('No.')
  await shoot(page, 'case2-2c-wrong')
  await page.getByRole('button', { name: "Kerr's work boots" }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2c')
  expect((await progress(page)).found).toContain('boot-print-match')
  await shoot(page, 'case2-2c')
  await closeMinigame(page)

  // 2d: the key with the wrong crest, then the dial on to the raven.
  await openMinigame(page, 'crest-lock')
  await page.getByRole('button', { name: 'Turn the key' }).click()
  await expect(result(page)).toContainText('Won’t turn')
  for (let k = 0; k < RAVEN_TURNS; k++) await page.getByRole('button', { name: 'Turn on' }).click()
  await expect(page.locator('.crestlock__now')).toHaveText(/raven on a coffin/i)
  await page.getByRole('button', { name: 'Turn the key' }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2d')
  await expect(page.locator('.crestlock__receipt')).toContainText('Paid to Kerr')
  await shoot(page, 'case2-2d')
  await closeMinigame(page)
  await takeWhistle(page)

  // The two red herrings are walk clues too.
  for (const id of ['spade-fresh-clay', 'doctor-school-letter']) {
    await usePropUntil(page, `case-clue-${id}`, async () => (await progress(page)).found.includes(id))
  }

  await intoNight(page)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0, undefined, {
    timeout: 30_000,
  })
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Altar' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Who paid for the stolen bodies?')
  const input = panel.locator('.altar-panel__input')

  // Wrong: Kerr dug, but he did not pay.
  await input.fill('Kerr')
  await panel.getByRole('button', { name: 'Answer' }).click()
  await expect(panel.locator('.altar-panel__status')).toContainText('The altar is silent: 0:')
  expect((await stage(page)).caseSolved).toBe(false)
  expect((await stage(page)).altar.wrong).toBe(1)

  // Wait the lock out, then who paid.
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).toContainText('Type the name', { timeout: 60_000 })
  await input.fill('vane & sons')
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await expect(panel.locator('.handwritten')).toBeVisible()
  await panel.getByRole('button', { name: 'Show it all' }).click()
  await expect(panel.locator('.handwritten')).toContainText('Vane & Sons paid Kerr to dig up the dead')
  await shoot(page, 'case2-summary')
  await expect.poll(async () => (await caseState(page)).closed).toContain(CASE_ID)
  // The whistle is carried on into stage 3.
  expect(await keyItems(page)).toContain('bone-whistle')

  expect(errors).toEqual([])
})

test('keyboard only: register, watch log, boots and locker', async ({ page }) => {
  test.setTimeout(240_000)
  const { errors } = await boot(page)
  await walkTheGraves(page)

  /**
   * Tabs to a button by its name and presses Enter on it, as a keyboard player would. The test hook
   * fakes pointer lock and the game swallows Tab while locked; a real player's cursor is free with a
   * screen open, so the fake lock is dropped for the browser's own Tab focus.
   */
  const press = async (name: string | RegExp, within = page.locator('.minigame-shell')) => {
    await page.evaluate(() => window.__lastRites!.lockless(false))
    const b = within.getByRole('button', { name }).first()
    for (let i = 0; i < 40 && !(await b.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab')
    await expect(b).toBeFocused()
    await page.keyboard.press('Enter')
  }

  await openMinigame(page, 'burial-register')
  const row = (g: string) => page.locator(`.register__row[data-grave="${g}"]`)
  await press('The grave agrees', row('cobb'))
  await press('The grave agrees', row('reade'))
  await press('It doesn’t match', row('finch'))
  await expect.poll(async () => (await progress(page)).minigames).toContain('2a')
  await closeMinigame(page)

  await openMinigame(page, 'watch-logbook')
  await press('12 am: countersign box, empty')
  await expect.poll(async () => (await progress(page)).minigames).toContain('2b')
  await closeMinigame(page)

  await usePropUntil(page, 'boot-print', async () => (await progress(page)).printTaken)

  await openMinigame(page, 'lodge-boots')
  await press("Dale's porter's shoes")
  await expect(result(page)).toContainText('Not Dale')
  await press("Kerr's work boots")
  await expect.poll(async () => (await progress(page)).minigames).toContain('2c')
  await closeMinigame(page)

  await openMinigame(page, 'crest-lock')
  for (let k = 0; k < RAVEN_TURNS; k++) await press('Turn on')
  await press('Turn the key')
  await expect.poll(async () => (await progress(page)).minigames).toContain('2d')
  // A wrong pair of boots costs nothing (only a wrong register mark does).
  expect((await progress(page)).wrongAnswers).toBe(0)
  await closeMinigame(page)

  expect(errors).toEqual([])
})
