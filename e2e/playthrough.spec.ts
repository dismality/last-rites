import { test, expect, type Page } from '@playwright/test'
import { FIXED_SPAWNS } from '../src/data/zones'
import { CHAPEL_ALTAR } from '../src/data/cemeteryLayout'

// Spec 09, A2: the main story path in real Chrome, from New Game to an ending screen.
//
// What is real: the intro is skipped with the Space key, every move is held WASD-forward through
// the input module (the same path as a key press), every pickup, gate and the altar whistle is a
// real Interact press on the hovered object, examine mode is closed by clicking its button, the
// final rite is Interact held at the altar, and the objective text is read from the DOM.
//
// What is not: the long routes between legs are teleports to a start point 4 to 12 m short of
// each target (listed in LEGS below); the last stretch of every leg is walked. Looking at the
// item (yaw and pitch) is set with a look-only teleport on the spot, because headless Chrome has
// no pointer lock to turn the mouse. The last night (stage 3 in the spec 10 design) is reached with
// the Dev_Panel's "Night 5" skip; its waves never clear, and the rite is offered once the five
// relics are held. God mode comes from the Dev_Panel too.
//
// D1 (spec 09 task 24.1) adds per step: the compass objective aims at the next item, the hover
// prompt reads "E: ...", and journal pages 1 and 2 reach the journal when picked up.

type Vec3 = readonly [number, number, number]

const objectiveMain = (page: Page) => page.locator('.hud-objective__main')
const panel = (page: Page) => page.getByRole('complementary', { name: 'Developer panel' })

const feet = (page: Page) => page.evaluate(() => window.__lastRites!.body()!.feet)

function spawn(id: string): Vec3 {
  const s = FIXED_SPAWNS.find((f) => f.id === id)
  if (!s) throw new Error(`no fixed spawn ${id}`)
  return s.position
}

async function expectObjective(page: Page, text: RegExp): Promise<void> {
  await expect(objectiveMain(page)).toHaveText(text, { timeout: 15_000 })
}
/**
 * D1: the objective text, plus the compass: the objective points at `target` (x, z) and the
 * compass draws its objective marker.
 */
async function expectStep(page: Page, text: RegExp, target: { x: number; z: number }): Promise<void> {
  await expectObjective(page, text)
  const o = (await page.evaluate(() => window.__lastRites!.snapshot('objective'))) as { position?: Vec3 } | null
  expect(o?.position, `objective position for ${text}`).toBeDefined()
  expect(Math.hypot(o!.position![0] - target.x, o!.position![2] - target.z), `objective aim for ${text}`).toBeLessThan(0.5)
  await expect(page.locator('.compass__marker--objective').first()).toBeAttached()
}
/** Journal pages read so far (the journal's own source). */
const pagesRead = (page: Page) =>
  page.evaluate(() => {
    const m = window.__lastRites!.snapshot('mystery') as { mystery: { pages: Set<number> } }
    return [...m.mystery.pages].sort()
  })

/** Keeps the day clock early, so dusk never arrives in the middle of a leg. */
async function keepDay(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.setClock({ phase: 'day', phaseTime: 30 }))
}

async function section(page: Page, title: string): Promise<void> {
  const details = panel(page).locator('details', { has: page.locator('summary', { hasText: title }) })
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await details.locator('summary').click()
  }
}

/** Opens the Dev_Panel with backquote, runs `fn`, and closes it again. */
async function withPanel(page: Page, fn: () => Promise<void>): Promise<void> {
  await page.keyboard.press('Backquote')
  await expect(panel(page)).toBeVisible()
  await fn()
  await page.keyboard.press('Backquote')
  await expect(panel(page)).toHaveCount(0)
}

async function teleportAndSettle(page: Page, x: number, z: number, yaw: number): Promise<void> {
  await page.evaluate(({ x, z, yaw }) => window.__lastRites!.teleport(x, z, { yaw }), { x, z, yaw })
  await page.waitForFunction(
    ({ x, z, yaw }) => {
      const b = window.__lastRites!.body()
      // The yaw check proves the queued teleport (position and look) was applied, not an old one.
      return b !== null && Math.hypot(b.feet[0] - x, b.feet[2] - z) < 0.3 && Math.abs(b.yaw - yaw) < 0.05
    },
    { x, z, yaw },
  )
}

