// The full Short Vigil story for the playthrough test (spec 10 task 12), one function per stage.
// Only `page.mouse` and `page.keyboard` act; the debug hook is read for state. See walker.ts.

import { expect, type Locator, type Page } from '@playwright/test'
import { body, frames, log, lookAt, moveMouse, pressE, useProp, walkTo, type P2 } from './walker'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

interface CaseSnap {
  cases: Record<
    string,
    { minigames: string[]; found: string[]; wrongAnswers: number }
  >
  closed: string[]
}
export const world = (page: Page) =>
  page.evaluate(
    () =>
      window.__lastRites!.snapshot('world') as {
        phase: string
        phaseTime: number
        nightNumber: number
      },
  )
export const stageNo = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.stageState() as { stage: number }).stage)
export const caseState = (page: Page) =>
  page.evaluate(() => window.__lastRites!.caseState() as CaseSnap)
export const solved = async (page: Page, caseId: string) =>
  (await caseState(page)).cases[caseId].minigames
export const keyItems = (page: Page) =>
  page.evaluate(
    () =>
      (window.__lastRites!.snapshot('inventory') as { inventory: { keyItems: string[] } }).inventory
        .keyItems,
  )
export const shell = (page: Page) => page.locator('.minigame-shell')
export const objective = (page: Page) => page.locator('.hud-objective__main')

/** The tracker's main line, checked and logged at each step (Req 30.3). */
export async function expectObjective(page: Page, text: RegExp | string): Promise<void> {
  await expect(objective(page)).toContainText(text, { timeout: 30_000 })
  log(`objective: ${await objective(page).textContent()}`)
}

// ---------------------------------------------------------------------------
// Real mouse and keyboard on the 2D screens
// ---------------------------------------------------------------------------

/** A real mouse click at the centre of an element. */
export async function click(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()
  const b = (await target.boundingBox())!
  await moveMouse(page, b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await frames(page, 2)
}

/** Picks an option of a <select> as a player does: click it, arrow to the option, Enter. */
export async function choose(page: Page, select: Locator, label: string): Promise<void> {
  const labels = await select.locator('option').allTextContents()
  const want = labels.findIndex((l) => l.trim() === label)
  expect(want, `option "${label}" in ${labels.join(' | ')}`).toBeGreaterThanOrEqual(0)
  await click(page, select)
  const now = await select.evaluate((s) => (s as HTMLSelectElement).selectedIndex)
  const key = want > now ? 'ArrowDown' : 'ArrowUp'
  for (let i = 0; i < Math.abs(want - now); i++) await page.keyboard.press(key)
  await page.keyboard.press('Enter')
  await expect.poll(() => select.evaluate((s) => (s as HTMLSelectElement).selectedIndex)).toBe(want)
}

/** A real drag with the mouse from one element to another. */
export async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded()
  await to.scrollIntoViewIfNeeded()
  await frames(page, 30)
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await moveMouse(page, a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 - 20, a.y + a.height / 2 + 5, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await moveMouse(page, b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.up()
  await frames(page, 4)
}

/** Clicks the canvas so the game takes the pointer lock back after a 2D screen. */
export async function relock(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    if (await page.evaluate(() => document.pointerLockElement !== null)) return
    // The cursor is free here, so bringing it back to the middle turns nothing.
    await moveMouse(page, 640, 360)
    await page.mouse.down()
    await page.mouse.up()
    await frames(page, 6)
  }
  expect(
    await page.evaluate(() => document.pointerLockElement !== null),
    'pointer lock back on the canvas',
  ).toBe(true)
}

export async function closeMinigame(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(shell(page)).toHaveCount(0)
  await relock(page)
}

/** Opens the minigame at a prop with E. */
export async function openMinigame(page: Page, id: string): Promise<void> {
  await useProp(page, id, async () => (await shell(page).count()) > 0)
  await expect(shell(page)).toBeVisible()
}

// ---------------------------------------------------------------------------
// Start, god mode, the clock
// ---------------------------------------------------------------------------

/** New Game in Short Vigil through the real menus; returns the wall-clock time Begin was clicked. */
export async function newGame(page: Page): Promise<number> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  const cont = page.getByRole('button', { name: 'Continue' })
  if (await cont.isVisible().catch(() => false)) await click(page, cont)
  await click(page, page.getByRole('button', { name: 'New Game' }))
  await click(page, page.getByRole('radio', { name: /Short Vigil/ }))
  const begun = Date.now()
  await click(page, page.getByRole('button', { name: 'Begin' }))
  // The intro: Space skips it.
  await page.waitForTimeout(1500)
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__lastRites!.body() === null)); i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(1000)
  }
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, {
    timeout: 120_000,
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 120_000 },
  )
  expect(
    (await page.evaluate(() => window.__lastRites!.snapshot('progression') as { mode: string }))
      .mode,
  ).toBe('short-vigil')
  await relock(page)
  return begun
}

