import { test, expect, type Page } from '@playwright/test'

// Spec 10 task 5.8: Stage 2 (The Resurrection Men) in real Chrome. Minigames 2a (The Crest Lock),
// 2b (The Watch Log) and 2c (Boot Prints) are opened with a real E press at the real props and
// solved with the real mouse and keyboard, a wrong answer first. The surgeon's receipt is found by
// walking to the lodge table; the whistle is taken from the opened niche. At night the altar is
// given a wrong answer, then the right one. The dev hook only sets up (start, stage, positioning,
// clock, kill stragglers) and reads state; no Dev_Panel solve action touches an answer.

const SHOTS = 'e2e/screenshots'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
] as const
const CASE_ID = 'resurrection-men'
const WATCH_ORDER = ['w-nine', 'w-ten', 'w-eleven', 'w-midnight', 'w-one', 'w-three', 'w-four', 'w-five']
/** Turning order on every dial: moon, tower, star, leaf. The founders: tower, leaf, star, moon. */
const DIAL_TURNS_UP_FROM_UNTURNED = [2, 4, 3, 1]

interface WorldSnap {
  phase: string
}
interface StageSnap {
  stage: number
  caseSolved: boolean
  altar: { lockedUntil: number; wrong: number }
}
interface CaseSnap {
  cases: Record<string, { found: string[]; minigames: string[]; wrongAnswers: number }>
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
const pageOrder = (page: Page) =>
  page.locator('[data-page]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.page ?? ''))

/** Takes the whistle from the opened niche: E shows its examine view, Esc puts it away into the satchel. */
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

test('mouse: watch log, crest lock and boot prints wrong then right, then both altar answers', async ({ page }) => {
  test.setTimeout(240_000)
  const { errors } = await boot(page)

  // The receipt is a walk clue on the lodge table.
  await usePropUntil(page, 'case-clue-surgeon-receipt', async () =>
    (await progress(page)).found.includes('surgeon-receipt'),
  )

  // 2b: judge the table order (wrong), then drag and use the Earlier button.
  await openMinigame(page, 'watch-logbook')
  await page.getByRole('button', { name: /Judge the log/ }).click()
  await expect(result(page)).toContainText('do not run in order')
  await expect(page.locator('[data-wrong="true"]')).toContainText('Out of place')
  expect((await progress(page)).wrongAnswers).toBe(1)
  expect((await caseState(page)).doubt.doubt).toBe(1)
  await shoot(page, 'case2-2b-wrong')
  await page.locator('[data-page="w-nine"]').dragTo(page.locator('.timeline__slot').first())
  expect((await pageOrder(page))[0]).toBe('w-nine')
  for (let i = 1; i < WATCH_ORDER.length; i++) {
    const from = (await pageOrder(page)).indexOf(WATCH_ORDER[i])
    if (from === i) continue
    await page.locator(`[data-page="${WATCH_ORDER[i]}"]`).click()
    for (let k = from; k > i; k--) await page.getByRole('button', { name: 'Earlier' }).click()
  }
  expect(await pageOrder(page)).toEqual(WATCH_ORDER)
  await page.getByRole('button', { name: /Judge the log/ }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2b')
  await expect(page.locator('.watchlog__verdict')).toContainText('the lodge keeper')
  expect((await progress(page)).found).toContain('watch-log-gap')
  await shoot(page, 'case2-2b')
  await closeMinigame(page)

  // A crypt name tablet reads out its family and year.
  await usePropUntil(page, 'crest-tablet-Marlowe', async () =>
    ((await page.locator('.clue-reveal').textContent()) ?? '').includes('1752'),
  )

  // 2a: all four dials to the moon (wrong), then the founders' order with the ▲ buttons.
  await openMinigame(page, 'crest-lock')
  for (let i = 1; i <= 4; i++) await page.getByRole('button', { name: `Turn dial ${i} up` }).click()
  await page.getByRole('button', { name: /Try the lock/ }).click()
  await expect(result(page)).toContainText('The lock does not give')
  expect((await progress(page)).wrongAnswers).toBe(2)
  await shoot(page, 'case2-2a-wrong')
  // Each dial is on the moon (1 turn); turn on to tower (+1), leaf (+3), star (+2), moon (+0).
  for (let i = 0; i < 4; i++) {
    for (let k = 1; k < DIAL_TURNS_UP_FROM_UNTURNED[i]; k++) {
      await page.getByRole('button', { name: `Turn dial ${i + 1} up` }).click()
    }
  }
  await page.getByRole('button', { name: /Try the lock/ }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2a')
  expect((await progress(page)).found).toContain('sexton-watch-ledger')
  await shoot(page, 'case2-2a')
  await closeMinigame(page)
  await takeWhistle(page)

  // 2c: the full print against the sexton's boots (wrong), then the lodge keeper's.
  await openMinigame(page, 'boot-cast-cast-full')
  await page.locator('[data-cast="cast-full"]').click()
  await page.locator('[data-boot="sexton"]').click()
  await page.getByRole('button', { name: /Pair them/ }).click()
  await expect(result(page)).toContainText('The tread does not agree')
  expect((await progress(page)).wrongAnswers).toBe(3)
  await shoot(page, 'case2-2c-wrong')
  await page.locator('[data-boot="lodge-keeper"]').click()
  await page.getByRole('button', { name: /Pair them/ }).click()
  await expect.poll(async () => (await progress(page)).minigames).toContain('2c')
  expect((await progress(page)).found).toContain('boot-print-match')
  await shoot(page, 'case2-2c')
  await closeMinigame(page)

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
  const slots = panel.locator('.altar-panel__slot')
  await expect(slots).toHaveCount(4)
  // Wrong: the gravedigger with the red herrings.
  await slots.nth(0).selectOption({ label: 'the gravedigger' })
  await slots.nth(1).selectOption({ label: 'the fresh clay on the spade' })
  await slots.nth(2).selectOption({ label: 'the matching boots' })
  await slots.nth(3).selectOption({ label: 'the legal grave he dug' })
  await panel.getByRole('button', { name: 'Answer' }).click()
  await expect(panel.locator('.altar-panel__status')).toContainText('The altar is silent: 0:')
  expect((await stage(page)).caseSolved).toBe(false)
  expect((await stage(page)).altar.wrong).toBe(1)

  // Wait the lock out, then the lodge keeper with motive, means and opportunity.
  await page.evaluate(() => window.__lastRites!.killAll())
  await expect(panel.locator('.altar-panel__status')).toContainText('Check each blank', { timeout: 60_000 })
  await slots.nth(0).selectOption({ label: 'the lodge keeper' })
  await slots.nth(1).selectOption({ label: "the surgeon's receipt in his hand" })
  await slots.nth(2).selectOption({ label: 'the matching boots' })
  await slots.nth(3).selectOption({ label: 'the gap on his watch' })
  await shoot(page, 'case2-board')
  await panel.getByRole('button', { name: 'Answer' }).click()
  await page.waitForFunction(() => (window.__lastRites!.stageState() as StageSnap).caseSolved)
  await expect.poll(async () => (await caseState(page)).closed).toContain(CASE_ID)
  // The whistle is carried on into stage 3.
  expect(await keyItems(page)).toContain('bone-whistle')

  expect(errors).toEqual([])
})

test('keyboard only: watch log, crest lock and boot prints', async ({ page }) => {
  test.setTimeout(180_000)
  const { errors } = await boot(page)

  // 2b: Left/Right choose, Space lifts, Left carries, Space sets down, Enter judges.
  await openMinigame(page, 'watch-logbook')
  await page.locator('.timeline__track').focus()
  let cursor = 0
  for (let i = 0; i < WATCH_ORDER.length; i++) {
    const j = (await pageOrder(page)).indexOf(WATCH_ORDER[i])
    if (j === i) continue
    for (let k = 0; k < Math.abs(j - cursor); k++) await page.keyboard.press(j > cursor ? 'ArrowRight' : 'ArrowLeft')
    await page.keyboard.press('Space')
    for (let k = 0; k < j - i; k++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Space')
    cursor = i
  }
  expect(await pageOrder(page)).toEqual(WATCH_ORDER)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await progress(page)).minigames).toContain('2b')
  await closeMinigame(page)

  // 2a: Up turns the chosen dial, Right moves on, Enter tries the lock; a wrong try first.
  await openMinigame(page, 'crest-lock')
  await page.locator('.crest__dials').focus()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
  }
  await page.keyboard.press('Enter')
  await expect(result(page)).toContainText('The lock does not give')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft')
  for (let i = 0; i < 4; i++) {
    for (let k = 1; k < DIAL_TURNS_UP_FROM_UNTURNED[i]; k++) await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
  }
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await progress(page)).minigames).toContain('2a')
  await closeMinigame(page)

  // 2c: Up/Down choose a cast, Left/Right choose boots, Enter pairs.
  await openMinigame(page, 'boot-cast-cast-heel')
  await page.locator('.boots__spread').focus()
  await page.keyboard.press('Enter')
  await expect(result(page)).toContainText('too worn')
  await page.keyboard.press('ArrowDown')
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await progress(page)).minigames).toContain('2c')
  expect((await progress(page)).wrongAnswers).toBe(2)
  await closeMinigame(page)

  expect(errors).toEqual([])
})
