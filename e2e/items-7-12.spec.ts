// Task 11.2, pass B: playtest items 7 to 12, played in real Chrome through the debug hook.
// Measurements go to e2e/logs/items-7-12.log, screenshots to e2e/screenshots/.
// Where a step uses store/system code instead of a real input path, the comment says so.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const LOG_DIR = 'e2e/logs'
const SHOT_DIR = 'e2e/screenshots'
const LOG_FILE = `${LOG_DIR}/items-7-12.log`
mkdirSync(LOG_DIR, { recursive: true })
mkdirSync(SHOT_DIR, { recursive: true })
const log = (line: string) => {
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}

interface World {
  phase: string
  phaseTime: number
  nightNumber: number
}
interface WaveSnap {
  waves: { phase: string; waveIndex: number }
}
interface Enemy {
  uid: string
  type: string
  hp: number
  state: string
  pos: { x: number; z: number }
}
interface Objective {
  main: string
  second?: string
  rule: number
  position?: number[]
}
interface Boss {
  stage: string
  nameCardLeftS: number
  riteClock: number
}
interface EndingSnap {
  ending: string | null
  stage: string
  riteStarted: boolean
  nightFiveCleared: boolean
}

const RELICS = ['crane-rosary', 'sextons-bell-clapper', 'childs-locket', 'burial-shroud', 'reliquary-heart'] as const

const snap = <T>(page: Page, name: Parameters<NonNullable<Window['__lastRites']>['snapshot']>[0]) =>
  page.evaluate((n) => window.__lastRites!.snapshot(n), name) as Promise<T>

async function until<A>(page: Page, fn: (arg: A) => unknown, arg: A, timeout = 90_000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 200 })
}

async function boot(page: Page, mode: 'normal' | 'endless' = 'normal') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate((m) => window.__lastRites!.startRun(m), mode)
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phaseTime > 0.3, null, 120_000)
  await until(page, () => window.__lastRites!.body() !== null, null, 60_000)
  return errors
}

const bodyAt = (page: Page, x: number, z: number, tol = 0.3, timeout = 60_000) =>
  until(
    page,
    (a) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - a.x, b.feet[2] - a.z) < a.tol
    },
    { x, z, tol },
    timeout,
  )

async function goToNight(page: Page, n: number) {
  await page.evaluate((k) => window.__lastRites!.skipToDusk(k), n)
  await until(page, (k) => {
    const w = window.__lastRites!.snapshot('world') as World
    return w.phase === 'dusk' && w.nightNumber === k
  }, n)
  await page.evaluate((k) => window.__lastRites!.skipToNight(k), n)
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'night', null)
}

/** Kills each wave through the damage rules until the director reports the night's waves done. */
async function clearWaves(page: Page, stopWhen?: () => Promise<boolean>) {
  const deadline = Date.now() + 600_000
  for (;;) {
    const w = await snap<WaveSnap>(page, 'wave')
    if (w.waves.phase === 'done') return
    if (stopWhen && (await stopWhen())) return
    if (Date.now() > deadline) throw new Error(`waves did not clear: ${JSON.stringify(w)}`)
    await page.evaluate(() => window.__lastRites!.killAll())
    await page.waitForTimeout(400)
  }
}

/** Night 5 with `relics` relics held, every wave cleared and the rite offered. */
async function nightFiveReady(page: Page, relics: number) {
  await page.evaluate((r) => {
    const h = window.__lastRites!
    h.keepAlive(true)
    r.forEach((id) => h.give(id as never, 1))
  }, RELICS.slice(0, relics) as unknown as string[])
  await goToNight(page, 5)
  await clearWaves(page)
}

/** Stands at the altar and holds Interact: the real rite action (FinalRite.tsx reads the input). */
async function holdRite(page: Page) {
  await page.evaluate(() => window.__lastRites!.teleport(10, 8.5, { yaw: 0 }))
  await bodyAt(page, 10, 8.5)
  await page.evaluate(() => window.__lastRites!.hold('Interact'))
  await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).riteStarted, null, 30_000)
}