/** God mode from the Dev_Panel (the one Dev_Panel action Req 30.2 allows). */
export async function godMode(page: Page): Promise<void> {
  await page.keyboard.press('Backquote')
  const panel = page.getByRole('complementary', { name: 'Developer panel' })
  await expect(panel).toBeVisible()
  const cheats = panel.locator('details', { has: page.locator('summary', { hasText: 'Cheats' }) })
  if (!(await cheats.evaluate((d) => (d as HTMLDetailsElement).open)))
    await click(page, cheats.locator('summary'))
  const toggle = panel.getByRole('button', { name: /God mode/ })
  await click(page, toggle)
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Backquote')
  await expect(panel).toHaveCount(0)
  await relock(page)
}

/** Waits (playing nothing) until the given phase arrives: the real clock, no skip. */
export async function waitPhase(page: Page, phase: string, timeoutMs = 300_000): Promise<void> {
  await page.waitForFunction(
    (p) => (window.__lastRites!.snapshot('world') as { phase: string }).phase === p,
    phase,
    {
      timeout: timeoutMs,
      polling: 500,
    },
  )
}

// ---------------------------------------------------------------------------
// The altar at night
// ---------------------------------------------------------------------------

export const CHAPEL_FRONT: P2 = { x: 10, z: -2.2 }

/** Walks into the chapel and opens the altar with E. */
export async function openAltar(page: Page, dialog: string): Promise<Locator> {
  const panel = page.getByRole('dialog', { name: dialog })
  await walkTo(page, CHAPEL_FRONT, { arrive: 1.2, label: 'chapel front door' })
  await useProp(page, 'case-altar', async () => (await panel.count()) > 0, { reach: 1.6 })
  await expect(panel).toBeVisible()
  return panel
}

/** Answers a case at the altar panel: one option per blank, then Answer. */
export async function answerAltar(page: Page, panel: Locator, picks: string[]): Promise<void> {
  const slots = panel.locator('.altar-panel__slot')
  await expect(slots).toHaveCount(picks.length)
  for (const [i, label] of picks.entries()) await choose(page, slots.nth(i), label)
  await click(page, panel.getByRole('button', { name: 'Answer' }))
}

/** Dawn: picks the first boon with a real click and takes the lock back. */
export async function pickBoon(page: Page): Promise<void> {
  const card = page.locator('.dawn-picker__card').first()
  await expect(card).toBeVisible({ timeout: 60_000 })
  await click(page, card)
  await page.waitForFunction(
    () =>
      (window.__lastRites!.snapshot('progression') as { pendingPick: unknown }).pendingPick ===
      null,
  )
  await relock(page)
}

// ---------------------------------------------------------------------------
// Stage 1: Saved by the Bell
// ---------------------------------------------------------------------------