/** Yaw that faces (tx, tz) from (x, z); forward is (-sin yaw, -cos yaw), see movement.ts. */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z))

/** Holds Move forward from the current spot (already facing the target) until `stop` m away. */
async function walkUntil(page: Page, target: { x: number; z: number }, stop: number): Promise<void> {
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  try {
    await page.waitForFunction(
      ({ target, stop }) => {
        const b = window.__lastRites!.body()
        return b !== null && Math.hypot(b.feet[0] - target.x, b.feet[2] - target.z) <= stop
      },
      { target, stop },
      { timeout: 25_000 },
    )
  } catch (e) {
    const b = await page.evaluate(() => window.__lastRites!.body())
    console.log(`walk stalled at feet ${b?.feet.map((v) => v.toFixed(2))} yaw ${b?.yaw.toFixed(2)}, target ${target.x},${target.z}`)
    throw e
  } finally {
    await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  }
}
/** Teleports to a start point facing the target, then walks the rest of the way. */
async function leg(
  page: Page,
  from: { x: number; z: number },
  target: { x: number; z: number },
  stop: number,
  day = true,
): Promise<void> {
  if (day) await keepDay(page)
  await teleportAndSettle(page, from.x, from.z, yawTo(from.x, from.z, target.x, target.z))
  await walkUntil(page, target, stop)
}

/** Turns on the spot, level, to face (tx, tz) before a walk. */
async function faceTowards(page: Page, tx: number, tz: number): Promise<void> {
  const f = await feet(page)
  await teleportAndSettle(page, f[0], f[2], yawTo(f[0], f[2], tx, tz))
}
/** Turns on the spot (a look-only teleport) to face a point in the world. */
async function lookAt(page: Page, p: Vec3): Promise<void> {
  const b = (await page.evaluate(() => window.__lastRites!.body()))!
  const dx = p[0] - b.camera[0]
  const dz = p[2] - b.camera[2]
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.atan2(p[1] - b.camera[1], Math.hypot(dx, dz))
  await page.evaluate(
    ({ x, y, z, yaw, pitch }) => window.__lastRites!.teleport(x, z, { y, yaw, pitch }),
    { x: b.feet[0], y: b.feet[1], z: b.feet[2], yaw, pitch },
  )
  // Two rendered frames, so the interaction raycast has run against the new aim (SwiftShader frames are slow).
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  await page.waitForTimeout(150)
}

/** Aims at the object (trying a few heights), waits for the hover, and presses the real Interact. */
async function interact(page: Page, hoverId: string, at: Vec3): Promise<void> {
  // Aim first at the middle of the object's real meshes (as a player centres the crosshair), then
  // at a few heights around the data position. Small items on a table were missed by the guesses.
  const centre = await page.evaluate((id) => window.__lastRites!.interactableCentre(id), hoverId)
  const aims: Vec3[] = [
    ...(centre ? [centre as Vec3] : []),
    ...[0.12, 0.0, 0.3, 0.5, 0.8, -0.1].map((dy): Vec3 => [at[0], at[1] + dy, at[2]]),
  ]
  let hovered = false
  const seen: (string | null)[] = []
  for (const aim of aims) {
    await lookAt(page, aim)
    hovered = await page
      .waitForFunction(
        (want) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === want,
        hoverId,
        { timeout: 3_000 },
      )
      .then(() => true)
      .catch(() => false)
    if (hovered) break
    seen.push(((await page.evaluate(() => window.__lastRites!.snapshot('hover'))) as { id: string } | null)?.id ?? null)
  }
  const f = await feet(page)
  expect(hovered, `hover ${hoverId} from feet ${f.map((v) => v.toFixed(2))}; hovered instead: ${JSON.stringify(seen)}`).toBe(true)
  // D1: the pickup prompt names the key and the thing it does, and the HUD shows it.
  const hover = (await page.evaluate(() => window.__lastRites!.snapshot('hover'))) as { prompt: string; actionable: boolean }
  expect(hover.actionable, `${hoverId} actionable`).toBe(true)
  expect(hover.prompt).toMatch(/^E: \S/)
  await page.evaluate(() => window.__lastRites!.action('Interact', 400))
  console.log(
    `interact ${hoverId}: hover now ${JSON.stringify(await page.evaluate(() => window.__lastRites!.snapshot('hover')))}, game ${JSON.stringify(await page.evaluate(() => window.__lastRites!.snapshot('game')))}`,
  )
}

