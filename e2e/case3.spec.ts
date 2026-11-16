import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 4.8: Stage 3 (The Sealed Catacombs) in real Chrome. Minigames 3a (Hymn Board) and 3b
// (Elias's Last Night) are opened with a real E press at the real props and solved with the real
// mouse and keyboard, a wrong answer first. At night the Rite is worked at the altar panel (a wrong
// relic, then the right order with Crane rising on the first), and the Accusation is given wrong and
// then right; killing Crane finishes the rite and the Justice for Elias epilogue plays. The dev hook
// only sets up (start, stage, positioning, ledger, clock, relics in the satchel, kill stragglers)
// and reads state; no Dev_Panel solve action touches an answer. Waits are polled state or rendered
// frame counts, never fixed sleeps (apart from the held E key).

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
const CASE_ID = 'sealed-catacombs'
const TIMELINE_ORDER = ['dry-boots', 'unsent-letter', 'cart-ruts', 'spilled-oil', 'hearse-pin', 'nail-marks']
const EVIDENCE_PROPS = ['unsent-letter', 'cart-ruts', 'spilled-oil', 'hearse-pin', 'nail-marks']

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
  cases: Record<string, { minigames: string[]; wrongAnswers: number; evidenceFound: string[] }>
}
interface MysterySnap {
  mystery: { gates: { catacombs: boolean }; clues: string[] }
}
interface EndingSnap {
  ending: string | null
  stage: string
}
interface BossSnap {
  stage: string
}

const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseState = (page: Page) => page.evaluate(() => window.__lastRites!.caseState() as CaseSnap)
const solved = async (page: Page) => (await caseState(page)).cases[CASE_ID].minigames
const mystery = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('mystery') as MysterySnap)
const ending = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('ending') as EndingSnap)
const boss = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('boss') as BossSnap)
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

/** Starts a run at the start of stage 3's day (with the ledger, as a player who got here holds it). */
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
  await page.evaluate(() => window.__lastRites!.skipToStage(3))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).stage === 3)
  // Elias's boots need the parish ledger to compare against (the same rule as every clue spot).
  await page.evaluate(() => window.__lastRites!.give('parish-ledger'))
  return { errors }
}

async function intoNight(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToDusk(3))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'dusk')
  await page.evaluate(() => window.__lastRites!.skipToNight(3))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as WorldSnap).phase === 'night')
  await page.waitForFunction(() => (window.__lastRites!.snapshot('enemies') as unknown[]).length > 0, undefined, {
    timeout: 60_000,
  })
  await page.evaluate(() => window.__lastRites!.killAll())
}

/**
 * Walks to a prop (teleport is positioning only), looks at it, waits for the crosshair to hover it
 * and uses it with a real E key press, until `done` is true. Tries several stand points.
 */
async function usePropUntil(page: Page, id: string, done: () => Promise<boolean>): Promise<void> {
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
      continue
    }
    // Held for 600 ms: a short tap can fall between two slow software-rendered frames.
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(600)
    await page.keyboard.up('KeyE')
    await frames(page, 20)
  }
  expect(hovered, `crosshair reaches ${id}`).toBe(true)
  expect(await done(), `E at ${id} did its work`).toBe(true)
}

/** Opens a Minigame overlay with a real E at its prop. */
async function openMinigame(page: Page, id: string): Promise<void> {
  const shell = page.locator('.minigame-shell')
  await usePropUntil(page, id, async () => (await shell.count()) > 0)
  await expect(shell).toBeVisible()
  // The overlay frees the cursor: no real pointer lock may stay on the canvas under it.
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true)
}

/** Examines the five evidence props and the boots with real E presses (the six cards of 3b). */
async function gatherEvidence(page: Page): Promise<void> {
  for (const card of EVIDENCE_PROPS) {
    await usePropUntil(page, `evidence-${card}`, async () =>
      (await caseState(page)).cases[CASE_ID].evidenceFound.includes(card),
    )
  }
  await usePropUntil(page, 'clue-clue-hut-boots', async () => (await mystery(page)).mystery.clues.includes('clue-hut-boots'))
  // Examining may raise the clue card; clear anything that holds the cursor.
  await page.evaluate(() => window.__lastRites!.releaseAll())
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
const tiles = (page: Page) => page.locator('.hymn__tile')
const cardOrder = (page: Page) =>
  page.locator('.timeline__card').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.card ?? ''))