const CASE1 = 'saved-by-the-bell'
const CASE1_GRAVES = ['pell', 'ames', 'hale'] as const
/** What differs on each ledger line, as the button reads. */
const LEDGER_MARKS = [
  ['pell', 'The date differs'],
  ['ames', 'The cause differs'],
  ['hale', 'The plot differs'],
] as const
const case1 = async (page: Page) =>
  (await page.evaluate(() => window.__lastRites!.caseState())) as {
    cases: Record<string, { stonesRead: string[]; bellsExamined: string[] }>
  }
const stonesRead = async (page: Page) => (await case1(page)).cases[CASE1].stonesRead
const bellsPulled = async (page: Page) => (await case1(page)).cases[CASE1].bellsExamined

/** Opens the journal with J, goes to the Case board and answers "Which bell was cut?". */
export async function answerCutBellInJournal(page: Page, bell: RegExp): Promise<void> {
  await page.keyboard.press('KeyJ')
  const tab = page.getByRole('tab', { name: 'Case board' })
  await click(page, tab)
  await expect(page.locator('.case1')).toBeVisible()
  await click(page, page.locator('.case1__answer').filter({ hasText: bell }))
  await expect(page.locator('.case1__jv')).toBeVisible()
  await expect(page.locator('.case1__stamp-note')).toContainText('Josiah Vane')
  await page.keyboard.press('Escape')
  await expect(page.locator('.case1')).toHaveCount(0)
  await relock(page)
}

/** Types a name at the altar panel and gives it with Enter. */
export async function typeAltarAnswer(page: Page, panel: Locator, name: string): Promise<void> {
  const input = panel.locator('.altar-panel__input')
  await click(page, input)
  await page.keyboard.type(name, { delay: 20 })
  await expect(input).toHaveValue(name)
  await page.keyboard.press('Enter')
}

export async function stage1(page: Page, begun: number): Promise<{ firstMinigameS: number }> {
  await expectObjective(page, /Craft a weapon at the workbench|Read the page Elias left/)

  // Page 1 on the hut table.
  await useProp(page, 'fixed:fx-page-1', async () => {
    const p = await page.evaluate(() => [
      ...(window.__lastRites!.snapshot('mystery') as { mystery: { pages: Set<number> } }).mystery
        .pages,
    ])
    if (p.includes(1)) return true
    // The page may open its reading view: Escape puts it away.
    if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0)
      await page.keyboard.press('Escape')
    return false
  })
  if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0)
    await page.keyboard.press('Escape')
  await relock(page)

  // The three graves Elias named: read each stone with E (the rubbing opens, Esc puts it away).
  await expectObjective(page, /Read the stones of Pell, Ames and Hale|Craft a weapon/)
  for (const grave of CASE1_GRAVES) {
    await useProp(page, `tombstone-${grave}`, async () => (await stonesRead(page)).includes(grave))
    await expect(page.locator('.rubbing')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.rubbing')).toHaveCount(0)
    await relock(page)
  }

  // 1a: the ledger on the hut shelf. Each line is marked against its stone: what differs.
  await openMinigame(page, 'ledger-shelf')
  const firstMinigameS = (Date.now() - begun) / 1000
  log(`first Minigame open ${firstMinigameS.toFixed(1)} s after Begin`)
  await expect(page.getByRole('dialog', { name: 'The parish ledger' })).toBeVisible()
  for (const [grave, kind] of LEDGER_MARKS) {
    const row = page.locator(`.ledger2__row[data-grave="${grave}"]`)
    await click(page, row.getByRole('button', { name: kind }))
    await expect(row.locator('.ledger2__verdict')).toBeVisible()
  }
  await expect(page.locator('.ledger2__solved')).toContainText('J.V.')
  await expect.poll(() => solved(page, CASE1)).toContain('1a')
  await closeMinigame(page)

  // The bells: E pulls each cord. Ames and Hale ring; Pell's is cut.
  await expectObjective(page, /Pull the bell cords|Craft a weapon/)
  for (const post of ['bell-hale', 'bell-ames', 'bell-pell']) {
    await useProp(page, post, async () => (await bellsPulled(page)).includes(post))
  }

  // The journal asks which bell was cut: Pell's. Its tag names J. Vane.
  await expectObjective(page, /which bell was cut|Craft a weapon/)
  await answerCutBellInJournal(page, /John Pell/)
  await expect.poll(() => solved(page, CASE1)).toContain('1b')

  // Night: the name is typed at the altar.
  await waitPhase(page, 'night')
  const panel = await openAltar(page, 'The Altar')
  await typeAltarAnswer(page, panel, 'josiah vane')
  await page.waitForFunction(
    () => (window.__lastRites!.stageState() as { caseSolved: boolean }).caseSolved,
    undefined,
    {
      timeout: 30_000,
    },
  )
  // The keeper writes the case up in the panel; Show it all, then Close.
  await expect(panel.locator('.handwritten')).toBeVisible()
  await click(page, panel.getByRole('button', { name: 'Show it all' }))
  await expect(panel.locator('.handwritten')).toContainText(
    'The Vanes bury people who know too much',
  )
  await click(page, panel.getByRole('button', { name: /Close/ }))
  await expect(panel).toHaveCount(0)
  await relock(page)
  await waitPhase(page, 'dawn', 60_000)
  await pickBoon(page)
  await page.waitForFunction(
    () => (window.__lastRites!.stageState() as { stage: number }).stage === 2,
    undefined,
    {
      timeout: 120_000,
    },
  )
  return { firstMinigameS }
}

