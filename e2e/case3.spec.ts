import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 4.8, playtest story pass: Stage 3 (The Sealed Catacombs) in real Chrome. The hymn
// board (3a) is set with the real mouse and keyboard, a wrong row first. Then the cart ruts at the
// Row gate, the hearse pin out of the Crane crypt door (3b) and Elias searched (3c), each by a real
// E press at the real prop, and the four hands compared in the journal (3d) by clicks or keys. At
// night the altar takes the name first ("Vane" is asked again, a wrong name costs nothing), then the
// rite (a wrong relic, then the right order); the fifth relic finishes it (Father Crane is out of
// play until he has a model) and the Justice for Elias epilogue plays. The dev hook only sets up (start, stage, positioning,
// clock, relics in the satchel, kill stragglers) and reads state; no Dev_Panel solve action touches
// an answer. Waits are polled state or rendered frame counts, never fixed sleeps (apart from the
// held E key).

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
const CASE_ID = 'sealed-catacombs'
const HAND_SAMPLES = ['ledger', 'receipt', 'note', 'signature']

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
  cases: Record<string, { minigames: string[]; wrongAnswers: number; found: string[] }>
}
interface MysterySnap {
  mystery: { gates: { catacombs: boolean }; clues: string[] }
}
interface EndingSnap {
  ending: string | null
  stage: string
}

const stage = (page: Page) => page.evaluate(() => window.__lastRites!.stageState() as StageSnap)
const caseState = (page: Page) => page.evaluate(() => window.__lastRites!.caseState() as CaseSnap)
const solved = async (page: Page) => (await caseState(page)).cases[CASE_ID].minigames
const mystery = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('mystery') as MysterySnap)
const ending = (page: Page) => page.evaluate(() => window.__lastRites!.snapshot('ending') as EndingSnap)
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

/** Starts a run at the start of stage 3's day. */
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

/** The ruts at the Row gate, the pin out of the Crane crypt door and Elias searched, by real E presses. */
async function walkToElias(page: Page): Promise<void> {
  await usePropUntil(page, 'case-clue-hearse-cart-ruts', async () =>
    (await caseState(page)).cases[CASE_ID].found.includes('hearse-cart-ruts'),
  )
  await page.evaluate(() => window.__lastRites!.releaseAll())
  await usePropUntil(page, 'crypt-pin', async () => (await solved(page)).includes('3b'))
  await expect.poll(() => heard(page)).toContain('Vane raven')
  await usePropUntil(page, 'elias', async () => (await solved(page)).includes('3c'))
  await page.evaluate(() => window.__lastRites!.releaseAll())
}

const heard = (page: Page) => page.evaluate(() => window.__lastRites!.narration().heard.join(' '))

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
const sample = (page: Page, id: string) => page.locator(`.hand__sample[data-sample="${id}"]`)
const RITE = ["Crane's Rosary", "Sexton's Bell Clapper", "Child's Locket", 'Burial Shroud', 'Reliquary Heart']

/** Kills what is left until the rite ends the run, then checks the epilogue plays before the walk-out. */
async function finishRun(page: Page, skipKey: string): Promise<void> {
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
  await expect(page.getByLabel('Justice for Elias')).toBeVisible()
  await page.keyboard.press(skipKey)
  await expect.poll(async () => (await ending(page)).stage).toBe('sequence')
}

