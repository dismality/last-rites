import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Stage 1 (Saved by the Bell) in real Chrome, as the story pass has it: the stones of Pell, Ames
// and Hale are read with E at the graves, the ledger lines are marked against them (one wrong mark
// first), the three bell cords are pulled with E, the journal asks which bell was cut (one wrong
// pick first, which costs nothing), and the name is typed at the altar at night (wrong, then
// right, in mixed case), after which the keeper's summary writes itself. The dev hook only sets
// up (start, positioning, clock, kill stragglers) and reads state. Waits are polled state or
// rendered-frame counts, never fixed sleeps (apart from the held E key).

const SHOTS = 'e2e/screenshots'
const LOGS = 'e2e/logs'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
const CASE_ID = 'saved-by-the-bell'

interface WorldSnap {
  phase: string
  phaseTime: number
}
interface StageSnap {
  stage: number
  caseSolved: boolean
  altar: { lockedUntil: number; wrong: number }
}
interface CaseSnap {
  cases: Record<
    string,
    { minigames: string[]; wrongAnswers: number; bellsExamined: string[]; stonesRead: string[] }
  >
}

const world = (page: Page) =>
  page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseState = (page: Page) => page.evaluate(() => window.__lastRites!.caseState() as CaseSnap)
const solvedMinigames = async (page: Page) => (await caseState(page)).cases[CASE_ID].minigames
const enemyCount = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length)

/** Waits for `n` rendered frames. */
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

/** Starts a run ("Begin") and returns the wall-clock start plus the page errors collected. */
async function boot(page: Page): Promise<{ errors: string[]; begun: number }> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  const begun = Date.now()
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  return { errors, begun }
}

async function intoNight(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToDusk(1))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk',
  )
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night',
  )
}

/**
 * Walks to a prop (teleport is positioning only), looks at it, waits for the crosshair to hover it
 * and uses it with a real E key press until `done` holds (by default: a Minigame opened). Tries a
 * few stand points because the hut is small.
 */
async function useProp(page: Page, id: string, done?: () => Promise<boolean>): Promise<void> {
  const c = await page.evaluate((i) => window.__lastRites!.interactableCentre(i), id)
  expect(c, `${id} is mounted`).not.toBeNull()
  const [cx, cy, cz] = c!
  const stands = [
    [0, 1.2],
    [0, -1.2],
    [1.2, 0],
    [-1.2, 0],
    [0.9, 0.9],
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
  ]
  const shell = page.locator('.minigame-shell')
  const isDone = done ?? (async () => (await shell.count()) > 0)
  let hovered = false
  for (const [dx, dz] of [...stands, ...stands]) {
    if (await isDone()) break
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
    // forward is (-sin yaw, -cos yaw); pitch is positive looking up.
    const yaw = Math.atan2(-(cx - eye[0]), -(cz - eye[2]))
    const pitch = Math.atan2(cy - eye[1], Math.hypot(cx - eye[0], cz - eye[2]))
    await page.evaluate(
      ([px, pz, y, p]) => window.__lastRites!.teleport(px, pz, { yaw: y, pitch: p }),
      [x, z, yaw, pitch],
    )
    try {
      await page.waitForFunction(
        (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
        id,
        { timeout: 2_500 },
      )
      hovered = true
    } catch {
      continue // try the next stand point
    }
    // Held for 600 ms: a short tap can fall between two slow software-rendered frames and be
    // missed. If the press still misses (or the hover slips), re-aim from the next stand point.
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(600)
    await page.keyboard.up('KeyE')
    await frames(page, 20)
  }
  expect(hovered, `crosshair reaches ${id}`).toBe(true)
  expect(await isDone(), `E at ${id} does its job`).toBe(true)
  if (done) return
  await expect(shell, `E at ${id} opens its Minigame`).toBeVisible()
  // The overlay frees the cursor: no real pointer lock may stay on the canvas under it.
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true)
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

const GRAVES = ['pell', 'ames', 'hale'] as const
const row = (page: Page, grave: string) => page.locator(`.ledger2__row[data-grave="${grave}"]`)

/** Reads a stone with E at the grave: the rubbing opens and Esc puts it away. */
async function readStone(page: Page, grave: string): Promise<void> {
  await useProp(page, `tombstone-${grave}`, async () =>
    (await caseState(page)).cases[CASE_ID].stonesRead.includes(grave),
  )
  await expect(page.locator('.rubbing')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.rubbing')).toHaveCount(0)
}

/** Pulls a bell cord with E: no Minigame, the keeper says what it did. */
async function pullCord(page: Page, post: string): Promise<void> {
  await useProp(page, post, async () =>
    (await caseState(page)).cases[CASE_ID].bellsExamined.includes(post),
  )
}

const keeperSays = (page: Page) => page.locator('.keeper-say__text')

/** Opens the journal on the Case board, where Case 1's findings are written up. */
async function openCaseBoard(page: Page): Promise<void> {
  await page.keyboard.press('KeyJ')
  await page.getByRole('tab', { name: 'Case board' }).click()
  await expect(page.locator('.case1')).toBeVisible()
}

async function nightAltar(page: Page) {
  await intoNight(page)
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0,
    undefined,
    {
      timeout: 60_000,
    },
  )
  await page.evaluate(() => window.__lastRites!.killAll())
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0,
    undefined,
    {
      timeout: 30_000,
    },
  )
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Altar' })
  await expect(panel).toBeVisible()
  return panel
}