// ---------------------------------------------------------------------------
// Stage 2: The Resurrection Men
// ---------------------------------------------------------------------------

const CASE2 = 'resurrection-men'
/** What each fresh grave should be marked in the register: only Arthur Finch's was robbed. */
const REGISTER_MARKS = [
  ['cobb', 'The grave agrees'],
  ['reade', 'The grave agrees'],
  ['finch', 'It doesn’t match'],
] as const
/** Clicks of "Turn on" from the first crest (owl on a book) to the Vane raven on a coffin. */
const RAVEN_TURNS = 2
const case2 = async (page: Page) =>
  (await caseState(page)).cases[CASE2] as unknown as { gravesSeen: string[]; printTaken: boolean }

export async function stage2(page: Page): Promise<void> {
  await expectObjective(page, /Craft a weapon|Find the key to the Mausoleum Row gate/)

  // Case 1's reward: the Rusted Crypt Key lies in Pell's grave.
  await useProp(page, 'fixed:fx-crypt-key', async () => {
    if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0)
      await page.keyboard.press('Escape')
    return (await keyItems(page)).includes('rusted-crypt-key')
  })
  await relock(page)

  // The Row gate opens to the key.
  const gateOpen = () =>
    page.evaluate(
      () =>
        (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } })
          .mystery.gates['mausoleum-row'],
    )
  await useProp(page, 'gate-mausoleum-row', gateOpen, { reach: 1.6 })

  // The three fresh graves by the lodge: E looks at each one.
  for (const grave of ['cobb', 'reade', 'finch']) {
    await useProp(page, `fresh-grave-${grave}`, async () => (await case2(page)).gravesSeen.includes(grave))
  }

  // 2a: the burial register on the lodge table. Each grave is marked against its line.
  await openMinigame(page, 'burial-register')
  await expect(page.getByRole('dialog', { name: 'The burial register' })).toBeVisible()
  for (const [grave, mark] of REGISTER_MARKS) {
    const row = page.locator(`.register__row[data-grave="${grave}"]`)
    await click(page, row.getByRole('button', { name: mark }))
    await expect(row.locator('.register__verdict')).toBeVisible()
  }
  await expect.poll(() => solved(page, CASE2)).toContain('2a')
  await closeMinigame(page)

  // 2b: the watch log for the 14th. Clicking an empty countersign box solves it.
  await openMinigame(page, 'watch-logbook')
  await click(page, page.locator('.watch__sign--empty').first())
  await expect.poll(() => solved(page, CASE2)).toContain('2b')
  await closeMinigame(page)

  // The print at the foot of Arthur Finch's grave goes into the journal.
  await useProp(page, 'boot-print', async () => (await case2(page)).printTaken)

  // 2c: the boots by the lodge table. Kerr's match the print.
  await openMinigame(page, 'lodge-boots')
  await click(page, page.getByRole('button', { name: "Dale's porter's shoes" }))
  await click(page, page.getByRole('button', { name: "Kerr's work boots" }))
  await expect.poll(() => solved(page, CASE2)).toContain('2c')
  await closeMinigame(page)

  // 2d: Kerr's locker. The dial turns to the Vane crest, then the key; the whistle is inside.
  await openMinigame(page, 'crest-lock')
  for (let k = 0; k < RAVEN_TURNS; k++) await click(page, page.getByRole('button', { name: 'Turn on' }))
  await expect(page.locator('.crestlock__now')).toHaveText(/raven on a coffin/i)
  await click(page, page.getByRole('button', { name: 'Turn the key' }))
  await expect.poll(() => solved(page, CASE2)).toContain('2d')
  await expect(page.locator('.crestlock__receipt')).toContainText('Vane & Sons')
  await closeMinigame(page)
  await useProp(page, 'fixed:fx-bone-whistle', async () => {
    if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0)
      await page.keyboard.press('Escape')
    return (await keyItems(page)).includes('bone-whistle')
  })
  await relock(page)

  // Night: who paid for the bodies is typed at the altar.
  await waitPhase(page, 'night')
  const panel = await openAltar(page, 'The Altar')
  await typeAltarAnswer(page, panel, 'vane and sons')
  await page.waitForFunction(
    () => (window.__lastRites!.stageState() as { caseSolved: boolean }).caseSolved,
    undefined,
    {
      timeout: 30_000,
    },
  )
  await expect(panel.locator('.handwritten')).toBeVisible()
  await click(page, panel.getByRole('button', { name: 'Show it all' }))
  await expect(panel.locator('.handwritten')).toContainText('Vane & Sons paid Kerr')
  await click(page, panel.getByRole('button', { name: /Close/ }))
  await expect(panel).toHaveCount(0)
  await relock(page)
  await waitPhase(page, 'dawn', 60_000)
  await pickBoon(page)
  await page.waitForFunction(
    () => (window.__lastRites!.stageState() as { stage: number }).stage === 3,
    undefined,
    {
      timeout: 120_000,
    },
  )
}

