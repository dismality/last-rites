import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Spec 10 task 3.8: Stage 1 (Saved by the Bell) in real Chrome. Minigames 1a (Ledger Cross-check)
// and 1b (The Bell Posts) are opened with a real E press at the real props and solved with the
// real mouse and keyboard, including a wrong flag and a wrong post. The altar answers (wrong, then
// right) are given at night. The dev hook only sets up (start, positioning, clues, clock, kill
// stragglers) and reads state; no Dev_Panel solve action touches a minigame answer. Waits are
// polled state or rendered-frame counts, never fixed sleeps (apart from the held E key).

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
  cases: Record<string, { minigames: string[]; wrongAnswers: number; bellsExamined: string[] }>
}

const world = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
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
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night')
}

/**
 * Walks to a prop (teleport is positioning only), looks at it, waits for the crosshair to hover it
 * and uses it with a real E key press. Tries a few stand points because the hut is small.
 */
async function useProp(page: Page, id: string): Promise<void> {
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
  let hovered = false
  for (const [dx, dz] of [...stands, ...stands]) {
    if ((await shell.count()) > 0) break
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
    await page.evaluate(([px, pz, y, p]) => window.__lastRites!.teleport(px, pz, { yaw: y, pitch: p }), [x, z, yaw, pitch])
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

const result = (page: Page) => page.locator('.minigame-shell__result')

/** Draws a ledger line with the real mouse: press on the stone, drag, release on the entry. */
async function dragLine(page: Page, stoneId: string, ledgerId: string): Promise<void> {
  const stone = page.locator(`[data-stone-id="${stoneId}"]`)
  const entry = page.locator(`[data-entry-id="${ledgerId}"]`)
  await stone.scrollIntoViewIfNeeded()
  await entry.scrollIntoViewIfNeeded()
  // The sheet may scroll smoothly; let it settle before measuring.
  await frames(page, 40)
  const a = (await stone.boundingBox())!
  const b = (await entry.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 - 30, a.y + a.height / 2 + 5, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(stone).toContainText('Joined')
}

/** Picks the kind of mismatch and flags the line the cursor stands on, by mouse. */
async function flagByMouse(page: Page, kind: 'Date' | 'Plot' | 'Missing certificate'): Promise<void> {
  await page.locator('.ledger__kind').filter({ hasText: kind }).click()
  await page.getByRole('button', { name: /Flag mismatch/ }).click()
}

const BELL_TAB: Record<string, string> = { pell: 'Pell', hale: 'Hale', ames: 'Ames' }

/** Reads all three sides of the current post with real clicks. */
async function examineByMouse(page: Page): Promise<void> {
  for (const side of ['Turn the bell', 'Inspect the rope', 'Read the tag']) {
    await page.locator('.bells__facet-btn').filter({ hasText: side }).click()
    await page.locator('.bells__act').filter({ hasText: 'Inspect' }).click()
  }
}

test('mouse: ledger with a wrong flag, bells with a wrong post, then both altar answers at night', async ({ page }) => {
  test.setTimeout(420_000)
  const { errors, begun } = await boot(page)
  const spawn = (await page.evaluate(() => window.__lastRites!.body()!.feet)) as number[]
  const shelf = (await page.evaluate(() => window.__lastRites!.interactableCentre('ledger-shelf')))!

  // 1a: the page on the hut shelf. The first Minigame must be reachable within 3 minutes of Begin.
  // The test positions the keeper, so the walk is also estimated: straight-line metres from the
  // spawn at walking speed (3.0 m/s, design bible §6); the hut is a few steps from the spawn.
  await useProp(page, 'ledger-shelf')
  const wall = Date.now() - begun
  const gameSeconds = (await world(page)).phaseTime
  const metres = Math.hypot(shelf[0] - spawn[0], shelf[2] - spawn[2])
  const walkSeconds = metres / 3.0
  mkdirSync(LOGS, { recursive: true })
  writeFileSync(
    `${LOGS}/case1-first-minigame.json`,
    JSON.stringify(
      { wallSecondsFromBegin: wall / 1000, gameSecondsIntoDay: gameSeconds, spawnToShelfMetres: metres, walkSeconds, limitSeconds: 180 },
      null,
      2,
    ),
  )
  console.log(
    `[case1] first Minigame open ${(wall / 1000).toFixed(1)} s after Begin (${gameSeconds.toFixed(1)} s game time); ` +
      `walk from spawn ${metres.toFixed(1)} m = ${walkSeconds.toFixed(1)} s`,
  )
  expect(gameSeconds + walkSeconds).toBeLessThan(180)
  await expect(page.getByRole('dialog', { name: 'Ledger Cross-check' })).toBeVisible()

  // Pell: join the stone to its entry, a WRONG kind first (plot), then the right one (date).
  await dragLine(page, 'pell', 'l-pell')
  await flagByMouse(page, 'Plot')
  await expect(result(page)).toContainText('These two agree')
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(1)
  expect(await solvedMinigames(page)).not.toContain('1a')
  await flagByMouse(page, 'Date')
  await expect(page.locator('[data-stone-id="pell"]')).toContainText('Flagged: Date')

  // Ames: the missing certificate. Two lines drawn: screenshot pair.
  await dragLine(page, 'ames', 'l-ames')
  await flagByMouse(page, 'Missing certificate')
  await expect(page.locator('[data-stone-id="ames"]')).toContainText('Flagged: Missing certificate')
  await expect(page.locator('.ledger__line')).toHaveCount(2)
  await shoot(page, 'case1-ledger')

  // Hale: the plot. Three right flags solve 1a.
  await dragLine(page, 'hale', 'l-hale')
  await flagByMouse(page, 'Plot')
  await expect(result(page)).toContainText('Three burials do not add up')
  await expect.poll(() => solvedMinigames(page)).toContain('1a')
  await page.getByRole('button', { name: /Close/ }).first().click()
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // 1b: the bell posts stand now. Open Pell's post, then examine all three.
  await useProp(page, 'bell-pell')
  await expect(page.getByRole('dialog', { name: 'The Bell Posts' })).toBeVisible()
  await examineByMouse(page)
  await shoot(page, 'case1-bells')
  for (const key of ['hale', 'ames']) {
    await page.locator('.bells__post-tab').filter({ hasText: BELL_TAB[key] }).click()
    await examineByMouse(page)
  }
  await expect.poll(async () => (await caseState(page)).cases[CASE_ID].bellsExamined.length).toBe(3)
  // The wrong post (Hale's rope is whole) costs a wrong answer and says so.
  await page.locator('.bells__post-tab').filter({ hasText: 'Hale' }).click()
  await page.getByRole('button', { name: /This one/ }).click()
  await expect(result(page)).toContainText('That rope is sound')
  expect(await solvedMinigames(page)).not.toContain('1b')
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(2)
  // The right post: Pell's cut rope.
  await page.locator('.bells__post-tab').filter({ hasText: 'Pell' }).click()
  await page.getByRole('button', { name: /This one/ }).click()
  await expect.poll(() => solvedMinigames(page)).toContain('1b')
  await expect(page.locator('.bells__solved')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // The case board now holds the pinned clues; the altar answers come at night.
  await page.evaluate(() => window.__lastRites!.giveAllClues())
  await intoNight(page)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0, undefined, {
    timeout: 60_000,
  })
  await page.evaluate(() => window.__lastRites!.killAll())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0, undefined, {
    timeout: 30_000,
  })

  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Altar' })
  await expect(panel).toBeVisible()
  const slots = panel.locator('.altar-panel__slot')
  await expect(slots).toHaveCount(2)
  await slots.nth(0).selectOption({ label: "Hale's grave" })
  await slots.nth(1).selectOption({ label: 'fresh flowers show she was still visited' })
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

  // Wait the lock out, then give the right answer: waves stop and the sunrise plays.
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).toContainText('Check each blank', { timeout: 60_000 })
  await slots.nth(0).selectOption({ label: "Pell's grave" })
  await slots.nth(1).selectOption({ label: 'the bell rope was cut and the certificate was signed before the death' })
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn', undefined, {
    timeout: 30_000,
  })
  const log = await page.evaluate(() => window.__lastRites!.events().map((e) => e.type))
  expect(log).toContain('nightCleared')
  expect(log).toContain('dawnStarted')
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0, undefined, {
    timeout: 30_000,
  })

  expect(errors).toEqual([])
})