test('mouse: hymn board wrong then right, the crypt, the handwriting, the name and the rite at night', async ({ page }) => {
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

  // The ruts, the pin (3b) and Elias (3c), with the cursor in free-look as in the keyboard run.
  // The open crypt shows the door's inner face and Elias.
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await walkToElias(page)
  await expect.poll(() => page.evaluate(() => window.__lastRites!.meshesUnder('case-props'))).toBeGreaterThan(0)
  await shoot(page, 'case3-crypt')

  // 3d: the four hands in the journal, clicked one by one; each circles its letters.
  await page.keyboard.press('KeyJ')
  await page.getByRole('tab', { name: 'Case board' }).click()
  await expect(sample(page, 'ledger')).toBeVisible()
  for (const id of HAND_SAMPLES.slice(0, 3)) await sample(page, id).click()
  await expect(sample(page, 'note')).toHaveAttribute('aria-pressed', 'true')
  await expect(sample(page, 'note').locator('.hand__glyph.is-circled')).not.toHaveCount(0)
  expect(await solved(page)).not.toContain('3d')
  await sample(page, 'signature').click()
  await expect.poll(async () => solved(page)).toContain('3d')
  await expect(sample(page, 'signature')).toContainText('No loop on the V')
  await expect(page.locator('.case1')).toContainText('Silas Vane')
  await sample(page, 'signature').scrollIntoViewIfNeeded()
  await shoot(page, 'case3-handwriting')
  await page.keyboard.press('Escape')

  // Night: the name first. No relic place shows until the altar holds it.
  await page.evaluate(() => window.__lastRites!.giveAllRelics())
  await intoNight(page)
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  const panel = page.getByRole('dialog', { name: 'The Rite of Rest' })
  await expect(panel).toBeVisible()
  await expect(panel.locator('.rite-panel__slot')).toHaveCount(0)
  const answer = async (text: string) => {
    await panel.locator('.altar-panel__input').fill(text)
    await panel.getByRole('button', { name: 'Answer' }).click()
  }
  // A bare "Vane" is asked again; a wrong name is gentle (no wave, no lock).
  await answer('Vane')
  await expect(panel.locator('.altar-panel__accusation .altar-panel__result')).toHaveText('Which Vane?')
  await answer('Josiah Vane')
  await expect(panel.locator('.altar-panel__accusation .altar-panel__result')).toContainText('✕')
  expect((await stage(page)).altar.wrong).toBe(0)
  expect((await stage(page)).altar.lockedUntil).toBe(0)
  await answer('Silas Vane')
  await expect(panel.locator('.altar-panel__summary')).toBeVisible()
  await expect(panel.locator('.altar-panel__accusation .altar-panel__result')).toContainText('Now lay the relics')
  await expect.poll(() => heard(page)).toContain('Elias, I found you')
  expect((await stage(page)).caseSolved).toBe(false)
  await panel.locator('.altar-panel__accusation').scrollIntoViewIfNeeded()
  await shoot(page, 'case3-accusation')

  // The rite. A wrong relic first (30 s lock and an instant wave), then the right order.
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

  // The rite in order. Father Crane is out of play (BOSS.inPlay), so the fifth relic ends the case.
  await pick(0, RITE[0])
  await expect(slot(0)).toContainText('First the prayer')
  for (let i = 1; i < RITE.length - 1; i++) await pick(i, RITE[i])
  await expect(slot(RITE.length - 2).locator('.rite-panel__done')).toBeVisible({ timeout: 10_000 })
  expect((await stage(page)).altar.wrong).toBe(1) // only the wrong first try
  expect((await stage(page)).caseSolved).toBe(false) // four of five: the rite waits for the last
  await shoot(page, 'case3-rite')
  await pick(RITE.length - 1, RITE[RITE.length - 1])

  // The rite finishes, and the name given adds the epilogue before the walk-out.
  await finishRun(page, 'Space')
  expect(errors).toEqual([])
})

test('keyboard only: hymn tiles, the crypt by E, the handwriting, the name and the relic places', async ({ page }) => {
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

  // The ruts, the pin and Elias by E (cursor free-look again).
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await walkToElias(page)

  // 3d: the journal by J, each sample reached by Tab and compared with Enter.
  await page.evaluate(() => window.__lastRites!.lockless(false))
  await key('KeyJ')
  await page.getByRole('tab', { name: 'Case board' }).focus()
  await key('Enter')
  for (const id of HAND_SAMPLES) {
    await sample(page, id).focus()
    await expect(sample(page, id)).toBeFocused()
    await key('Enter')
    await expect(sample(page, id)).toHaveAttribute('aria-pressed', 'true')
  }
  await expect.poll(async () => solved(page)).toContain('3d')
  await key('Escape')

  // Night: the name typed in the first control, Enter; focus moves to the first relic place.
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await page.evaluate(() => window.__lastRites!.giveAllRelics())
  await intoNight(page)
  await page.evaluate(() => window.__lastRites!.setAltarPanel(true))
  await page.evaluate(() => window.__lastRites!.lockless(false))
  const panel = page.getByRole('dialog', { name: 'The Rite of Rest' })
  await expect(panel).toBeVisible()
  await expect(panel.locator('.altar-panel__input')).toBeFocused()
  await page.keyboard.type('the son', { delay: 20 })
  await key('Enter')
  await expect(panel.locator('.altar-panel__summary')).toBeVisible()

  // Relics by select type-ahead, Tab and Enter; focus must come back after each placement.
  const placedNames = ['Crane', 'Sexton', 'Child', 'Burial', 'Reliquary']
  for (const name of placedNames.slice(0, -1)) {
    await expect(panel.locator('select').first()).toBeFocused()
    await page.keyboard.type(name)
    await key('Tab')
    await key('Enter')
    await expect(panel.locator('.rite-panel__done')).toHaveCount(placedNames.indexOf(name) + 1, { timeout: 10_000 })
  }
  expect(Object.keys(((await page.evaluate(() => window.__lastRites!.riteState())) as { placed: object }).placed)).toHaveLength(4)
  expect((await stage(page)).altar.wrong).toBe(0)
  // The fifth ends the case (Father Crane is out of play).
  await expect(panel.locator('select').first()).toBeFocused()
  await page.keyboard.type(placedNames[placedNames.length - 1])
  await key('Tab')
  await key('Enter')
  await expect.poll(async () => (await ending(page)).ending, { timeout: 30_000 }).toBe('rest')

  await finishRun(page, 'Enter')
  expect(errors).toEqual([])
})