// ---------------------------------------------------------------------------
// Stage 3: The Sealed Catacombs
// ---------------------------------------------------------------------------

const CASE3 = 'sealed-catacombs'
/** The four handwriting samples compared in the journal (3d). */
const HAND_SAMPLES = ['ledger', 'receipt', 'note', 'signature']
/** Clicks of "Letter on" from an empty tile to B, E, L, O, W. */
const BELOW_STEPS = [2, 5, 12, 15, 23]
export const RITE_ORDER = [
  "Crane's Rosary",
  "Sexton's Bell Clapper",
  "Child's Locket",
  'Burial Shroud',
  'Reliquary Heart',
]

const found3 = async (page: Page) => (await caseState(page)).cases[CASE3].found ?? []
const relics = (page: Page) =>
  page.evaluate(
    () =>
      (window.__lastRites!.snapshot('inventory') as { inventory: { relics: string[] } }).inventory
        .relics,
  )
const clues = (page: Page) =>
  page.evaluate(
    () =>
      (window.__lastRites!.snapshot('mystery') as { mystery: { clues: string[] } }).mystery.clues,
  )

/** Picks up a fixed item with E (dismissing its card), until the satchel holds it. */
async function pickUp(page: Page, spawn: string, has: () => Promise<boolean>): Promise<void> {
  await useProp(page, `fixed:${spawn}`, async () => {
    if ((await page.getByRole('button', { name: /Put away/ }).count()) > 0)
      await page.keyboard.press('Escape')
    return has()
  })
  await relock(page)
}
const hasKey = (page: Page, id: string) => async () => (await keyItems(page)).includes(id)
const hasRelic = (page: Page, id: string) => async () => (await relics(page)).includes(id)