const objectiveMain = async (page: Page) => (await snap<Objective | null>(page, 'objective'))?.main ?? ''

/** Rects of two selectors, null until both exist. */
const rectsOf = (page: Page, a: string, b: string) =>
  page.waitForFunction(
    (sel) => {
      const ea = document.querySelector(sel.a)
      const eb = document.querySelector(sel.b)
      if (!ea || !eb) return null
      const r = (e: Element) => {
        const x = e.getBoundingClientRect()
        return { left: x.left, top: x.top, right: x.right, bottom: x.bottom }
      }
      return { a: r(ea), b: r(eb), vw: innerWidth, vh: innerHeight }
    },
    { a, b },
    { timeout: 180_000, polling: 100 },
  )

// ---------------------------------------------------------------------------------------------
// Item 7
// ---------------------------------------------------------------------------------------------

/** SwiftShader frames are slow and screenshots can show an older frame: let 
 frames really pass. */
async function renderedFrames(page: Page, n: number) {
  await page.evaluate((k) => new Promise<void>((res) => { let c = 0; const f = () => (++c >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f) }), n)
  await page.waitForTimeout(500)
}

/** Decodes two PNGs in the page and measures the pixels that differ between them. */
async function measureZombiePixels(page: Page, withZombie: Buffer, clean: Buffer, clean2: Buffer) {
  return page.evaluate(
    async (imgs) => {
      const load = (b64: string) =>
        new Promise<ImageData>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            const c = document.createElement('canvas')
            c.width = img.width
            c.height = img.height
            const g = c.getContext('2d')!
            g.drawImage(img, 0, 0)
            resolve(g.getImageData(0, 0, c.width, c.height))
          }
          img.onerror = () => reject(new Error('decode failed'))
          img.src = `data:image/png;base64,${b64}`
        })
      const [z, c1, c2] = await Promise.all([load(imgs.z), load(imgs.c1), load(imgs.c2)])
      const W = z.width
      const H = z.height
      // Centre clip: the middle half of the width, from 12% to 95% of the height.
      const x0 = Math.floor(W * 0.25)
      const x1 = Math.floor(W * 0.75)
      const y0 = Math.floor(H * 0.12)
      const y1 = Math.floor(H * 0.95)
      // 4x4 block means, so per-pixel film grain does not count as a difference.
      const B = 4
      const THRESH = 45
      let n = 0
      let noise = 0
      let sumS = 0
      let sumV = 0
      let sumR = 0
      let sumG = 0
      let sumB = 0
      const mean = (im: ImageData, bx: number, by: number) => {
        let r = 0
        let g = 0
        let b = 0
        for (let y = by; y < by + B; y++) {
          for (let x = bx; x < bx + B; x++) {
            const i = (y * W + x) * 4
            r += im.data[i]
            g += im.data[i + 1]
            b += im.data[i + 2]
          }
        }
        const k = B * B
        return [r / k, g / k, b / k]
      }
      const diff = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
      for (let by = y0; by < y1 - B; by += B) {
        for (let bx = x0; bx < x1 - B; bx += B) {
          const mz = mean(z, bx, by)
          const m1 = mean(c1, bx, by)
          const m2 = mean(c2, bx, by)
          if (diff(m2, m1) > THRESH) noise++
          if (diff(mz, m1) <= THRESH) continue
          const [r, g, b] = mz
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          n++
          sumS += max === 0 ? 0 : (max - min) / max
          sumV += max / 255
          sumR += r
          sumG += g
          sumB += b
        }
      }
      return {
        pixels: n,
        noisePixels: noise,
        clipPixels: Math.floor((x1 - x0) / B) * Math.floor((y1 - y0) / B),
        meanS: n ? sumS / n : 0,
        meanV: n ? sumV / n : 0,
        meanRGB: n ? [sumR / n, sumG / n, sumB / n].map((v) => Math.round(v)) : [0, 0, 0],
      }
    },
    { z: withZombie.toString('base64'), c1: clean.toString('base64'), c2: clean2.toString('base64') },
  )
}