/** Picks up a fixed spawn and puts the examined item away with the dialog's own button. */
async function pickUp(page: Page, spawnId: string): Promise<void> {
  await interact(page, `fixed:${spawnId}`, spawn(spawnId))
  const dialog = page.getByRole('dialog', { name: /^Examine / })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  // Keyboard, not a mouse click: in the hook's no-pointer-lock mode, Playwright's move to the button
  // reaches the look input and turned the next leg's start heading (seen once: 1.4 rad).
  await dialog.getByRole('button', { name: /Put away/ }).press('Enter')
  await expect(dialog).toHaveCount(0)
}

async function inventory(page: Page) {
  return (await page.evaluate(() => window.__lastRites!.snapshot('inventory'))) as {
    inventory: { keyItems: string[]; relics: string[] }
  }
}

// Spec 10 task 3.9: the old five-night path no longer exists (the key lies in Pell's grave after case 1,
// night waves never clear, the rite is replaced in task 4.5). Task 12.1 rewrites this test for the
// three stages, so it is parked until then.
test.fixme('main story path: page 1 to the Rest ending', async ({ page }) => {
  test.setTimeout(900_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // --- New Game, intro skipped with Space ---------------------------------------------------
  // Setup, not game: on this Windows machine Chrome forwards the desk mouse's raw motion to the
  // headless page as trusted mousemove events (movementX/Y set, clientX/Y frozen). With the
  // pointer-lock override on, that motion turned the view mid-walk (yaw 0.04 -> 0.57) and sent
  // legs off course. Look here comes only from look-only teleports, so mouse motion is dropped
  // before the game's listeners see it; clicks still work.
  await page.addInitScript(() => {
    window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true)
  })
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.newGameWithIntro('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('intro') as { playing: boolean }).playing,
    undefined,
    { timeout: 90_000 },
  )
  await page.keyboard.press('Space')
  await page.waitForFunction(() => !(window.__lastRites!.snapshot('intro') as { playing: boolean }).playing)
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )

  // God mode through the real panel button, then close the panel.
  await withPanel(page, async () => {
    await section(page, 'Cheats')
    await panel(page).getByRole('button', { name: 'God mode' }).click()
    await expect(panel(page).getByRole('button', { name: /God mode/ })).toHaveAttribute('aria-pressed', 'true')
  })

  // --- Leg 1: journal page 1 in the hut (walked from the spawn, no teleport) -----------------
  const p1 = spawn('fx-page-1')
  await expectStep(page, /^Read the page Elias left in the hut \(0\/1\)$/, { x: p1[0], z: p1[2] })
  await walkUntil(page, { x: p1[0], z: p1[2] }, 1.8)
  await pickUp(page, 'fx-page-1')
  expect(await pagesRead(page)).toEqual([1])
  const key = spawn('fx-crypt-key')
  await expectStep(page, /^Find the Rusted Crypt Key \(0\/1\)$/, { x: key[0], z: key[2] })

  // --- Leg 2: Rusted Crypt Key on the oak path (start 6 m south, walked north) ---------------
  const page2 = spawn('fx-page-2')
  await leg(page, { x: -12.3, z: -12 }, { x: page2[0], z: page2[2] }, 1.3)
  await pickUp(page, 'fx-page-2')
  expect(await pagesRead(page)).toEqual([1, 2])
  // Turn to face the key on the spot: the view still points wherever the page-2 aim left it.
  const atPage2 = await feet(page)
  await teleportAndSettle(page, atPage2[0], atPage2[2], yawTo(atPage2[0], atPage2[2], key[0], key[2]))
  await walkUntil(page, { x: key[0], z: key[2] }, 1.3)
  await pickUp(page, 'fx-crypt-key')
  expect((await inventory(page)).inventory.keyItems).toContain('rusted-crypt-key')
  const whistle = spawn('fx-bone-whistle')
  await expectStep(page, /^Search Mausoleum Row for the sexton's whistle \(0\/1\)$/, { x: whistle[0], z: whistle[2] })

  // --- Leg 3: the Row gate (start 6 m south of it), opened with the key ----------------------
  // The gate bars stand at z = entranceZ + dir * wallThickness / 2 = -40 - 0.2 (cemeteryLayout.ts). The old
  // target, -37.2, stopped the player ~4.5 m short: outside the 2.5 m interact range, so no hover.
  await leg(page, { x: -20, z: -33 }, { x: -20, z: -40.2 }, 1.6)
  await interact(page, 'gate-mausoleum-row', [-20, 1.5, -40.2])

  // --- Leg 4: down the alley to the bone whistle: walked through the opened gate -------------
  await lookAt(page, [whistle[0], 1.0, whistle[2]])
  const here = await feet(page)
  await teleportAndSettle(page, here[0], here[2], yawTo(here[0], here[2], whistle[0], whistle[2]))
  await walkUntil(page, { x: whistle[0], z: whistle[2] }, 1.3)
  await pickUp(page, 'fx-bone-whistle')
  expect((await inventory(page)).inventory.keyItems).toContain('bone-whistle')
  await expectStep(page, /^Blow the Bone Whistle at the chapel altar$/, { x: CHAPEL_ALTAR[0], z: CHAPEL_ALTAR[2] })

  // --- Leg 5: the chapel altar. Teleport to the front door, walk the nave -----------------------
  await leg(page, { x: 10, z: -3.5 }, { x: 10, z: 9.8 }, 1.5)
  await interact(page, 'altar-whistle', [10, 0.55, 9.8])
  const okey = spawn('fx-ossuary-key')
  await expectStep(page, /^Find the Iron Ossuary Key in the Crane crypt \(0\/1\)$/, { x: okey[0], z: okey[2] })

  // --- Leg 6: Iron Ossuary Key, then the Crane rosary, at the end of the Row --------------------
  await leg(page, { x: -20.5, z: -51 }, { x: okey[0], z: okey[2] }, 1.3)
  await pickUp(page, 'fx-ossuary-key')
  expect((await inventory(page)).inventory.keyItems).toContain('iron-ossuary-key')
  await expectObjective(page, /^Gather the relics of the rite \(0\/5\)$/)
  const rosary = spawn('fx-rosary')
  // The ossuary-key leg ends 0.5 m from the rosary, with no hover from any aim there:
  // step back and walk the last stretch in, as for every other pickup.
  await leg(page, { x: rosary[0], z: rosary[2] + 4 }, { x: rosary[0], z: rosary[2] }, 1.3)
  await pickUp(page, 'fx-rosary')
  await expectObjective(page, /^Gather the relics of the rite \(1\/5\)$/)
  expect(rosary).toBeDefined()

  // --- Leg 7: Sexton's Bell Clapper under the bell tower -----------------------------------------
  const clapper = spawn('fx-bell-clapper')
  await leg(page, { x: clapper[0], z: clapper[2] + 5 }, { x: clapper[0], z: clapper[2] }, 1.3)
  await pickUp(page, 'fx-bell-clapper')
  await expectObjective(page, /^Gather the relics of the rite \(2\/5\)$/)

  // --- Leg 8: Burial Shroud in the catacombs, then the ossuary door and the Reliquary Heart ---
  const shroud = spawn('fx-shroud')
  // The shroud lies on the stone bier against the west wall (task 11n-c); walking straight at it
  // stops on the bier's south end 1.6 m short. Walk north up the open east side of the corridor.
  await keepDay(page)
  await teleportAndSettle(page, 25.3, 46, Math.PI)
  await walkUntil(page, { x: shroud[0], z: shroud[2] }, 1.1)
  await pickUp(page, 'fx-shroud')
  await expectObjective(page, /^Gather the relics of the rite \(3\/5\)$/)
  const heart = spawn('fx-heart')
  await faceTowards(page, 25, 54)
  await walkUntil(page, { x: 25, z: 54 }, 0.8)
  await interact(page, 'gate-ossuary', [25, 1.1, 55.6])
  await faceTowards(page, heart[0], heart[2])
  // The heart rests on the reliquary altar, so the walk ends at the altar's edge.
  await walkUntil(page, { x: heart[0], z: heart[2] }, 1.6)
  await pickUp(page, 'fx-heart')
  await expectObjective(page, /^Gather the relics of the rite \(4\/5\)$/)

  // --- Leg 9: the Child's Locket, only on the west hill after dark (night 1) -----------------
  await withPanel(page, async () => {
    await section(page, 'Time')
    await panel(page).getByRole('button', { name: 'Night start' }).click()
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
    undefined,
    { timeout: 30_000 },
  )
  // Spec 10 stage loop: a story night has no wave count; the curse holds until the case is answered.
  await expectObjective(page, /^The curse holds\. Solve the case at the altar\.$/)
  const locket = spawn('fx-locket')
  const startZ = locket[2] + 5
  await teleportAndSettle(page, locket[0], startZ, yawTo(locket[0], startZ, locket[0], locket[2]))
  await walkUntil(page, { x: locket[0], z: locket[2] }, 1.3)
  await pickUp(page, 'fx-locket')
  expect((await inventory(page)).inventory.relics).toHaveLength(5)

  // --- The last night (stage 3), the rite ---------------------------------------------------------
  // In the 3-stage design (spec 10) the dev "Night 5" button lands on the last stage's night, and
  // its waves never clear. Until spec 10 task 4 builds the ordered relic placement, the rite is the
  // 45 s hold, offered as soon as the five relics are held: no "Complete objective" is needed.
  await withPanel(page, async () => {
    await section(page, 'Time')
    await panel(page).getByRole('button', { name: 'Night 5', exact: true }).click()
  })
  await page.waitForFunction(
    () => {
      const w = window.__lastRites!.snapshot('world') as { phase: string; nightNumber: number }
      const s = window.__lastRites!.stageState() as { stage: number }
      return w.phase === 'night' && w.nightNumber === 3 && s.stage === 3
    },
    undefined,
    { timeout: 30_000 },
  )
  await expectStep(page, /^Finish the rite at the altar \(5\/5\)$/, { x: CHAPEL_ALTAR[0], z: CHAPEL_ALTAR[2] })
  await withPanel(page, async () => {
    await section(page, 'Time')
    await panel(page).getByRole('button', { name: '5x', exact: true }).click()
  })

  await leg(page, { x: 10, z: 4 }, { x: 10, z: 9.5 }, 1.2, false)
  await page.evaluate(() => window.__lastRites!.hold('Interact'))

  // Father Crane rises 10 s into the rite; the tracker says so. Then he is put to rest (killAll
  // through the same damage rules) and the rite can complete.
  await expectObjective(page, /^Put Father Crane to rest$/)
  const ending = page.locator('.ending')
  for (let i = 0; i < 240 && (await ending.count()) === 0; i++) {
    await page.evaluate(() => window.__lastRites!.killAll())
    await page.waitForTimeout(500)
  }
  await page.evaluate(() => window.__lastRites!.release('Interact'))

  // --- Ending screen: five relics, so Rest -------------------------------------------------------
  await expect(ending).toBeVisible({ timeout: 60_000 })
  await expect(ending).toHaveAttribute('data-ending', 'rest')
  await page.locator('.ending__skip').click()
  await expect(page.getByRole('region', { name: 'Run statistics' })).toBeVisible({ timeout: 30_000 })

  expect(errors).toEqual([])
})

// D1 found that the Rusted Crypt Key, lying on the grass, took the crosshair only from the north
// and south: from the east or west the ray at its centre passed through the bow. Lying hero items
// now carry a hidden hit box (FixedSpawns.tsx). Aimed from 1.3 m on each side, it must hover.
test('a lying key takes the crosshair from every side', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => {
    window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true)
  })
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => {
    window.__lastRites!.startRun('normal')
    // Spec 10: the key lies in Pell's grave only once case 1 is closed.
    window.__lastRites!.closeCase('saved-by-the-bell')
  })
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
  const key = spawn('fx-crypt-key')
  const failed: string[] = []
  for (const [dx, dz] of [
    [0, 1.3],
    // Not from the north: Pell's headstone stands 0.8 m behind the key (spec 10) and hides it.
    [1.3, 0],
    [-1.3, 0],
  ]) {
    const x = key[0] + dx
    const z = key[2] + dz
    const yaw = yawTo(x, z, key[0], key[2])
    await teleportAndSettle(page, x, z, yaw)
    await lookAt(page, [key[0], 0.03, key[2]])
    const ok = await page
      .waitForFunction(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'fixed:fx-crypt-key', undefined, {
        timeout: 3_000,
      })
      .then(() => true)
      .catch(() => false)
    if (!ok) failed.push(`${dx},${dz}`)
  }
  expect(failed).toEqual([])
})