export async function stage3Day(page: Page): Promise<void> {
  await expectObjective(page, /Craft a weapon|hymn board/)
  log(`stage 3 keys: ${(await keyItems(page)).join(', ')}`)

  // 3a: the hymn board in the chapel, set to BELOW, then the whistle blown (by day: the stair opens).
  await openMinigame(page, 'hymn-board')
  const tiles = page.locator('.hymn__tile')
  const on = page.getByRole('button', { name: 'Letter on' })
  for (const [i, steps] of BELOW_STEPS.entries()) {
    await click(page, tiles.nth(i))
    for (let k = 0; k < steps; k++) await click(page, on)
  }
  await expect(page.locator('.hymn__tiles')).toHaveAttribute('aria-label', /Tile 5 of 5, W/)
  await click(page, page.getByRole('button', { name: /Blow the whistle/ }))
  await expect.poll(() => solved(page, CASE3)).toContain('3a')
  await closeMinigame(page)

  // The cart ruts at the Row gate, with the ledger and the rosary on the way down the avenue.
  await useProp(page, 'case-clue-hearse-cart-ruts', async () => (await found3(page)).includes('hearse-cart-ruts'))
  await relock(page)
  if (!(await hasKey(page, 'parish-ledger')()))
    await pickUp(page, 'fx-ledger', hasKey(page, 'parish-ledger'))
  await pickUp(page, 'fx-rosary', hasRelic(page, 'crane-rosary'))

  // 3b: the hearse pin out of the Crane crypt door; 3c: Elias searched.
  await expectObjective(page, /Open the Crane crypt door|Craft a weapon/)
  await useProp(page, 'crypt-pin', async () => (await solved(page, CASE3)).includes('3b'))
  await useProp(page, 'elias', async () => (await solved(page, CASE3)).includes('3c'))

  // 3d: the four hands compared in the journal, with clicks.
  await expectObjective(page, /compare the handwriting|Craft a weapon/)
  await page.keyboard.press('KeyJ')
  await click(page, page.getByRole('tab', { name: 'Case board' }))
  for (const id of HAND_SAMPLES) await click(page, page.locator(`.hand__sample[data-sample="${id}"]`))
  await expect.poll(() => solved(page, CASE3)).toContain('3d')
  await page.keyboard.press('Escape')
  await relock(page)

  // The crypt opens on Elias, and the ossuary key with him.
  await pickUp(page, 'fx-ossuary-key', hasKey(page, 'iron-ossuary-key'))
  await expectObjective(
    page,
    /Gather the relics of the rite|Finish the rite at the altar|Craft a weapon/,
  )
  await pickUp(page, 'fx-bell-clapper', hasRelic(page, 'sextons-bell-clapper'))
  // The catacombs: in through the north gate the whistle opened, the shroud, the ossuary door, the heart.
  await pickUp(page, 'fx-shroud', hasRelic(page, 'burial-shroud'))
  const ossuaryOpen = () =>
    page.evaluate(
      () =>
        (window.__lastRites!.snapshot('mystery') as { mystery: { gates: Record<string, boolean> } })
          .mystery.gates.ossuary,
    )
  await useProp(page, 'gate-ossuary', ossuaryOpen, { reach: 1.4 })
  await pickUp(page, 'fx-heart', hasRelic(page, 'reliquary-heart'))
  log(`relics by day: ${(await relics(page)).join(', ')}`)
}

type Enemy = { uid: string; type: string; hp: number; pos: { x: number; z: number } }
const bossStage = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('boss') as { stage: string }).stage)
const crane = (page: Page) =>
  page.evaluate(
    () =>
      (window.__lastRites!.snapshot('enemies') as Enemy[]).find((e) => e.type === 'father-crane') ??
      null,
  )