test('item 7: zombie look at 1.5 m and 2 m at night, lantern on', async ({ page }) => {
  test.setTimeout(600_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await goToNight(page, 1)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setLantern(true, 100)
    h.teleport(0, 0, { yaw: 0 })
    h.equip(0)
  })
  await bodyAt(page, 0, 0)

  const results: Record<string, Awaited<ReturnType<typeof measureZombiePixels>>> = {}
  for (const d of [1.5, 2]) {
    const uids = await page.evaluate((dist) => window.__lastRites!.spawnZombies([{ x: 0, z: -dist, hp: 1_000 }]), d)
    // Past the 1.5 s rise, then held where it stands (a stagger) so the distance stays exact.
    await until(page, (u) => {
      const e = (window.__lastRites!.snapshot('enemies') as Enemy[]).find((z) => z.uid === u)
      return e !== undefined && e.state !== 'rise'
    }, uids[0], 60_000)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.holdZombies((h.snapshot('enemies') as Enemy[]).map((e) => e.uid), 300)
    })
    await until(page, (u) => (window.__lastRites!.snapshot('enemies') as Enemy[]).find((z) => z.uid === u)?.state === 'stagger', uids[0], 30_000)
    await renderedFrames(page, 8)
    const e = (await snap<Enemy[]>(page, 'enemies')).find((z) => z.uid === uids[0])!
    const player = await snap<{ position: number[] }>(page, 'player')
    const dist = Math.hypot(e.pos.x - player.position[0], e.pos.z - player.position[2])
    const withZombie = await page.screenshot()
    writeFileSync(`${SHOT_DIR}/zombie-${d}m.png`, withZombie)
    await page.evaluate((u) => window.__lastRites!.removeZombies(u), uids)
    await renderedFrames(page, 8)
    const clean = await page.screenshot()
    writeFileSync(`${SHOT_DIR}/zombie-${d}m-clean.png`, clean)
    await renderedFrames(page, 4)
    const clean2 = await page.screenshot()
    results[`${d}`] = await measureZombiePixels(page, withZombie, clean, clean2)
    const m = results[`${d}`]
    log(`item7 ${d} m (measured ${dist.toFixed(2)} m): zombiePixels=${m.pixels} of clip ${m.clipPixels}, noisePixels=${m.noisePixels}, ` +
      `meanS=${m.meanS.toFixed(3)} meanV=${m.meanV.toFixed(3)} meanRGB=${m.meanRGB.join(',')}`)
    expect(Math.abs(dist - d)).toBeLessThan(0.3)
  }
  for (const [d, m] of Object.entries(results)) {
    // The numbers only mean something if the zombie really is in the frame and the diff is not noise.
    expect(m.pixels, `zombie pixels at ${d} m`).toBeGreaterThan(300)
    expect(m.noisePixels, `noise pixels at ${d} m`).toBeLessThan(m.pixels * 0.25)
    expect(m.meanS, `mean saturation at ${d} m`).toBeLessThan(0.5)
    expect(m.meanV, `mean value at ${d} m`).toBeGreaterThan(0.12)
  }
  log('item7 note: whether it looks "corpse-like" is a matter of taste; look at e2e/screenshots/zombie-1.5m.png and zombie-2m.png')
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// Items 8 and 9
// ---------------------------------------------------------------------------------------------

