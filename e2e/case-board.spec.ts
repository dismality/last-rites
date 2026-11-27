import { test, expect, type Locator, type Page } from '@playwright/test'

// Spec 10 task 2.7: the Case tab, the hint buttons, the altar panel and the Closed cases tab in
// real Chrome. Since the playtest story pass no case links clues with red string: each case is
// written up as findings, step by step, and its altar takes a typed name (rewritten 2026-11-28). Real mouse and keyboard do the playing; the dev hook only sets up (gives clues and
// coins, moves the clock). Waits are polled state or rendered-frame counts, never fixed sleeps.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const

interface WorldSnap {
  phase: string
  phaseTime: number
}
interface StageSnap {
  stage: number
  caseSolved: boolean
  nightElapsed: number
  altar: { lockedUntil: number; wrong: number }
}

const world = (page: Page) =>
  page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseJson = (page: Page) =>
  page.evaluate(() => JSON.stringify(window.__lastRites!.caseState()))
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

async function boot(page: Page): Promise<string[]> {
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
  return errors
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

/** J, then the Case tab with a real click. */
async function openCaseTab(page: Page): Promise<void> {
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Case board', exact: true }).click()
  await expect(page.locator('.case-board')).toBeVisible()
}

/** One handwriting sample button on the Case tab (Case 3, step 5). */
const hand = (page: Page, id: string) => page.locator(`.hand__sample[data-sample="${id}"]`)
const HANDS = ['ledger', 'receipt', 'note', 'signature'] as const

async function shoot(page: Page, name: string): Promise<void> {
  // Let the journal's open fade finish so the first shot is not see-through.
  await frames(page, 40)
  for (const s of SIZES) {
    await page.setViewportSize(s)
    await frames(page, 6)
    await page.screenshot({ path: `${SHOTS}/${name}-${s.width}x${s.height}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await frames(page, 4)
}

/** Case 3, The Sealed Catacombs: the first relic of the rite. */
const FIRST_RELIC = "Crane's Rosary"

/** Starts Stage 3 by day. */
async function caseThree(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToStage(3))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 3)
}

/** Case 3 up to Elias searched, through the real store actions the props call. */
async function caseThreeToHandwriting(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.solveCurrentMinigame()) // 3a, the hymn board
  await page.evaluate(() => window.__lastRites!.giveClue('hearse-cart-ruts'))
  await page.evaluate(() => window.__lastRites!.pullPin()) // 3b
  await page.evaluate(() => window.__lastRites!.searchElias()) // 3c
}

const steps = (page: Page) => page.locator('.case1__steps > li')

/** Moves keyboard focus to an element with Tab, as a keyboard player would. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 40 && !(await target.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

test('mouse: the journal writes Case 3 up step by step, the handwriting by clicks, the rite slots and a hint tier', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  await caseThree(page)
  await openCaseTab(page)

  // No red string and no curse meter: the case is written up as findings.
  await expect(page.locator('.case-curse')).toHaveCount(0)
  await expect(page.locator('.case-string--right, .case-string--wrong')).toHaveCount(0)
  // Only the first step shows at first, and it says where to start.
  await expect(steps(page)).toHaveCount(1)
  await expect(steps(page).first()).toContainText('The hymn board')
  await expect(steps(page).first()).toContainText('has been changed')

  // Each finding writes itself in and opens the next step.
  await page.evaluate(() => window.__lastRites!.solveCurrentMinigame())
  await expect(steps(page).first()).toContainText('BELOW')
  await expect(steps(page).first()).toHaveClass(/is-done/)
  await expect(steps(page)).toHaveCount(2)
  await expect(steps(page).nth(1)).toContainText('Look for cart ruts at the Row gate')
  await page.evaluate(() => window.__lastRites!.giveClue('hearse-cart-ruts'))
  await expect(steps(page).nth(1)).toContainText('Crane crypt')
  await expect(steps(page)).toHaveCount(3)
  await page.evaluate(() => window.__lastRites!.pullPin())
  await expect(steps(page).nth(2)).toContainText('Vane raven')
  await page.evaluate(() => window.__lastRites!.searchElias())
  await expect(steps(page).nth(3)).toContainText('never sent')
  await expect(steps(page)).toHaveCount(5)

  // Step 5: four hands side by side. A real click on each circles its letters and says what they show.
  const tally = page.locator('.case1__tally')
  await expect(tally).toHaveText('Compared: 0 of 4')
  for (const [i, id] of HANDS.entries()) {
    await expect(hand(page, id)).toHaveAttribute('aria-pressed', 'false')
    await expect(hand(page, id)).toContainText('Not looked at yet')
    await hand(page, id).click()
    await expect(hand(page, id)).toHaveAttribute('aria-pressed', 'true')
    if (i < HANDS.length - 1) await expect(tally).toHaveText(`Compared: ${i + 1} of 4`)
  }
  await expect(hand(page, 'note')).toContainText('A looped V')
  await expect(hand(page, 'signature')).toContainText('No loop on the V')
  await expect(steps(page).nth(4)).toContainText('Silas Vane, wrote them')
  await expect.poll(() => caseJson(page)).toContain('"3d"')
  // Step 6 names the question to answer at the altar tonight.
  await expect(steps(page)).toHaveCount(6)
  await expect(steps(page).nth(5)).toContainText('Who sealed Elias Thorne in the Crane crypt?')

  await shoot(page, 'case-board')

  // The rite's order: the final-question slots are real selects.
  const slots = page.locator('.case-final__slot')
  await expect(slots).toHaveCount(5)
  await slots.nth(0).selectOption({ label: FIRST_RELIC })
  await expect.poll(() => caseJson(page)).toContain(FIRST_RELIC)

  // Hints: with no coins the button is off and says why; with coins tier 1 costs 5 and reveals.
  await page.evaluate(() => window.__lastRites!.setCoins(0))
  const buy = page.getByRole('button', { name: /Reveal hint 1/ })
  await expect(buy).toBeDisabled()
  await expect(buy).toContainText('5 Grave Coins')
  await expect(page.locator('.case-hint__why').first()).toContainText('Needs 5 Grave Coins')
  await page.evaluate(() => window.__lastRites!.setCoins(12))
  await expect(buy).toBeEnabled()
  await buy.click()
  await expect(page.locator('.case-hint__text')).toHaveCount(1)
  await expect(page.locator('.case-hint__text')).toContainText('Hint 1.')
  await expect(page.locator('.case-hints__coins')).toHaveText(/^Grave Coins: 7(?!\d)/)
  // Tier 2 now costs 10, which 7 coins cannot pay.
  await expect(page.getByRole('button', { name: /Reveal hint 2/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Reveal hint 2/ })).toContainText('10 Grave Coins')

  expect(errors).toEqual([])
})

test('keyboard only: J, arrow to the Case tab, Tab to each hand, Enter compares, slots by arrows', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  await caseThree(page)
  await caseThreeToHandwriting(page)

  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  // The test hook fakes pointer lock, and the game swallows Tab while locked. A real player's
  // cursor is free with the journal open, so drop the fake lock to get the browser's Tab focus.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  // The objective needs the Case tab (compare the hands), so the journal may open on it; if it
  // opens on Pages instead, the Pages tab holds focus and two arrows reach Case.
  const caseTab = page.getByRole('tab', { name: 'Case board', exact: true })
  if ((await caseTab.getAttribute('aria-selected')) !== 'true') {
    await expect(page.getByRole('tab', { name: 'Pages' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
  }
  await expect(caseTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.case-board')).toBeVisible()

  // Tab to each hand and press Enter: every one is compared, by keyboard alone.
  for (const id of HANDS) {
    await tabTo(page, hand(page, id))
    await page.keyboard.press('Enter')
    await expect(hand(page, id)).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(steps(page).nth(4)).toContainText('Silas Vane, wrote them')

  // Tab on to the first final-question select, and fill it by keyboard.
  const first = page.locator('.case-final__slot').first()
  await tabTo(page, first)
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => await first.inputValue()).not.toBe('')

  // Esc closes the journal by day.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toHaveCount(0)

  expect(errors).toEqual([])
})

test('the day journal pauses the world; the night journal does not', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)

  // Day: sim time stands still while the journal is open, and moves on again after it closes.
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await frames(page, 10)
  const t0 = (await world(page)).phaseTime
  await frames(page, 90)
  expect((await world(page)).phaseTime).toBe(t0)
  await expect(page.locator('.journal--running')).toHaveCount(0)
  await page.getByRole('button', { name: /Close journal/ }).click()
  await expect(page.getByRole('dialog', { name: 'Journal' })).toHaveCount(0)
  await expect.poll(async () => (await world(page)).phaseTime).toBeGreaterThan(t0)

  // Night: the journal opens, says the world is moving, and sim time keeps advancing.
  await intoNight(page)
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await expect(page.locator('.journal--running')).toBeVisible()
  await expect(page.getByText('The world is still moving')).toBeVisible()
  const n0 = (await world(page)).phaseTime
  await frames(page, 90)
  expect((await world(page)).phaseTime).toBeGreaterThan(n0)
  expect((await world(page)).phase).toBe('night')
  // Esc at night opens the pause menu over the journal instead of closing it.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /paused/i })).toBeVisible()

  expect(errors).toEqual([])
})

test('altar: a wrong name locks it and wakes a wave, the right one solves the case; Closed cases shows the page', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.giveAllClues())
  await intoNight(page)

  // Let the first wave arrive, then clear the field so a new spawn can only come from the answer.
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

  // Open the panel and type a WRONG name.
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Altar' })
  await expect(panel).toBeVisible()
  await expect(panel.locator('.altar-panel__status')).toContainText('Type the name')
  const input = panel.locator('.altar-panel__input')
  await input.fill('Tobias Hale')
  await shoot(page, 'case-altar')

  await panel.getByRole('button', { name: 'Answer' }).click()
  await expect(panel.locator('.altar-panel__result')).toContainText('A sour note')
  await expect(panel.locator('.altar-panel__status')).toContainText('The altar is silent: 0:')
  await expect(panel.locator('.altar-panel__count')).toHaveText('Wrong answers on this case: 1')
  let s = await stage(page)
  expect(s.caseSolved).toBe(false)
  expect(s.altar.wrong).toBe(1)
  // The wave is instant: zombies appear at once on a field that was empty.
  await expect.poll(() => enemyCount(page), { timeout: 20_000 }).toBeGreaterThan(0)

  // The lock counts down as text.
  const readSecs = async () => {
    const t = (await panel.locator('.altar-panel__status').textContent()) ?? ''
    const m = /silent: 0:(\d+)/.exec(t)
    return m ? Number(m[1]) : null
  }
  const first = await readSecs()
  expect(first).not.toBeNull()
  expect(first!).toBeGreaterThan(20)
  await expect.poll(async () => (await readSecs()) ?? 99, { timeout: 20_000 }).toBeLessThan(first!)
  // Answering while locked says so and changes nothing.
  await panel.getByRole('button', { name: 'Answer' }).click()
  await expect(panel.locator('.altar-panel__result')).toContainText('The altar is silent')
  expect((await stage(page)).altar.wrong).toBe(1)

  // Wait the lock out (sim time), then give the RIGHT answer.
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).toContainText('Type the name', {
    timeout: 60_000,
  })
  await input.fill('Josiah Vane')
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  // The keeper's summary writes itself in the panel; Close puts it away.
  await expect(panel.locator('.handwritten')).toBeVisible()
  await panel.getByRole('button', { name: /Close/ }).click()
  await expect(panel).toHaveCount(0)
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn',
    undefined,
    {
      timeout: 30_000,
    },
  )
  const log = await page.evaluate(() => window.__lastRites!.events().map((e) => e.type))
  expect(log).toContain('nightCleared')

  // No boon is offered at dawn any more (playtest, 2026-11-27): the dawn goes straight on to day.
  await expect(page.locator('.dawn-picker__card')).toHaveCount(0)
  // The dawn summary card sits above everything for the 10 s of dawn, so read the journal by day.
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'day',
    undefined,
    {
      timeout: 60_000,
    },
  )

  // Closed cases: the page of the solved case is there.
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Closed cases' }).click()
  const closed = page.locator('.closed-cases')
  await expect(closed).toBeVisible()
  await expect(closed).toContainText('Cases closed: 1 of 3')
  await expect(closed).toContainText('Saved by the Bell')
  await expect(closed).toContainText('signed John Pell dead a day early')
  await shoot(page, 'case-closed')

  // By the next day stage 2 has begun (its case unsolved), and case 1 stays closed.
  s = await stage(page)
  expect(s.stage).toBe(2)
  expect(s.caseSolved).toBe(false)
  expect(await caseJson(page)).toContain('"closed":["saved-by-the-bell"]')
  expect(errors).toEqual([])
})