test('mouse: stones, a wrong ledger mark, bells, a wrong bell, then both altar answers at night', async ({
  page,
}) => {
  test.setTimeout(420_000)
  const { errors, begun } = await boot(page)
  const spawn = (await page.evaluate(() => window.__lastRites!.body()!.feet)) as number[]
  const shelf = (await page.evaluate(() => window.__lastRites!.interactableCentre('ledger-shelf')))!

  // The ledger first, before any stone is read: every choice waits for its stone. The first
  // Minigame must be reachable within 3 minutes of Begin. The test positions the keeper, so the
  // walk is also estimated: straight-line metres from the spawn at walking speed (3.0 m/s).
  await useProp(page, 'ledger-shelf')
  const wall = Date.now() - begun
  const gameSeconds = (await world(page)).phaseTime
  const metres = Math.hypot(shelf[0] - spawn[0], shelf[2] - spawn[2])
  const walkSeconds = metres / 3.0
  mkdirSync(LOGS, { recursive: true })
  writeFileSync(
    `${LOGS}/case1-first-minigame.json`,
    JSON.stringify(
      {
        wallSecondsFromBegin: wall / 1000,
        gameSecondsIntoDay: gameSeconds,
        spawnToShelfMetres: metres,
        walkSeconds,
        limitSeconds: 180,
      },
      null,
      2,
    ),
  )
  console.log(
    `[case1] first Minigame open ${(wall / 1000).toFixed(1)} s after Begin (${gameSeconds.toFixed(1)} s game time); ` +
      `walk from spawn ${metres.toFixed(1)} m = ${walkSeconds.toFixed(1)} s`,
  )
  expect(gameSeconds + walkSeconds).toBeLessThan(180)
  await expect(page.getByRole('dialog', { name: 'The parish ledger' })).toBeVisible()
  await expect(row(page, 'pell').getByRole('button', { name: 'The date differs' })).toBeDisabled()
  await expect(row(page, 'pell')).toContainText('Not read yet')
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // The three stones Elias named. Each one is said aloud by the keeper.
  for (const grave of GRAVES) await readStone(page, grave)
  await expect(keeperSays(page)).toContainText('ledger')

  // The ledger: Pell's line marked "agrees" is wrong (Doubt), then the date; Ames the cause; Hale the plot.
  await useProp(page, 'ledger-shelf')
  await row(page, 'pell').getByRole('button', { name: 'The stone agrees' }).click()
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(1)
  expect(await solvedMinigames(page)).not.toContain('1a')
  await row(page, 'pell').getByRole('button', { name: 'The date differs' }).click()
  await expect(row(page, 'pell').locator('.ledger2__verdict')).toContainText('date')
  await row(page, 'ames').getByRole('button', { name: 'The cause differs' }).click()
  await expect(row(page, 'ames').locator('.ledger2__verdict')).toContainText('cause')
  await shoot(page, 'case1-ledger')
  await row(page, 'hale').getByRole('button', { name: 'The plot differs' }).click()
  await expect(page.locator('.ledger2__solved')).toContainText('J.V.')
  await expect.poll(() => solvedMinigames(page)).toContain('1a')
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // The bell posts stand now. Pull each cord: Ames and Hale ring, Pell's is cut.
  await pullCord(page, 'bell-ames')
  await expect(keeperSays(page)).toContainText('Esther Ames')
  await pullCord(page, 'bell-pell')
  await expect(keeperSays(page)).toContainText(/cut|Nothing/)
  await shoot(page, 'case1-bells')
  await pullCord(page, 'bell-hale')
  await expect.poll(async () => (await caseState(page)).cases[CASE_ID].bellsExamined.length).toBe(3)

  // The journal asks which bell was cut. Hale's is wrong and costs nothing; Pell's names J. Vane.
  await openCaseBoard(page)
  await page.locator('.case1__answer').filter({ hasText: 'Tobias Hale' }).click()
  expect(await solvedMinigames(page)).not.toContain('1b')
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(1)
  await page.locator('.case1__answer').filter({ hasText: 'John Pell' }).click()
  await expect.poll(() => solvedMinigames(page)).toContain('1b')
  await expect(page.locator('.case1__stamp-note')).toContainText('Josiah Vane')
  await expect(page.locator('.case1__tag')).toContainText('J. Vane')
  await shoot(page, 'case1-journal')
  await page.keyboard.press('Escape')
  await expect(page.locator('.case1')).toHaveCount(0)

  // Night: the name is typed at the altar.
  const panel = await nightAltar(page)
  const input = panel.locator('.altar-panel__input')
  await input.fill('Esther Ames')
  await shoot(page, 'case1-altar')

  // Wrong answer: a 30 s lock and an instant wave.
  await panel.getByRole('button', { name: 'Answer' }).click()
  await expect(panel.locator('.altar-panel__status')).toContainText('The altar is silent: 0:')
  expect((await stage(page)).caseSolved).toBe(false)
  expect((await stage(page)).altar.wrong).toBe(1)
  await expect.poll(() => enemyCount(page), { timeout: 20_000 }).toBeGreaterThan(0)
  const readSecs = async () => {
    const t = (await panel.locator('.altar-panel__status').textContent()) ?? ''
    const m = /silent: 0:(\d+)/.exec(t)
    return m ? Number(m[1]) : null
  }
  const first = await readSecs()
  expect(first).not.toBeNull()
  expect(first!).toBeGreaterThan(20)
  expect(first!).toBeLessThanOrEqual(30)

  // Wait the lock out, then the right name in odd case: waves stop, the summary writes itself.
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).toContainText('Type the name', {
    timeout: 60_000,
  })
  await input.fill('jOSIAH vane')
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await expect(panel.locator('.handwritten')).toBeVisible()
  await panel.getByRole('button', { name: 'Show it all' }).click()
  await expect(panel.locator('.handwritten')).toContainText(
    'The Vanes bury people who know too much',
  )
  await shoot(page, 'case1-summary')
  await panel.getByRole('button', { name: /Close/ }).click()
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn',
    undefined,
    {
      timeout: 30_000,
    },
  )
  const log = await page.evaluate(() => window.__lastRites!.events().map((e) => e.type))
  expect(log).toContain('nightCleared')
  expect(log).toContain('dawnStarted')

  expect(errors).toEqual([])
})

