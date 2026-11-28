import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import {
  aimAt,
  beacon,
  boot,
  cinematic,
  clickOn,
  dolly,
  frames,
  place,
  pressE,
  quietNight,
  recordShot,
  revealMap,
  showCursor,
  spectator,
  veilAnswers,
  type V3,
} from './director'

// The demo video's shots (tools/video/trailer.mjs cuts them), filmed in the order the game plays:
// Stage 1, 2, then 3. Headless Chrome on the GPU; each shot's frames go to tools/video/clips/<name>/
// with the keeper's lines and when they came up. The debug hook only sets the scene (stage, clock,
// camera); every screen is opened with E and played with real clicks and keys, as a player does.
//   npx playwright test -c tools/video/playwright.video.config.ts     (from the repo root)
//   $env:VIDEO_ONLY='s2-,s3-goal'; ...                                 only the shots whose name has one of these
const CLIPS = join(process.cwd(), 'tools', 'video', 'clips')
const ONLY = (process.env.VIDEO_ONLY ?? '').split(',').filter(Boolean)

type Hook = NonNullable<Window['__lastRites']>
const hook = <T,>(page: Page, fn: (h: Hook) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__lastRites)`) as Promise<T>
const wait = (page: Page, s: number) => page.waitForTimeout(s * 1000)
const panel = (page: Page, name: string) => page.getByRole('dialog', { name })

/** Films `name` unless VIDEO_ONLY leaves it out; the setup that leads to it always runs. */
async function shot(page: Page, name: string, run: () => Promise<void>): Promise<void> {
  if (ONLY.length && !ONLY.some((o) => name.includes(o))) return run()
  await recordShot(page, CLIPS, name, run)
}

/** A spectator flight over the surroundings (no hands in shot), with the HUD hidden. */
async function fly(page: Page, name: string, from: V3, to: V3, at: V3, seconds: number): Promise<void> {
  await cinematic(page, true)
  await beacon(page, false)
  await frames(page, 30)
  await shot(page, name, () => spectator(page, from, to, at, seconds))
}

async function useProp(page: Page, name: string, id: string, prefer: V3 | undefined, then: () => Promise<void>): Promise<void> {
  // A prop can mount a moment after its stage or night begins.
  await page.waitForFunction((i) => window.__lastRites!.interactableCentre(i) !== null, id, { timeout: 30_000 })
  await cinematic(page, 'hud')
  await beacon(page, true)
  await aimAt(page, id, prefer)
  await frames(page, 30)
  await shot(page, name, async () => {
    await wait(page, 0.9)
    await pressE(page)
    await freeMouse(page)
    await then()
  })
}

/**
 * Over a 2D screen the real game lets the pointer go, so a click is a click. The faked pointer
 * lock would turn the clicks on the screen into swings at the air behind it, so it is let go too.
 */
async function freeMouse(page: Page): Promise<void> {
  const open = await page
    .waitForFunction(() => document.querySelector('[role="dialog"], .minigame-shell, .rubbing') !== null, undefined, { timeout: 1200 })
    .then(() => true, () => false)
  if (open) await hook(page, (h) => h.lockless(false))
}

/** Waits for a screen opened with E; a press that a passing zombie or a frame hitch swallowed is tried once more. */
async function opened(page: Page, dlg: ReturnType<typeof panel>, id: string): Promise<void> {
  const shows = (ms: number) => dlg.waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false)
  if (!(await shows(2500))) {
    // Placed at an angle the crosshair missed: aim again and press once more.
    await hook(page, (h) => h.lockless(true))
    await aimAt(page, id)
    await pressE(page)
    // The altar alone, as a last resort, is opened as the e2e suite does.
    if (!(await shows(2500)) && id === 'case-altar') await hook(page, (h) => h.setAltarPanel(true))
    await freeMouse(page)
  }
  await expect(dlg).toBeVisible()
}

/** Clears the journal notes queued on screen (the stage skips leave the earlier stages' ones). */
async function clearNotes(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const path = '/src/game/state/clueRevealStore.ts'
    const { useClueRevealStore } = await import(/* @vite-ignore */ path)
    useClueRevealStore.getState().reset()
  })
}

/** Escape out of a 2D screen and give the game the (faked) pointer lock back. */
async function putAway(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await frames(page, 20)
  await hook(page, (h) => h.lockless(true))
}

test('demo', async ({ page }) => {
  test.setTimeout(30 * 60_000)
  await boot(page)
  await showCursor(page)

  // ── Cold open ─────────────────────────────────────────────────────────────────────────────
  // Spectator flights: the keeper waits out of shot by the hut while the camera tours the grounds.
  await place(page, [9, 0, 16], [0, 1.6, 0])
  await fly(page, 'open-gate', [2, 9, 46], [0, 5.5, 34], [-2, 1.5, 0], 7)
  await fly(page, 'open-graves', [-1, 6, -5], [-9, 4.2, -5.5], [-14, 0.6, -17], 7)
  await fly(page, 'open-hut', [3.8, 4.2, 12.5], [2.6, 2.5, 7.8], [-0.9, 1.2, -1.9], 6)

  // ── Stage 1: Saved by the Bell ────────────────────────────────────────────────────────────
  await useProp(page, 's1-page', 'fixed:fx-page-1', [2.6, 0, -0.1], async () => {
    await wait(page, 6)
  })
  await putAway(page)

  await useProp(page, 's1-stone', 'tombstone-pell', [-8.4, 0, -21.1], async () => {
    await expect(page.locator('.rubbing')).toBeVisible()
    await wait(page, 7)
  })
  await putAway(page)
  await hook(page, (h) => {
    h.readStone('ames')
    h.readStone('hale')
  })
  await wait(page, 1)

  await useProp(page, 's1-ledger', 'ledger-shelf', [-1.45, 0, 0.1], async () => {
    const dlg = panel(page, 'The parish ledger')
    await opened(page, dlg, 'ledger-shelf')
    await wait(page, 1.2)
    for (const [grave, kind] of [['pell', 'The date differs'], ['ames', 'The cause differs'], ['hale', 'The plot differs']]) {
      const row = page.locator(`.ledger2__row[data-grave="${grave}"]`)
      await clickOn(page, row.getByRole('button', { name: kind }), 420)
      await wait(page, 0.9)
    }
    await expect(page.locator('.ledger2__solved')).toBeVisible()
    await wait(page, 6)
  })
  await putAway(page)

  // Hale's and Ames's cords ring off camera; Pell's is the one on camera.
  await hook(page, (h) => {
    h.pullBell('bell-hale')
    h.pullBell('bell-ames')
  })
  await wait(page, 1)
  await useProp(page, 's1-bell', 'bell-pell', [-6.6, 0, -21.2], async () => {
    await wait(page, 8)
  })

  await cinematic(page, 'hud')
  await shot(page, 's1-journal', async () => {
    await wait(page, 0.5)
    await page.keyboard.press('KeyJ')
    await hook(page, (h) => h.lockless(false))
    await wait(page, 0.8)
    const tab = page.getByRole('tab', { name: 'Case board' })
    if ((await tab.getAttribute('aria-selected')) !== 'true') await clickOn(page, tab)
    await wait(page, 1.2)
    await clickOn(page, page.locator('.case1__answer').filter({ hasText: /John Pell/ }), 500)
    await expect(page.locator('.case1__jv')).toBeVisible()
    await wait(page, 6)
  })
  await putAway(page)

  // Night 1: the dead rise, and the name is typed at the altar.
  await hook(page, (h) => h.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
  await quietNight(page, true)
  await frames(page, 240)
  await cinematic(page, true)
  await beacon(page, false)
  await quietNight(page, false)
  await page.evaluate(() =>
    window.__lastRites!.spawnZombies([[-9, -12], [-11, -13.5], [-6.5, -13], [-12.5, -11], [-8, -15.5]].map(([x, z]) => ({ x, z, type: 'shambler' as const }))),
  )
  // A spectator view: low among the graves, side-on, as they come for the keeper's lantern.
  await place(page, [-7, 0, -6.5], [-9.5, 1, -13])
  await frames(page, 20)
  await shot(page, 's1-dead', () => spectator(page, [-3.6, 1.15, -10.6], [-4.4, 0.95, -9.2], [-9.6, 1.0, -12.6], 7))
  // The fight: two of them close in front, so every swing lands on one.
  await quietNight(page, true)
  await frames(page, 10)
  await quietNight(page, false)
  await place(page, [-8, 0, -6], [-8, 1.2, -8])
  // Held where they stand, so neither grabs the keeper (a grab pulls the view to the ground).
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.holdZombies(h.spawnZombies([[-8, -7.5], [-8.9, -8.6]].map(([x, z]) => ({ x, z, type: 'shambler' as const }))), 30)
  })
  await frames(page, 20)
  await place(page, [-8, 0, -6], [-8.15, 1.25, -7.5])
  await cinematic(page, 'hud')
  await shot(page, 's1-fight', async () => {
    for (let i = 0; i < 3; i++) {
      await wait(page, i === 0 ? 0.4 : 0.95)
      await page.mouse.down()
      await page.mouse.up()
    }
    await wait(page, 1)
  })
  await quietNight(page, true)
  // The scare: a dark yard, the whisper, then the face. Filmed on night 1 (screen scares wait
  // while Father Crane is up); the cut plays it last.
  await cinematic(page, 'scare')
  await beacon(page, false)
  await quietNight(page, true)
  await place(page, [-6, 0, -12], [-6, 1.2, -20])
  await frames(page, 30)
  await shot(page, 'end-scare', async () => {
    const move = dolly(page, [-6, 0, -12], [-6, 0, -11.6], [-6, 1.2, -20], 3)
    await wait(page, 0.7)
    const outcome = await page.evaluate(() => window.__lastRites!.requestScreenScare('bride'))
    if (outcome !== 'started') throw new Error(`The screen scare did not start: ${outcome}`)
    await move
  })
  await quietNight(page, true)

  await useProp(page, 's1-altar', 'case-altar', [10, 0, 8.4], async () => {
    const dlg = panel(page, 'The Altar')
    await opened(page, dlg, 'case-altar')
    await veilAnswers(page, true)
    await hook(page, (h) => h.lockless(false))
    await wait(page, 1)
    await clickOn(page, dlg.locator('.altar-panel__input'))
    await page.keyboard.type('Josiah Vane', { delay: 70 })
    await wait(page, 0.5)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => (window.__lastRites!.stageState() as { caseSolved: boolean }).caseSolved)
    await wait(page, 2.5)
    await clickOn(page, dlg.getByRole('button', { name: 'Show it all' }))
    await wait(page, 5)
  })
  await putAway(page)

  // ── Stage 2: The Resurrection Men ─────────────────────────────────────────────────────────
  await quietNight(page, false)
  await hook(page, (h) => h.skipToStage(2))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as { stage: number }).stage === 2)
  await frames(page, 120)
  await useProp(page, 's2-gate', 'gate-mausoleum-row', [-20, 0, -37.6], async () => {
    await wait(page, 5)
  })
  await hook(page, (h) => {
    h.inspectGrave('cobb')
    h.inspectGrave('reade')
    h.inspectGrave('finch')
  })
  await wait(page, 1)

  await useProp(page, 's2-register', 'burial-register', undefined, async () => {
    await opened(page, panel(page, 'The burial register'), 'burial-register')
    await wait(page, 1.2)
    for (const [grave, mark] of [['cobb', 'The grave agrees'], ['reade', 'The grave agrees'], ['finch', 'It doesn’t match']]) {
      await clickOn(page, page.locator(`.register__row[data-grave="${grave}"]`).getByRole('button', { name: mark }), 420)
      await wait(page, 0.8)
    }
    await wait(page, 5)
  })
  await putAway(page)

  // The watch log (2b) and the print are played off camera.
  await aimAt(page, 'watch-logbook').catch(() => undefined)
  if ((await page.evaluate(() => window.__lastRites!.interactableCentre('watch-logbook'))) !== null) {
    await pressE(page)
    await clickOn(page, page.locator('.watch__sign--empty').first())
    await putAway(page)
  }
  await hook(page, (h) => h.takePrint())
  await wait(page, 1)

  await useProp(page, 's2-boots', 'lodge-boots', undefined, async () => {
    await wait(page, 1.2)
    await clickOn(page, page.getByRole('button', { name: "Dale's porter's shoes" }), 420)
    await wait(page, 1.6)
    await clickOn(page, page.getByRole('button', { name: "Kerr's work boots" }), 420)
    await wait(page, 6)
  })
  await putAway(page)

  await useProp(page, 's2-crest', 'crest-lock', undefined, async () => {
    await wait(page, 1.2)
    for (let k = 0; k < 2; k++) {
      await clickOn(page, page.getByRole('button', { name: 'Turn on' }), 380)
      await wait(page, 0.8)
    }
    await clickOn(page, page.getByRole('button', { name: 'Turn the key' }), 380)
    await expect(page.locator('.crestlock__receipt')).toBeVisible()
    await wait(page, 6)
  })
  await putAway(page)

  // ── Stage 3: The Sealed Catacombs ─────────────────────────────────────────────────────────
  // In the game's order: Elias first (the crypt at the end of Mausoleum Row), then the hymn board,
  // the stair and the catacombs under the chapel, the hands, and the rite at night.
  await hook(page, (h) => h.skipToStage(3))
  await page.waitForFunction(() => (window.__lastRites!.stageState() as { stage: number }).stage === 3)
  await hook(page, (h) => h.giveClue('hearse-cart-ruts'))
  await hook(page, (h) => h.setLantern(true, 100))
  await frames(page, 120)
  // The objective, Find Elias Thorne, as the keeper walks up the Row to the crypt door.
  const pin = (await page.evaluate(() => window.__lastRites!.interactableCentre('crypt-pin'))) as V3
  const door: V3 = [pin[0], 1.3, pin[2]]
  await cinematic(page, 'hud')
  await beacon(page, true)
  // Stage 2's last journal note would still be up from the skip; the walk starts clean.
  await clearNotes(page)
  await place(page, [pin[0] - 0.1, 0, pin[2] + 8.5], door)
  await frames(page, 30)
  await shot(page, 's3-goal', () => dolly(page, [pin[0] - 0.1, 0, pin[2] + 8.5], [pin[0] - 0.05, 0, pin[2] + 3.2], door, 5))
  // The pin comes out off camera; Elias falls out of the door.
  await aimAt(page, 'crypt-pin')
  await pressE(page)
  await wait(page, 6)
  // Then a spectator view, slowly up to him. No words.
  const elias = (await page.evaluate(() => window.__lastRites!.interactableCentre('elias'))) as V3
  const body: V3 = [elias[0], 0.35, elias[2]]
  await place(page, [elias[0] + 0.5, 0, elias[2] + 1.4], body)
  await cinematic(page, true)
  await beacon(page, false)
  await frames(page, 30)
  await shot(page, 's3-approach', () =>
    spectator(page, [elias[0] + 0.9, 1.9, elias[2] + 6.5], [elias[0] + 0.35, 1.05, elias[2] + 1.5], body, 6),
  )
  await clearNotes(page)
  await useProp(page, 's3-elias', 'elias', undefined, async () => {
    await wait(page, 8)
  })

  await hook(page, (h) => h.give('bone-whistle'))
  await useProp(page, 's3-hymns', 'hymn-board', [11.2, 0, 8.7], async () => {
    await wait(page, 1)
    const tiles = page.locator('.hymn__tile')
    const on = page.getByRole('button', { name: 'Letter on' })
    for (const [i, steps] of [2, 5, 12, 15, 23].entries()) {
      await clickOn(page, tiles.nth(i), 200)
      for (let k = 0; k < steps; k++) await clickOn(page, on, 30)
    }
    await wait(page, 1)
    await clickOn(page, page.getByRole('button', { name: /Blow the whistle/ }), 400)
    await wait(page, 3.5)
  })
  await putAway(page)
  // The stair opens behind the altar.
  await cinematic(page, true)
  await beacon(page, false)
  await place(page, [11.6, 0, 7.2], [10, 0.2, 10.2])
  await shot(page, 's3-stair', () => dolly(page, [11.6, 0, 7.2], [11.3, 0, 8.0], [10, 0.1, 10.3], 4))
  // Down the stair into the catacombs, and on along the bone walls (walked with the real keys).
  await cinematic(page, 'hud')
  await beacon(page, false)
  await page.evaluate(() => window.__lastRites!.teleport(9.9, 10.1, { yaw: Math.PI, pitch: -0.2 }))
  await frames(page, 30)
  await shot(page, 's3-descend', async () => {
    await wait(page, 0.3)
    await hook(page, (h) => h.hold('MoveForward'))
    await page.waitForFunction(() => window.__lastRites!.body()!.feet[2] > 30, undefined, { timeout: 20_000 })
    // Still dark from the descent: look up the corridor rather than at the floor.
    const f = (await page.evaluate(() => window.__lastRites!.body()!.feet)) as V3
    await page.evaluate(([x, z]) => window.__lastRites!.teleport(x, z, { yaw: Math.PI, pitch: -0.04 }), [f[0], f[2]] as const)
    await wait(page, 5.5)
    await hook(page, (h) => h.release('MoveForward'))
    await wait(page, 0.5)
  })

  await cinematic(page, 'hud')
  await shot(page, 's3-hands', async () => {
    await wait(page, 0.5)
    await page.keyboard.press('KeyJ')
    await hook(page, (h) => h.lockless(false))
    await wait(page, 0.8)
    const tab = page.getByRole('tab', { name: 'Case board' })
    if ((await tab.getAttribute('aria-selected')) !== 'true') await clickOn(page, tab)
    await wait(page, 1)
    for (const id of ['ledger', 'receipt', 'note', 'signature']) {
      await clickOn(page, page.locator(`.hand__sample[data-sample="${id}"]`), 380)
      await wait(page, 1.1)
    }
    await wait(page, 7)
  })
  await revealMap(page)
  await shot(page, 's3-map', async () => {
    await clickOn(page, page.getByRole('tab', { name: 'Map' }), 400)
    await wait(page, 6)
  })
  await putAway(page)

  // Night 3: the name (veiled), then the rite, relic by relic. The fifth ends the case.
  await hook(page, (h) => h.giveAllRelics())
  await hook(page, (h) => h.skipToNight(3))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
  await quietNight(page, true)
  await frames(page, 200)
  await useProp(page, 's3-rite', 'case-altar', [10, 0, 8.4], async () => {
    const dlg = panel(page, 'The Rite of Rest')
    await opened(page, dlg, 'case-altar')
    await veilAnswers(page, true)
    await hook(page, (h) => h.lockless(false))
    await wait(page, 0.8)
    await clickOn(page, dlg.locator('.altar-panel__input'))
    await page.keyboard.type('Silas Vane', { delay: 70 })
    await page.keyboard.press('Enter')
    await expect(dlg.locator('.altar-panel__summary')).toBeVisible()
    await wait(page, 2)
    const order = ["Crane's Rosary", "Sexton's Bell Clapper", "Child's Locket", 'Burial Shroud', 'Reliquary Heart']
    for (const [i, name] of order.entries()) {
      const slot = dlg.locator('.rite-panel__slot').nth(i)
      await slot.locator('select').selectOption({ label: name })
      await clickOn(page, slot.getByRole('button', { name: 'Lay it here' }), 300)
      if (i < order.length - 1) await expect(slot.locator('.rite-panel__done')).toBeVisible({ timeout: 10_000 })
      await wait(page, 0.5)
    }
    await wait(page, 2)
  })
})