/** Sorts the timeline cards into the right order with the Earlier buttons. Returns nothing. */
async function sortByMouse(page: Page): Promise<void> {
  for (let i = 0; i < TIMELINE_ORDER.length; i++) {
    const now = await cardOrder(page)
    const from = now.indexOf(TIMELINE_ORDER[i])
    if (from === i) continue
    await page.locator(`.timeline__card[data-card="${TIMELINE_ORDER[i]}"]`).click()
    for (let k = from; k > i; k--) await page.getByRole('button', { name: 'Earlier' }).click()
  }
  expect(await cardOrder(page)).toEqual(TIMELINE_ORDER)
}

test('mouse: hymn board and timeline wrong then right, the rite and the accusation at night', async ({ page }) => {
  test.setTimeout(600_000)
  const { errors } = await boot(page)
  expect((await stage(page)).stage).toBe(3)

  // 3a: the hymn board on the chapel wall. Nothing set: say so. Then a wrong row, then BELOW.
  await openMinigame(page, 'hymn-board')
  await expect(page.getByRole('dialog', { name: 'The Hymn Board' })).toBeVisible()
  await page.getByRole('button', { name: /Blow the whistle/ }).click()
  await expect(result(page)).toContainText('Set all five tiles first')
  const on = page.getByRole('button', { name: 'Letter on' })
  for (let i = 0; i < 5; i++) {
    await tiles(page).nth(i).click()
    await on.click() // empty -> A
  }
  await page.getByRole('button', { name: /Blow the whistle/ }).click()
  await expect(result(page)).toContainText('The tiles do not sit true')
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(1)
  expect(await solved(page)).not.toContain('3a')
  // A -> B, E, L, O, W: 1, 4, 11, 14, 22 more steps.
  for (const [i, steps] of [1, 4, 11, 14, 22].entries()) {
    await tiles(page).nth(i).click()
    for (let k = 0; k < steps; k++) await on.click()
  }
  await expect(page.locator('.hymn__tiles')).toHaveAttribute('aria-label', /Tile 5 of 5, W/)
  // Every psalter title must be readable, hymn 41 included (a clipped column list once hid 24 to 60).
  const h41 = page.locator('.hymn__index li[value="41"]')
  await h41.scrollIntoViewIfNeeded()
  await expect(h41).toBeVisible()
  expect((await h41.boundingBox())!.x).toBeLessThan(page.viewportSize()!.width)
  await page.locator('.hymn__tiles').scrollIntoViewIfNeeded()
  await shoot(page, 'case3-hymn')
  await page.getByRole('button', { name: /Blow the whistle/ }).click()
  await expect.poll(async () => solved(page)).toContain('3a')
  await expect(page.locator('.hymn__solved')).toBeVisible()
  // By day with the whistle held, the right tiles open the stair behind the altar.
  expect((await mystery(page)).mystery.gates.catacombs).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // 3b: six pieces of evidence by real E presses, then the slate.
  await gatherEvidence(page)
  expect((await caseState(page)).cases[CASE_ID].evidenceFound.length).toBe(5)
  await openMinigame(page, 'timeline-slate')
  await expect(page.getByRole('dialog', { name: "Elias's Last Night" })).toBeVisible()
  await expect(page.locator('.timeline__card')).toHaveCount(6)
  await page.getByRole('button', { name: /Judge the night/ }).click()
  await expect(result(page)).toContainText('out of place')
  await expect(page.locator('.timeline__flag')).toBeVisible()
  expect((await caseState(page)).cases[CASE_ID].wrongAnswers).toBe(2)
  // One real drag with the mouse: the last card to the front, then the buttons do the rest.
  const last = page.locator('.timeline__card').nth(5)
  await last.dragTo(page.locator('.timeline__slot').nth(0))
  await sortByMouse(page)
  await shoot(page, 'case3-timeline')
  await page.getByRole('button', { name: /Judge the night/ }).click()
  await expect.poll(async () => solved(page)).toContain('3b')
  await expect(page.locator('.timeline__replay')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)
  // The crypt stands open with Elias in it.
  await expect.poll(() => page.evaluate(() => window.__lastRites!.meshesUnder('case-props'))).toBeGreaterThan(0)

  // Night: the rite. A wrong relic first (30 s lock and an instant wave), then the right order.
  await page.evaluate(() => window.__lastRites!.giveAllRelics())
  await intoNight(page)
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Rite of Rest' })
  await expect(panel).toBeVisible()
  const slot = (n: number) => panel.locator('.rite-panel__slot').nth(n)
  const pick = async (n: number, name: string) => {
    await slot(n).locator('select').selectOption({ label: name })
    await slot(n).getByRole('button', { name: 'Lay it here' }).click()
  }
  await pick(0, 'Burial Shroud')
  await expect(panel.locator('.altar-panel__status')).toContainText('The altar is silent: 0:')
  expect((await stage(page)).altar.wrong).toBe(1)
  await expect.poll(() => enemyCount(page), { timeout: 20_000 }).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.__lastRites!.riteState())).toMatchObject({ placed: {} })
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).not.toContainText('silent', { timeout: 60_000 })

  // The Accusation: a wrong one is gentle (no wave, no lock), the right one is only recorded.
  const acc = (label: string, option: string) =>
    panel.getByLabel(new RegExp(`Accusation, ${label},`)).selectOption({ label: option })
  await acc('Who', 'Father Crane')
  await acc('Motive', 'a licence')
  await acc('Means', 'a spade')
  await acc('Opportunity', 'the flowers')
  await panel.getByRole('button', { name: 'Accuse' }).click()
  await expect(panel.locator('.altar-panel__result').last()).toContainText('rings false')
  expect((await stage(page)).altar.wrong).toBe(1)
  expect((await stage(page)).caseSolved).toBe(false)
  await acc('Who', 'Silas Vane')
  await acc('Motive', 'the handwriting')
  await acc('Means', 'the hearse-pin')
  await acc('Opportunity', 'the cart ruts')

  // The rite in order. The first relic starts Crane's 10 s clock.
  const order = ["Crane's Rosary", "Sexton's Bell Clapper", "Child's Locket", 'Burial Shroud', 'Reliquary Heart']
  await pick(0, order[0])
  await expect(slot(0)).toContainText('First the prayer')
  await expect.poll(async () => (await boss(page)).stage, { timeout: 45_000 }).toBe('risen')
  for (let i = 1; i < order.length; i++) await pick(i, order[i])
  await expect(panel.locator('.altar-panel__status')).not.toContainText('sour note')
  expect((await stage(page)).caseSolved).toBe(false) // Crane lives: the placed relics wait for him
  await shoot(page, 'case3-rite')
  await panel.getByRole('button', { name: 'Accuse' }).click()
  await expect(panel.locator('.altar-panel__result').last()).toContainText('altar holds the name')
  await panel.locator('.altar-panel__accusation').scrollIntoViewIfNeeded()
  await shoot(page, 'case3-accusation')

  // Crane falls, the rite finishes, and the right accusation adds the epilogue before the walk-out.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.__lastRites!.killAll())
        return (await ending(page)).ending
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe('rest')
  await expect.poll(async () => (await ending(page)).ending).toBe('rest')
  await expect.poll(async () => (await ending(page)).stage).toBe('epilogue')
  await expect(page.getByLabel('Justice for Elias')).toBeVisible()
  await shoot(page, 'case3-epilogue')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await ending(page)).stage).toBe('sequence')

  expect(errors).toEqual([])
})