test('item 8: final rite objective follows Father Crane', async ({ page }) => {
  test.setTimeout(900_000)
  const errors = await boot(page)
  await nightFiveReady(page, 5)
  await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).nightFiveCleared, null, 30_000)
  await until(page, () => (window.__lastRites!.snapshot('objective') as Objective | null)?.rule === 2, null, 30_000)
  const before = await objectiveMain(page)
  log(`item8 before the rite: "${before}"`)
  expect(before).toMatch(/^Finish the rite at the altar/)

  // Records every distinct objective line with the boss stage, from now on.
  await page.evaluate(() => {
    const w = window as unknown as { __obj: { main: string; stage: string }[] }
    w.__obj = []
    const h = window.__lastRites!
    let last = ''
    setInterval(() => {
      const o = h.snapshot('objective') as { main: string } | null
      const stage = (h.snapshot('boss') as { stage: string }).stage
      const key = `${o?.main}|${stage}`
      if (key !== last) {
        last = key
        w.__obj.push({ main: o?.main ?? '', stage })
      }
    }, 50)
  })

  await holdRite(page)
  await until(page, () => (window.__lastRites!.snapshot('boss') as Boss).stage === 'risen', null, 180_000)
  const alive = await objectiveMain(page)
  const markers = await page.locator('.compass__marker--objective').allTextContents()
  log(`item8 Crane alive: "${alive}" compass objective markers=${JSON.stringify(markers)}`)
  expect(alive).toBe('Put Father Crane to rest')
  expect(markers.length).toBeGreaterThan(0)
  expect(markers.join(' ')).toMatch(/\d+ m/)
  expect((await snap<World>(page, 'world')).phase).toBe('night')

  // Releasing Interact keeps the rite at its 44 s cap; then he falls through the damage rules.
  await page.evaluate(() => {
    window.__lastRites!.release('Interact')
    window.__lastRites!.killAll()
  })
  await until(page, () => (window.__lastRites!.snapshot('boss') as Boss).stage === 'dead', null, 60_000)
  await until(page, () => (window.__lastRites!.snapshot('objective') as Objective | null)?.main.startsWith('Finish the rite') === true, null, 30_000)
  const after = await objectiveMain(page)
  const markersAfter = await page.locator('.compass__marker--objective').allTextContents()
  log(`item8 Crane dead: "${after}" compass objective markers=${JSON.stringify(markersAfter)}`)
  expect(after).toMatch(/^Finish the rite at the altar/)
  expect(markersAfter.length).toBeGreaterThan(0)

  const seen = await page.evaluate(() => (window as unknown as { __obj: { main: string; stage: string }[] }).__obj)
  log(`item8 objective lines seen since the rite became available: ${JSON.stringify(seen)}`)
  for (const s of seen) expect(s.main).not.toMatch(/Survive: Wave/)
  expect(seen.some((s) => s.main === 'Put Father Crane to rest')).toBe(true)
  expect(errors).toEqual([])
})