test('keyboard only: ledger and bells are solved with arrows, Enter, F, 1-3, Tab and C', async ({ page }) => {
  test.setTimeout(300_000)
  const { errors } = await boot(page)
  // A real player's cursor is free while a Minigame is open; drop the fake lock so Tab behaves.
  const key = (code: string, times = 1) => page.keyboard.press(code, { delay: 20 }).then(async () => {
    for (let i = 1; i < times; i++) await page.keyboard.press(code, { delay: 20 })
  })

  await useProp(page, 'ledger-shelf')
  await page.evaluate(() => window.__lastRites!.lockless(false))
  const hale = page.locator('[data-stone-id="hale"]')
  await expect(page.locator('[data-stone-id="marsh"]')).toBeFocused()

  // Hale: stone 2 -> Enter selects -> Left to the entry side -> Enter joins. A wrong kind first.
  await key('ArrowDown')
  await expect(hale).toBeFocused()
  await key('Enter')
  await key('ArrowLeft')
  await expect(page.locator('[data-entry-id="l-hale"]')).toBeFocused()
  await key('Enter')
  await expect(hale).toContainText('Joined')
  await key('Digit1')
  await key('KeyF')
  await expect(result(page)).toContainText('These two agree')
  await key('Digit2')
  await key('KeyF')
  await expect(hale).toContainText('Flagged: Plot')

  // Ames (certificate).
  await key('ArrowRight')
  await key('ArrowDown')
  await expect(page.locator('[data-stone-id="ames"]')).toBeFocused()
  await key('Enter')
  await key('ArrowLeft')
  await expect(page.locator('[data-entry-id="l-ames"]')).toBeFocused()
  await key('Enter')
  await key('Digit3')
  await key('KeyF')
  await expect(page.locator('[data-stone-id="ames"]')).toContainText('Flagged: Missing certificate')

  // Pell (date): the entry is the last on the left page.
  await key('ArrowRight')
  await key('ArrowDown')
  await expect(page.locator('[data-stone-id="pell"]')).toBeFocused()
  await key('Enter')
  await key('ArrowLeft')
  await key('ArrowDown', 4)
  await expect(page.locator('[data-entry-id="l-pell"]')).toBeFocused()
  await key('Enter')
  await key('Digit1')
  await key('KeyF')
  await expect(result(page)).toContainText('Three burials do not add up')
  await expect.poll(() => solvedMinigames(page)).toContain('1a')
  await key('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // 1b: back to a free-look cursor for the walk, then the overlay by keyboard.
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await useProp(page, 'bell-pell')
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await expect(page.locator('.bells__view')).toBeFocused()
  for (let post = 0; post < 3; post++) {
    // Enter reads a side; Right turns to the next; Tab moves to the next post.
    await key('Enter')
    await key('ArrowRight')
    await key('Enter')
    await key('ArrowRight')
    await key('Enter')
    if (post < 2) await key('Tab')
  }
  await expect.poll(async () => (await caseState(page)).cases[CASE_ID].bellsExamined.length).toBe(3)
  // Focus is on Ames' post: C names it, wrongly. Tab wraps to Pell, whose rope was cut.
  await key('KeyC')
  await expect(result(page)).toContainText('That rope is sound')
  await key('Tab')
  await key('KeyC')
  await expect.poll(() => solvedMinigames(page)).toContain('1b')
  await key('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  expect(errors).toEqual([])
})
