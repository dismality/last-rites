import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 2.7: the case board, the hint buttons, the altar panel and the Closed cases tab in
// real Chrome. Real mouse and keyboard do the playing; the dev hook only sets up (gives clues and
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

const world = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('world') as WorldSnap)
const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseJson = (page: Page) => page.evaluate(() => JSON.stringify(window.__lastRites!.caseState()))
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
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night')
}

/** J, then the Case tab with a real click. */
async function openCaseTab(page: Page): Promise<void> {
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Case', exact: true }).click()
  await expect(page.locator('.case-board')).toBeVisible()
}

const card = (page: Page, id: string) => page.locator(`[data-clue-id="${id}"]`)

/** Drags from the centre of one card to the centre of another with the real mouse. */
async function dragCard(page: Page, from: string, to: string): Promise<void> {
  const a = (await card(page, from).boundingBox())!
  const b = (await card(page, to).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 10, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

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

const RIGHT_GRAVE = "Pell's grave"
const RIGHT_REASON = 'the bell rope was cut and the certificate was signed before the death'

test('mouse drag, a wrong string, keyboard link, curse meter, slots and a hint tier', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.giveAllClues())
  await openCaseTab(page)

  // Seven clue cards are pinned, and the curse meter starts full.
  await expect(page.locator('.clue-card')).toHaveCount(7)
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 10 / 10')

  // A right pair by mouse drag: a solid string with a check, the deduction note and the meter.
  await dragCard(page, 'pell-rope-cut', 'pell-tag-early')
  await expect(page.locator('.case-tag--right')).toHaveCount(1)
  await expect(page.locator('.case-tag--right')).toHaveText('✓')
  await expect(page.locator('.case-note')).toContainText('Right link')
  await expect(page.locator('.case-notes li')).toHaveCount(1)
  await expect(page.locator('.case-notes li').first()).toContainText('signed the certificate before he had died')
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 9 / 10')

  // A wrong pair differs by shape and words: a dashed string with a cross, no note, meter unchanged.
  await dragCard(page, 'hale-fresh-flowers', 'marsh-stone-toppled')
  await expect(page.locator('.case-tag--wrong')).toHaveCount(1)
  await expect(page.locator('.case-tag--wrong')).toHaveText('✗')
  await expect(page.locator('.case-string--wrong')).toHaveCount(1)
  await expect(page.locator('.case-string--right')).toHaveCount(1)
  await expect(page.locator('.case-note')).toContainText('Dashed string')
  await expect(page.locator('.case-notes li')).toHaveCount(1)
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 9 / 10')
  // The two strings differ in more than colour: dash pattern and stroke width.
  const style = await page.evaluate(() => {
    const read = (sel: string) => {
      const cs = getComputedStyle(document.querySelector(sel)!)
      return { dash: cs.strokeDasharray, width: parseFloat(cs.strokeWidth) }
    }
    return { right: read('.case-string--right'), wrong: read('.case-string--wrong') }
  })
  expect(style.wrong.dash).not.toBe(style.right.dash)
  expect(style.wrong.width).toBeLessThan(style.right.width)

  // A second right pair by keyboard: select one card, then the other, with Enter.
  await card(page, 'ledger-no-certificates').focus()
  await page.keyboard.press('Enter')
  await expect(card(page, 'ledger-no-certificates')).toHaveAttribute('aria-pressed', 'true')
  await card(page, 'ledger-date-mismatch').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.case-tag--right')).toHaveCount(2)
  await expect(page.locator('.case-notes li')).toHaveCount(2)
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 8 / 10')
  // Linking the same pair again changes nothing.
  await dragCard(page, 'pell-rope-cut', 'pell-tag-early')
  await expect(page.locator('.case-note')).toContainText('already joined')
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 8 / 10')

  await shoot(page, 'case-board')

  // The final-question slots are real selects.
  const slots = page.locator('.case-final__slot')
  await expect(slots).toHaveCount(2)
  await slots.nth(0).selectOption({ label: RIGHT_GRAVE })
  await slots.nth(1).selectOption({ label: RIGHT_REASON })
  await expect.poll(() => caseJson(page)).toContain(RIGHT_REASON)
  expect(await caseJson(page)).toContain(RIGHT_GRAVE)

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
  await expect(page.locator('.case-hints__coins')).toHaveText('Grave Coins: 7')
  // Tier 2 now costs 10, which 7 coins cannot pay.
  await expect(page.getByRole('button', { name: /Reveal hint 2/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Reveal hint 2/ })).toContainText('10 Grave Coins')

  expect(errors).toEqual([])
})