test('keyboard only: hymn tiles, timeline cards, relic places and the accusation', async ({ page }) => {
  test.setTimeout(600_000)
  const { errors } = await boot(page)
  const key = async (code: string, times = 1) => {
    for (let i = 0; i < times; i++) await page.keyboard.press(code, { delay: 20 })
  }

  // 3a: letter keys set tiles and move on; Enter judges.
  await openMinigame(page, 'psalter')
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await expect(page.locator('.hymn__tiles')).toBeFocused()
  for (const k of ['KeyA', 'KeyA', 'KeyA', 'KeyA', 'KeyA']) await key(k)
  await key('Enter')
  await expect(result(page)).toContainText('The tiles do not sit true')
  await key('ArrowLeft', 4)
  for (const k of ['KeyB', 'KeyE', 'KeyL', 'KeyO', 'KeyW']) await key(k)
  await key('Enter')
  await expect.poll(async () => solved(page)).toContain('3a')
  await key('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // 3b: the evidence by E (cursor free-look again), then Space and arrows lift and move cards.
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await gatherEvidence(page)
  await openMinigame(page, 'timeline-slate')
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await expect(page.locator('.timeline__track')).toBeFocused()
  await key('Enter')
  await expect(result(page)).toContainText('out of place')
  // Selection sort: for each place, walk the cursor to the card, lift it, carry it left, put it down.
  let cursor = 0
  for (let i = 0; i < TIMELINE_ORDER.length; i++) {
    const from = (await cardOrder(page)).indexOf(TIMELINE_ORDER[i])
    if (from === i) {
      cursor = i
      continue
    }
    await key(from > cursor ? 'ArrowRight' : 'ArrowLeft', Math.abs(from - cursor))
    await key('Space')
    await key('ArrowLeft', from - i)
    await key('Space')
    cursor = i
  }
  expect(await cardOrder(page)).toEqual(TIMELINE_ORDER)
  await key('Enter')
  await expect.poll(async () => solved(page)).toContain('3b')
  await key('Escape')
  await expect(page.locator('.minigame-shell')).toHaveCount(0)

  // Night: relics by select type-ahead, Tab and Enter; focus must come back after each placement.
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await page.evaluate(() => window.__lastRites!.giveAllRelics())
  await intoNight(page)
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  await page.evaluate(() => window.__lastRites!.lockless(false))
  const panel = page.getByRole('dialog', { name: 'The Rite of Rest' })
  await expect(panel).toBeVisible()
  const placedNames = ['Crane', 'Sexton', 'Child', 'Burial', 'Reliquary']
  for (const name of placedNames) {
    await expect(panel.locator('select').first()).toBeFocused()
    await page.keyboard.type(name)
    await key('Tab')
    await key('Enter')
    await expect(panel.locator('.rite-panel__done')).toHaveCount(placedNames.indexOf(name) + 1, { timeout: 10_000 })
  }
  await expect.poll(async () => (await page.evaluate(() => window.__lastRites!.riteState())) as { placed: object }).toMatchObject({})
  expect(Object.keys(((await page.evaluate(() => window.__lastRites!.riteState())) as { placed: object }).placed)).toHaveLength(5)
  expect((await stage(page)).altar.wrong).toBe(0)

  // The accusation: the four selects are now the first controls; type-ahead, Tab, Enter on Accuse.
  await expect(panel.getByLabel(/Accusation, Who,/)).toBeFocused()
  for (const [i, text] of ['Silas', 'the h', 'the hea', 'the c'].entries()) {
    await page.keyboard.type(text)
    await key('Tab')
    if (i === 3) await expect(panel.getByRole('button', { name: 'Accuse' })).toBeFocused()
  }
  await key('Enter')
  await expect(panel.locator('.altar-panel__result').last()).toContainText('altar holds the name')

  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.__lastRites!.killAll())
        return (await ending(page)).ending
      },
      { timeout: 60_000, intervals: [500] },
    )
    .toBe('rest')
  await expect.poll(async () => (await ending(page)).stage).toBe('epilogue')
  await key('Enter')
  await expect.poll(async () => (await ending(page)).stage).toBe('sequence')

  expect(errors).toEqual([])
})