const endingStage = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('ending') as { stage: string | null }).stage)
const ended = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('ending') as { ending: string | null }).ending)

/** Father Crane, fought with the held weapon: walk up, aim at his chest, real left clicks. */
async function fightCrane(page: Page): Promise<void> {
  const t0 = Date.now()
  let swings = 0
  for (;;) {
    if ((await ended(page)) !== null) break
    const st = await bossStage(page)
    if (st === 'dying' || st === 'dead') break
    expect(Date.now() - t0, 'Crane falls within 8 minutes').toBeLessThan(480_000)
    const c = await crane(page)
    if (!c) {
      await frames(page, 10)
      continue
    }
    const b = await body(page)
    // Melee reaches 1.8 m (centre to centre): close in well inside it, he keeps moving.
    if (Math.hypot(b.feet[0] - c.pos.x, b.feet[2] - c.pos.z) > 1.4) {
      try {
        await walkTo(page, c.pos, { arrive: 1.0, timeoutMs: 6_000, label: 'Father Crane' })
      } catch {
        // He moves; aim and swing from where we are, then close in again.
      }
    }
    await lookAt(page, [c.pos.x, 1.3, c.pos.z])
    await page.mouse.down()
    await frames(page, 3)
    await page.mouse.up()
    // The shovel's cooldown is 0.9 s; a click inside it does nothing.
    await page.waitForTimeout(900)
    if (++swings % 20 === 0) log(`Crane hp ${c.hp} after ${swings} swings`)
  }
  log(`Crane fell after ${swings} swings in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

export async function stage3Night(page: Page): Promise<void> {
  // The Child's Locket shows only at night.
  await waitPhase(page, 'night')
  if (!(await hasRelic(page, 'childs-locket')()))
    await pickUp(page, 'fx-locket', hasRelic(page, 'childs-locket'))
  expect(await relics(page)).toHaveLength(5)
  await expectObjective(page, 'Finish the rite at the altar (5/5)')

  // First the name: a bare "Vane" is asked again, then Silas. Then the rite, relic by relic, with
  // real clicks; Crane rises after the first.
  const panel = await openAltar(page, 'The Rite of Rest')
  await typeAltarAnswer(page, panel, 'Vane')
  await expect(panel.locator('.altar-panel__result')).toContainText('Which Vane?')
  await panel.locator('.altar-panel__input').fill('')
  await typeAltarAnswer(page, panel, 'Silas Vane')
  await expect(panel.locator('.altar-panel__summary')).toBeVisible()
  const slot = (n: number) => panel.locator('.rite-panel__slot').nth(n)
  for (const [i, name] of RITE_ORDER.entries()) {
    await choose(page, slot(i).locator('select'), name)
    await click(page, slot(i).getByRole('button', { name: 'Lay it here' }))
    await expect(slot(i).locator('.rite-panel__done')).toBeVisible({ timeout: 10_000 })
  }
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await relock(page)

  await expect.poll(() => bossStage(page), { timeout: 45_000 }).toBe('risen')
  await expectObjective(page, 'Put Father Crane to rest')
  await fightCrane(page)

  // The rite finishes: Justice for Elias, the walk out, the ending card.
  await expect.poll(() => ended(page), { timeout: 60_000 }).toBe('rest')
  await expect(page.getByLabel('Justice for Elias')).toBeVisible({ timeout: 30_000 })
  log('epilogue: Justice for Elias')
  await page.keyboard.press('Space')
  await expect.poll(() => endingStage(page), { timeout: 30_000 }).not.toBe('epilogue')
  await expect(page.getByTestId('win-card')).toBeVisible({ timeout: 180_000 })
  log('ending card shown')
}

export async function stage3(page: Page): Promise<void> {
  await stage3Day(page)
  await stage3Night(page)
}

export { lookAt, pressE, body }