test('keyboard only: ledger marks, the cut bell and the typed name, by Tab, Enter and typing', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const { errors } = await boot(page)
  const key = (code: string) => page.keyboard.press(code, { delay: 20 })
  /** Tabs forward until `target` has focus. */
  const tabTo = async (target: ReturnType<Page['locator']>, max = 40) => {
    for (let i = 0; i < max; i++) {
      if (await target.evaluate((el) => el === document.activeElement)) return
      await key('Tab')
    }
    await expect(target).toBeFocused()
  }

  for (const grave of GRAVES) await readStone(page, grave)
  await useProp(page, 'ledger-shelf')
  await page.evaluate(() => window.__lastRites!.lockless(false))
  for (const [grave, name] of [
    ['pell', 'The date differs'],
    ['ames', 'The cause differs'],
    ['hale', 'The plot differs'],
  ] as const) {
    await tabTo(row(page, grave).getByRole('button', { name }))
    await key('Enter')
    await expect(row(page, grave).locator('.ledger2__verdict')).toBeVisible()
  }
  await expect.poll(() => solvedMinigames(page)).toContain('1a')
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(0)
  await key('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)
  await page.evaluate(() => window.__lastRites!.lockless(true))

  for (const post of ['bell-pell', 'bell-hale', 'bell-ames']) await pullCord(page, post)

  // The journal by keyboard: J, then the Case board tab, then Tab to Pell's bell and Enter.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await key('KeyJ')
  const tab = page.getByRole('tab', { name: 'Case board' })
  await tab.focus()
  await key('Enter')
  await expect(page.locator('.case1')).toBeVisible()
  await tabTo(page.locator('.case1__answer').filter({ hasText: 'John Pell' }))
  await key('Enter')
  await expect.poll(() => solvedMinigames(page)).toContain('1b')
  await key('Escape')
  await expect(page.locator('.case1')).toHaveCount(0)
  await page.evaluate(() => window.__lastRites!.lockless(true))

  // The altar: typed letters stay in the box (J must not open the journal), Enter gives it.
  const panel = await nightAltar(page)
  await page.evaluate(() => window.__lastRites!.lockless(false))
  const input = panel.locator('.altar-panel__input')
  await input.focus()
  await page.keyboard.type('J.V.', { delay: 20 })
  await expect(input).toHaveValue('J.V.')
  await expect(page.locator('.case1')).toHaveCount(0)
  await key('Enter')
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await expect(panel.locator('.handwritten')).toBeVisible()

  expect(errors).toEqual([])
})