for (const vp of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`item 9: boss name card does not touch the boss bar at ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(900_000)
    await page.setViewportSize(vp)
    const errors = await boot(page)
    await nightFiveReady(page, 5)
    await holdRite(page)
    const handle = await rectsOf(page, '.boss-name-card', '.boss-bar')
    const r = (await handle.jsonValue()) as {
      a: Record<'left' | 'top' | 'right' | 'bottom', number>
      b: Record<'left' | 'top' | 'right' | 'bottom', number>
      vw: number
      vh: number
    }
    await page.screenshot({ path: `${SHOT_DIR}/boss-card-${vp.width}x${vp.height}.png` })
    const intersects = !(r.a.right <= r.b.left || r.a.left >= r.b.right || r.a.bottom <= r.b.top || r.a.top >= r.b.bottom)
    log(`item9 ${vp.width}x${vp.height}: viewport=${r.vw}x${r.vh} card=${JSON.stringify(r.a)} bar=${JSON.stringify(r.b)} intersects=${intersects}`)
    expect(r.vw).toBe(vp.width)
    expect(intersects).toBe(false)
    // Both are inside the window.
    for (const box of [r.a, r.b]) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(r.vw)
      expect(box.bottom).toBeLessThanOrEqual(r.vh)
    }
    expect(errors).toEqual([])
  })
}

// ---------------------------------------------------------------------------------------------
// Item 10
// ---------------------------------------------------------------------------------------------

/** What an interactable cue looks like right now: DOM and scene graph. */
async function cueState(page: Page) {
  const cues = await page.evaluate(() => window.__lastRites!.runeCues())
  const hover = await snap<{ id: string } | null>(page, 'hover')
  const handCrosshair = await page.locator('.hud-crosshair[data-interactable="true"]').count()
  const prompt = await page.locator('.hud-prompt').count()
  return { cues, hover: hover?.id ?? null, handCrosshair, prompt }
}

/** Walks to the grave used in pass A and aims at it, so there is a real hover target. */
async function aimAtGrave(page: Page) {
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setLantern(true, 100)
    h.teleport(-15, 13.5, { yaw: 0, pitch: -0.8 })
  })
  await bodyAt(page, -15, 13.5)
  await until(page, () => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === 'dig:grave-oak-hollow', null, 30_000)
}

test('item 10a: no rune or hover cue during the intro cutscene', async ({ page }) => {
  test.setTimeout(600_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  // New Game through the real flow (beginMode plays the intro); nothing here skips it.
  await page.evaluate(() => window.__lastRites!.newGameWithIntro('normal'))
  await until(page, () => window.__lastRites!.runeCues() !== null, null, 120_000)
  const t0 = Date.now()
  const samples: Awaited<ReturnType<typeof cueState>>[] = []
  for (;;) {
    const intro = await snap<{ playing: boolean }>(page, 'intro')
    if (!intro.playing) break
    if (Date.now() - t0 > 240_000) throw new Error('intro did not finish')
    samples.push(await cueState(page))
    await page.waitForTimeout(1000)
  }
  const introWall = (Date.now() - t0) / 1000
  const maxVisible = Math.max(...samples.map((s) => s.cues?.visibleRunes ?? 0))
  const totalRunes = Math.max(...samples.map((s) => s.cues?.runes ?? 0))
  log(`item10 intro: ${samples.length} samples over ${introWall.toFixed(1)} s, rune sprites in scene=${totalRunes}, ` +
    `max visible runes=${maxVisible}, max outlines=${Math.max(...samples.map((s) => s.cues?.outlines ?? 0))}, ` +
    `hand crosshair samples=${samples.filter((s) => s.handCrosshair > 0).length}, prompt samples=${samples.filter((s) => s.prompt > 0).length}, ` +
    `hover samples=${samples.filter((s) => s.hover !== null).length}`)
  expect(samples.length).toBeGreaterThan(5)
  expect(totalRunes).toBeGreaterThan(0)
  expect(maxVisible).toBe(0)
  for (const s of samples) {
    expect(s.cues?.outlines).toBe(0)
    expect(s.handCrosshair).toBe(0)
    expect(s.prompt).toBe(0)
    expect(s.hover).toBeNull()
  }

  // Control: the same measurement sees the cues in normal play, so a 0 above is meaningful.
  await until(page, () => window.__lastRites!.body() !== null, null, 60_000)
  await aimAtGrave(page)
  await page.waitForTimeout(1500)
  const control = await cueState(page)
  log(`item10 control after the intro: ${JSON.stringify(control)}`)
  expect(control.hover).toBe('dig:grave-oak-hollow')
  expect(control.handCrosshair).toBeGreaterThan(0)
  expect(control.prompt).toBeGreaterThan(0)
  expect(control.cues!.visibleRunes).toBeGreaterThan(0)
  expect(control.cues!.outlines).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('item 10b: no rune or hover cue during an ending (Taken, reached through the real rite check)', async ({ page }) => {
  test.setTimeout(900_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await goToNight(page, 5)
  await aimAtGrave(page)
  await page.waitForTimeout(1500)
  const control = await cueState(page)
  log(`item10 control before the ending: ${JSON.stringify(control)}`)
  expect(control.handCrosshair).toBeGreaterThan(0)
  expect(control.cues!.visibleRunes).toBeGreaterThan(0)

  // No relics and every wave cleared: FinalRite.tsx itself calls startEnding('taken').
  await clearWaves(page, async () => (await snap<EndingSnap>(page, 'ending')).ending !== null)
  await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).ending === 'taken', null, 60_000)
  const samples: Awaited<ReturnType<typeof cueState>>[] = []
  for (let i = 0; i < 8; i++) {
    const e = await snap<EndingSnap>(page, 'ending')
    if (e.stage !== 'sequence') break
    samples.push(await cueState(page))
    await page.waitForTimeout(1000)
  }
  const screen = await snap<{ screen: string }>(page, 'game')
  log(`item10 ending (screen=${screen.screen}): ${samples.length} samples, max visible runes=${Math.max(...samples.map((s) => s.cues?.visibleRunes ?? 0))}, ` +
    `max outlines=${Math.max(...samples.map((s) => s.cues?.outlines ?? 0))}, hand crosshair samples=${samples.filter((s) => s.handCrosshair > 0).length}, ` +
    `prompt samples=${samples.filter((s) => s.prompt > 0).length}, hover=${JSON.stringify(samples.map((s) => s.hover))}`)
  expect(screen.screen).toBe('ending')
  expect(samples.length).toBeGreaterThan(3)
  for (const s of samples) {
    expect(s.cues?.visibleRunes).toBe(0)
    expect(s.cues?.outlines).toBe(0)
    expect(s.handCrosshair).toBe(0)
    expect(s.prompt).toBe(0)
  }
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// Item 11
// ---------------------------------------------------------------------------------------------

/** Watches the ending from the moment it starts to the summary screen, in the page. */
async function installEndingWatch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __end: { start: number | null; wall: number | null; clock: number; maxClock: number; ending: string | null } }
    w.__end = { start: null, wall: null, clock: 0, maxClock: 0, ending: null }
    const h = window.__lastRites!
    setInterval(() => {
      const e = h.snapshot('ending') as { ending: string | null; stage: string }
      if (e.ending === null || w.__end.wall !== null) return
      if (w.__end.start === null) {
        w.__end.start = performance.now()
        w.__end.ending = e.ending
      }
      if (e.stage === 'sequence') w.__end.maxClock = Math.max(w.__end.maxClock, h.endingClock())
      else w.__end.wall = performance.now() - w.__end.start
    }, 50)
  })
}

const endingResult = (page: Page) =>
  page.evaluate(() => (window as unknown as { __end: { wall: number | null; maxClock: number; ending: string | null } }).__end)

/** Plays the real rite (hold Interact at the altar) with `relics` relics, killing Crane when he rises. */
async function playRiteToEnding(page: Page, relics: number) {
  await nightFiveReady(page, relics)
  await installEndingWatch(page)
  await holdRite(page)
  await until(page, () => (window.__lastRites!.snapshot('boss') as Boss).stage === 'risen', null, 180_000)
  await page.evaluate(() => window.__lastRites!.killAll())
  // Interact stays held: progress was capped at 44 s and now runs on to 45 s.
  await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).ending !== null, null, 240_000)
}

async function measureEnding(page: Page, id: string) {
  await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).stage === 'summary', null, 240_000)
  await page.evaluate(() => window.__lastRites!.release('Interact'))
  const r = await endingResult(page)
  log(`item11 ${id}: wall ${((r.wall ?? 0) / 1000).toFixed(1)} s, sequence clock reached ${r.maxClock.toFixed(1)} s, ending=${r.ending}`)
  expect(r.ending).toBe(id)
  // The clock is what the design budgets (45 s); wall time can be longer under SwiftShader.
  expect(r.maxClock).toBeLessThanOrEqual(45.5)
  expect(r.maxClock).toBeGreaterThan(30)
  if ((r.wall ?? 0) / 1000 > 45.5) {
    log(`item11 ${id}: wall time exceeded 45 s (${((r.wall ?? 0) / 1000).toFixed(1)} s) while the sequence clock is ${r.maxClock.toFixed(1)} s: ` +
      'the clock advances by frame delta, and SwiftShader frames are slow; not a design overrun')
  }
  await expect(page.locator('.ending__stat').first()).toBeVisible()
}

test('item 11: Rest ending reaches the summary unskipped (real rite, 5 relics)', async ({ page }) => {
  test.setTimeout(1_500_000)
  const errors = await boot(page)
  await playRiteToEnding(page, 5)
  await measureEnding(page, 'rest')
  expect(errors).toEqual([])
})

test('item 11: Uneasy Peace ending reaches the summary unskipped (real rite, 4 relics)', async ({ page }) => {
  test.setTimeout(1_500_000)
  const errors = await boot(page)
  await playRiteToEnding(page, 4)
  await measureEnding(page, 'uneasy-peace')
  expect(errors).toEqual([])
})

test('item 11: Taken ending reaches the summary unskipped (real night-5 check, 0 relics)', async ({ page }) => {
  test.setTimeout(1_500_000)
  const errors = await boot(page)
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await installEndingWatch(page)
  await goToNight(page, 5)
  await clearWaves(page, async () => (await snap<EndingSnap>(page, 'ending')).ending !== null)
  await measureEnding(page, 'taken')
  expect(errors).toEqual([])
})

test('item 11: Space and Enter skip the ending sequence', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  for (const [key, id] of [['Space', 'rest'], ['Enter', 'taken']] as const) {
    await page.evaluate((e) => window.__lastRites!.startEnding(e), id)
    await until(page, () => (window.__lastRites!.snapshot('game') as { screen: string }).screen === 'ending', null, 30_000)
    await page.waitForTimeout(3000)
    const mid = await snap<EndingSnap>(page, 'ending')
    const clock = await page.evaluate(() => window.__lastRites!.endingClock())
    expect(mid.stage).toBe('sequence')
    await page.keyboard.press(key)
    await until(page, () => (window.__lastRites!.snapshot('ending') as EndingSnap).stage === 'summary', null, 10_000)
    log(`item11 skip: ${key} at sequence clock ${clock.toFixed(1)} s went to the summary`)
  }
  expect(errors).toEqual([])
})

// ---------------------------------------------------------------------------------------------
// Item 12
// ---------------------------------------------------------------------------------------------

const readStats = async (page: Page) => {
  const rows = await page.locator('.ending__stat').evaluateAll((els) =>
    els.map((e) => [e.querySelector('dt')?.textContent ?? '', e.querySelector('dd')?.textContent ?? '']),
  )
  return Object.fromEntries(rows) as Record<string, string>
}

test('item 12a: Endless objective and stats rows', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page, 'endless')
  await until(page, () => (window.__lastRites!.snapshot('objective') as Objective | null) !== null, null, 30_000)
  const o = await snap<Objective>(page, 'objective')
  const world = await snap<World>(page, 'world')
  log(`item12 endless day objective: "${o.main}" / "${o.second}" (phase ${world.phase})`)
  expect(world.phase).toBe('day')
  expect(o.main).not.toMatch(/Read the page/)
  expect(o.main).toBe('Prepare for the night')
  await expect(page.locator('.hud-objective').first()).toContainText('Prepare for the night')

  // Endless has no Retry Night: death ends the run and shows the stats.
  await page.evaluate(() => window.__lastRites!.hurt(10_000))
  await expect(page.locator('.ending__stat').first()).toBeVisible({ timeout: 30_000 })
  const rows = await readStats(page)
  log(`item12 endless stats rows: ${JSON.stringify(rows)}`)
  expect(Object.keys(rows)).not.toContain('Father Crane banished')
  expect(Object.keys(rows)).not.toContain('Relics')
  expect(rows['Best combo']).toBe('×1.00')
  expect(errors).toEqual([])
})

test('item 12b: story mode stats rows and Best combo', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page, 'normal')
  await until(page, () => (window.__lastRites!.snapshot('objective') as Objective | null) !== null, null, 30_000)
  const o = await snap<Objective>(page, 'objective')
  log(`item12 story day objective: "${o.main}"`)
  // Story day one reads the page; Endless must not.
  expect(o.main).toMatch(/Read the page/)
  await page.evaluate(() => window.__lastRites!.startEnding('taken'))
  await page.waitForTimeout(1500)
  await page.keyboard.press('Space')
  await expect(page.locator('.ending__stat').first()).toBeVisible({ timeout: 30_000 })
  const rows = await readStats(page)
  log(`item12 story stats rows: ${JSON.stringify(rows)}`)
  expect(rows['Best combo']).toBe('×1.00')
  expect(Object.keys(rows)).toContain('Relics')
  expect(Object.keys(rows)).toContain('Father Crane banished')
  expect(errors).toEqual([])
})