test('keyboard only: J, arrow to the Case tab, Tab to cards, Enter links, slots by arrows', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.giveAllClues())

  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  // The Pages tab holds focus on open; two arrows reach Case.
  await expect(page.getByRole('tab', { name: 'Pages' })).toBeFocused()
  // The test hook fakes pointer lock, and the game swallows Tab while locked. A real player's
  // cursor is free with the journal open, so drop the fake lock to get the browser's Tab focus.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Case', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.case-board')).toBeVisible()

  // Tab walks into the first two cards (ledger entries); Enter on each ties them. The scrollable
  // panel may take one Tab stop first.
  const firstCard = card(page, 'ledger-no-certificates')
  for (let i = 0; i < 3 && !(await firstCard.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(firstCard).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(card(page, 'ledger-date-mismatch')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.case-notes li')).toHaveCount(1)
  await expect(page.locator('.case-curse__label')).toHaveText('Curse 9 / 10')
  await expect(page.locator('.case-note')).toContainText('Right link')

  // A second right pair, again from the keyboard alone.
  await page.keyboard.press('Tab')
  await expect(card(page, 'pell-rope-cut')).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(card(page, 'ames-bell-rusted')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.case-tag--right')).toHaveCount(2)

  // Tab on past the remaining cards to the first final-question select, and fill it by keyboard.
  const first = page.locator('.case-final__slot').first()
  for (let i = 0; i < 10 && !(await first.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(first).toBeFocused()
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

test('altar: a wrong answer locks it and wakes a wave, the right one solves the case; Closed cases shows the page', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.giveAllClues())
  await intoNight(page)

  // Let the first wave arrive, then clear the field so a new spawn can only come from the answer.
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0, undefined, {
    timeout: 60_000,
  })
  await page.evaluate(() => window.__lastRites!.killAll())
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length === 0, undefined, {
    timeout: 30_000,
  })

  // Open the panel and fill the blanks with a WRONG answer by mouse.
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Altar' })
  await expect(panel).toBeVisible()
  await expect(panel.locator('.altar-panel__status')).toContainText('Check each blank')
  const slots = panel.locator('.altar-panel__slot')
  await expect(slots).toHaveCount(2)
  await slots.nth(0).selectOption({ label: "Hale's grave" })
  await slots.nth(1).selectOption({ label: 'fresh flowers show she was still visited' })
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
  await expect(panel.locator('.altar-panel__status')).toContainText('Check each blank', { timeout: 60_000 })
  await slots.nth(0).selectOption({ label: RIGHT_GRAVE })
  await slots.nth(1).selectOption({ label: RIGHT_REASON })
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await expect(panel).toHaveCount(0)
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dawn', undefined, {
    timeout: 30_000,
  })
  const log = await page.evaluate(() => window.__lastRites!.events().map((e) => e.type))
  expect(log).toContain('nightCleared')

  // Dawn waits for a boon: take the first with a real click, as the card says.
  // A real player's cursor is free at dawn; the fake lock would keep the picker out of reach.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  // The picker's own number-key shortcut (dawn-picker.spec.ts covers the mouse path).
  await expect(page.locator('.dawn-picker__card')).toHaveCount(3)
  await page.keyboard.press('Digit1')
  await expect(page.locator('.dawn-picker__card')).toHaveCount(0)
  await page.evaluate(() => window.__lastRites!.lockless(true))
  // The dawn summary card sits above everything for the 10 s of dawn, so read the journal by day.
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'day', undefined, {
    timeout: 60_000,
  })

  // Closed cases: the page of the solved case is there.
  await page.keyboard.press('KeyJ')
  await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
  await page.getByRole('tab', { name: 'Closed cases' }).click()
  const closed = page.locator('.closed-cases')
  await expect(closed).toBeVisible()
  await expect(closed).toContainText('Cases closed: 1 of 3')
  await expect(closed).toContainText('Saved by the Bell')
  await expect(closed).toContainText('safety coffins with a bell on a rope')
  await shoot(page, 'case-closed')

  // By the next day stage 2 has begun (its case unsolved), and case 1 stays closed.
  s = await stage(page)
  expect(s.stage).toBe(2)
  expect(s.caseSolved).toBe(false)
  expect(await caseJson(page)).toContain('"closed":["saved-by-the-bell"]')
  expect(errors).toEqual([])
})
