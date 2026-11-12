// Task 11.2, pass A: playtest items 1 to 6, played in real Chrome through the debug hook.
// Measurements go to e2e/logs/items-1-6.log. Where a step uses store/system code instead of a
// real input path, the comment says so.
import { appendFileSync, mkdirSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

const LOG_DIR = 'e2e/logs'
const LOG_FILE = `${LOG_DIR}/items-1-6.log`
mkdirSync(LOG_DIR, { recursive: true })
const log = (line: string) => {
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}

interface World {
  phase: string
  phaseTime: number
  nightNumber: number
  wavesCleared: boolean
}
interface WaveSnap {
  waves: { phase: string; waveIndex: number; night: number | null }
  totalWaves: number
}
interface Enemy {
  uid: string
  type: string
  hp: number
  state: string
  pos: { x: number; z: number }
}

const snap = <T>(page: Page, name: Parameters<NonNullable<Window['__lastRites']>['snapshot']>[0]) =>
  page.evaluate((n) => window.__lastRites!.snapshot(n), name) as Promise<T>

/** Polls `fn` in the page until it returns truthy. */
async function until<A>(page: Page, fn: (arg: A) => unknown, arg: A, timeout = 90_000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 200 })
}

async function boot(page: Page, mode: 'normal' | 'endless' = 'normal') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate((m) => window.__lastRites!.startRun(m), mode)
  // The sim clock only moves once the scene is mounted.
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phaseTime > 0.3, null, 120_000)
  await until(page, () => window.__lastRites!.body() !== null, null, 60_000)
  return errors
}

/** Waits until the real Rapier body is within `tol` metres (x/z) of the spot. */
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

const body = (page: Page) => page.evaluate(() => window.__lastRites!.body())

/**
 * Plays one night: real clock into dusk and night, then kills every wave through the damage rules
 * (hook.killAll, not swings) until the director reports the night done. Returns what was observed.
 */
async function playNight(page: Page, n: number, expectedWaves: number) {
  await page.evaluate((k) => window.__lastRites!.skipToDusk(k), n)
  await until(page, (k) => {
    const w = window.__lastRites!.snapshot('world') as World
    return w.phase === 'dusk' && w.nightNumber === k
  }, n)
  await page.evaluate((k) => window.__lastRites!.skipToNight(k), n)
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'night', null)

  const startWave = await snap<WaveSnap>(page, 'wave')
  // Night starts with its waves active and zombies on the way; it must not slide into dawn.
  await until(page, () => (window.__lastRites!.snapshot('enemies') as Enemy[]).some((e) => e.hp > 0), null, 120_000)
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phaseTime > 3, null, 120_000)
  const early = await snap<World>(page, 'world')
  const earlyEvents = await page.evaluate(() => window.__lastRites!.events())
  const dawnsSoFar = earlyEvents.filter((e) => e.type === 'dawnStarted').length

  const seenWaveIndexes = new Set<number>()
  const violations: string[] = []
  const deadline = Date.now() + 600_000
  for (;;) {
    const w = await snap<WaveSnap>(page, 'wave')
    const world = await snap<World>(page, 'world')
    seenWaveIndexes.add(w.waves.waveIndex)
    if (w.waves.phase !== 'done' && world.phase !== 'night') violations.push(`phase ${world.phase} with waves ${w.waves.phase}`)
    if (w.waves.phase === 'done') break
    if (Date.now() > deadline) throw new Error(`night ${n} did not clear: ${JSON.stringify(w)}`)
    await page.evaluate(() => window.__lastRites!.killAll())
    await page.waitForTimeout(400)
  }
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'dawn', null)
  const dawn = await snap<{ pendingPick: string[] | null; dawnSummary: { zombiesBanished: number } | null }>(page, 'progression')
  await page.waitForTimeout(2500)
  const stillDawn = (await snap<World>(page, 'world')).phase === 'dawn'
  await page.evaluate(() => window.__lastRites!.pickAnyUpgrade())
  await until(page, (k) => {
    const w = window.__lastRites!.snapshot('world') as World
    return w.phase === 'day' && w.nightNumber === k + 1
  }, n, 60_000)
  return {
    startWave, early, dawnsSoFar, seenWaves: seenWaveIndexes.size, violations,
    dawn, stillDawn, expectedWaves,
  }
}

test('item 1: nights 1, 2 and 3 in a row', async ({ page }) => {
  test.setTimeout(1_800_000)
  const errors = await boot(page)
  const plan = [2, 3, 3]
  for (let n = 1; n <= 3; n++) {
    const r = await playNight(page, n, plan[n - 1])
    log(`item1 night ${n}: totalWaves=${r.startWave.totalWaves} waveNight=${r.startWave.waves.night} ` +
      `phaseAfter3s=${r.early.phase} dawnsBeforeClear=${r.dawnsSoFar} wavesSeen=${r.seenWaves} ` +
      `violations=${r.violations.length} pendingPick=${r.dawn.pendingPick?.length} ` +
      `banished=${r.dawn.dawnSummary?.zombiesBanished} dawnHeldWhilePicking=${r.stillDawn}`)
    expect(r.startWave.totalWaves).toBe(r.expectedWaves)
    expect(r.startWave.waves.night).toBe(n)
    // Night n+1 must not start in dawn because the previous night left wavesCleared set.
    expect(r.early.phase).toBe('night')
    expect(r.early.wavesCleared).toBe(false)
    expect(r.dawnsSoFar).toBe(n - 1)
    expect(r.seenWaves).toBe(r.expectedWaves)
    expect(r.violations).toEqual([])
    expect(r.dawn.pendingPick).not.toBeNull()
    expect(r.stillDawn).toBe(true)
    // By day the tally must be gone and the flag cleared.
    expect((await snap<World>(page, 'world')).wavesCleared).toBe(false)
    const tally = await page.locator('.hud-tally').allTextContents()
    expect(tally.join(' ')).not.toMatch(/waves cleared/i)
    await expect(page.locator('.hud-tally')).toHaveCount(0)
  }
  const events = await page.evaluate(() => window.__lastRites!.events())
  const order = events.filter((e) => e.type === 'phaseChanged').map((e) => `${e.phase}`).join('>')
  log(`item1 phase sequence: ${order}`)
  expect(errors).toEqual([])
})

test('item 2: a shovel kill pays score, combo, stats and one coin pile', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  const seed = await page.evaluate(() => window.__lastRites!.seedForShamblerCoins(2, 1))
  // Watch every change to the coin piles and the banked balance, because a pile within 1.5 m of
  // the player is collected on the next tick.
  await page.evaluate(() => {
    const w = window as unknown as { __coinTrace: unknown[] }
    w.__coinTrace = []
    const h = window.__lastRites!
    let last = ''
    setInterval(() => {
      const c = h.snapshot('coins') as { piles: { amount: number }[]; nextId: number }
      const p = h.snapshot('progression') as { coins: number; stats: { coinsEarned: number } }
      const key = `${c.nextId}|${c.piles.length}|${p.coins}`
      if (key !== last) {
        last = key
        w.__coinTrace.push({ created: c.nextId - 1, piles: c.piles.map((x) => x.amount), banked: p.coins, earned: p.stats.coinsEarned })
      }
    }, 20)
  })

  const swingKill = async (x: number, z: number, expectKills: number) => {
    await page.evaluate((a) => {
      const h = window.__lastRites!
      h.teleport(0, 0, { yaw: 0 })
      h.keepAlive(true)
      h.equip(0)
      // One Shambler in front of the player with 1 HP, so a single shovel hit kills it.
      h.spawnZombies([{ x: a.x, z: a.z, hp: 1 }])
    }, { x, z })
    await bodyAt(page, 0, 0)
    // Real Attack action: key held across frames, released when the kill registers.
    await page.evaluate(() => window.__lastRites!.hold('Attack'))
    await until(page, (k) => (window.__lastRites!.snapshot('progression') as { stats: { kills: { shambler: number } } }).stats.kills.shambler >= k, expectKills, 60_000)
    await page.evaluate(() => window.__lastRites!.release('Attack'))
  }

  await swingKill(0, -1.5, 1)
  await page.waitForTimeout(1500)
  const p1 = await snap<{ score: number; coins: number; stats: { kills: { shambler: number }; zombiesBanished: number; meleeHits: number; bestCombo: number } }>(page, 'progression')
  const s1 = await snap<{ combo: number; nightKills: number; seen: string[] }>(page, 'score')
  log(`item2 kill1: seed=${seed} score=${p1.score} combo=${s1.combo} kills.shambler=${p1.stats.kills.shambler} ` +
    `banished=${p1.stats.zombiesBanished} meleeHits=${p1.stats.meleeHits} bestCombo=${p1.stats.bestCombo} nightKills=${s1.nightKills}`)
  expect(p1.score).toBeGreaterThan(0)
  expect(p1.stats.kills.shambler).toBe(1)
  expect(p1.stats.zombiesBanished).toBe(1)
  expect(s1.nightKills).toBe(1)
  expect(s1.seen.length).toBe(1)
  expect(p1.stats.meleeHits).toBeGreaterThanOrEqual(1)

  await swingKill(0.3, -1.5, 2)
  await page.waitForTimeout(3000)
  const p2 = await snap<typeof p1>(page, 'progression')
  const s2 = await snap<typeof s1>(page, 'score')
  const trace = await page.evaluate(() => (window as unknown as { __coinTrace: unknown[] }).__coinTrace)
  log(`item2 kill2: score=${p2.score} combo=${s2.combo} kills.shambler=${p2.stats.kills.shambler} banished=${p2.stats.zombiesBanished} nightKills=${s2.nightKills}`)
  log(`item2 coin trace: ${JSON.stringify(trace)}`)
  expect(p2.score).toBeGreaterThan(p1.score)
  expect(p2.stats.kills.shambler).toBe(2)
  expect(p2.stats.zombiesBanished).toBe(2)
  expect(s2.nightKills).toBe(2)
  expect(s2.combo).toBeGreaterThan(s1.combo - 0.0001)
  // Exactly two piles were created (one per kill), and each was banked once.
  const t = trace as { created: number; piles: number[]; banked: number }[]
  expect(Math.max(...t.map((x) => x.created))).toBe(2)
  // The first pile lay exactly 1.5 m away and was banked at once; the second (1.53 m) is still on the ground.
  // On fast (GPU) frames pile 1 can be created and banked between two 20 ms samples, so check the
  // balance it left behind (1 coin before pile 2 appeared) rather than catching it on the ground.
  expect(t.some((x) => x.created === 1 && (x.piles.length === 1 || x.banked === 1))).toBe(true)
  expect((await snap<{ piles: unknown[] }>(page, 'coins')).piles).toHaveLength(1)
  // Walk onto it: it must bank once and be gone.
  await page.evaluate(() => window.__lastRites!.teleport(0.3, -1.2))
  await until(page, () => (window.__lastRites!.snapshot('coins') as { piles: unknown[] }).piles.length === 0, null, 30_000)
  await page.waitForTimeout(1500)
  const p3 = await snap<{ coins: number; stats: { coinsEarned: number; kills: { shambler: number } } }>(page, 'progression')
  log(`item2 after collecting: banked=${p3.coins} coinsEarned=${p3.stats.coinsEarned}`)
  expect(p3.coins).toBe(2)
  expect(p3.stats.coinsEarned).toBe(2)
  expect(p3.stats.kills.shambler).toBe(2)
  expect((await snap<typeof p1>(page, 'progression')).stats.kills.shambler).toBe(2)
  expect(errors).toEqual([])
})

/**
 * The player stands inside the hut, so zombies queue at the door: separation keeps bodies 1 m
 * apart and a zombie behind the first stops just outside attack range. 2 m allows that queue, like
 * the crowding allowance in tests/zombieNavigation.test.ts; a stall (the old bug) is caught by
 * maxStuckFar. Was 1.5 m, which only held on slow SwiftShader frames.
 */
const REACH_M = 2

test('item 3: zombies reach a player standing still at the hut at night', async ({ page }) => {
  test.setTimeout(900_000)
  const errors = await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.teleport(0, 0)
    h.keepAlive(true)
    interface Track { min: number; anchor: { x: number; z: number }; anchorT: number; maxStuckFar: number; reachedT: number | null; first: { x: number; z: number } }
    const tracks: Record<string, Track> = {}
    const w = window as unknown as { __tracks: Record<string, Track> }
    w.__tracks = tracks
    // Once a second, with sim time taken from the night clock.
    setInterval(() => {
      const world = h.snapshot('world') as { phase: string; phaseTime: number }
      if (world.phase !== 'night') return
      const t = world.phaseTime
      const pl = (h.snapshot('player') as { position: number[] }).position
      for (const e of h.snapshot('enemies') as { uid: string; hp: number; state: string; pos: { x: number; z: number } }[]) {
        if (e.hp <= 0) continue
        const d = Math.hypot(e.pos.x - pl[0], e.pos.z - pl[2])
        let tr = tracks[e.uid]
        if (!tr) tr = tracks[e.uid] = { min: d, anchor: { ...e.pos }, anchorT: t, maxStuckFar: 0, reachedT: null, first: { ...e.pos } }
        tr.min = Math.min(tr.min, d)
        if (tr.reachedT === null && d <= 2) tr.reachedT = t // REACH_M; runs in the page, so a literal
        if (Math.hypot(e.pos.x - tr.anchor.x, e.pos.z - tr.anchor.z) > 0.5) {
          tr.anchor = { ...e.pos }
          tr.anchorT = t
        } else if (d > 3) {
          tr.maxStuckFar = Math.max(tr.maxStuckFar, t - tr.anchorT)
        }
      }
    }, 1000)
  })
  await page.evaluate(() => { const h = window.__lastRites!; h.skipToDusk(1) })
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'dusk', null)
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'night', null)

  const deadline = Date.now() + 600_000
  type Tracks = Record<string, { min: number; maxStuckFar: number; reachedT: number | null; first: { x: number; z: number } }>
  let tracks: Tracks = {}
  for (;;) {
    tracks = await page.evaluate(() => (window as unknown as { __tracks: Tracks }).__tracks)
    const all = Object.values(tracks)
    // Wave 1 is 4 Shamblers; the second wave only starts once the first is dead.
    if (all.length >= 4 && all.every((t) => t.reachedT !== null)) break
    if (all.some((t) => t.maxStuckFar > 20)) break
    if (Date.now() > deadline) break
    await page.waitForTimeout(1000)
  }
  const world = await snap<World>(page, 'world')
  log(`item3 night clock=${world.phaseTime.toFixed(1)}s tracks=${JSON.stringify(tracks)}`)
  const all = Object.values(tracks)
  expect(all.length).toBeGreaterThanOrEqual(4)
  for (const t of all) {
    expect(t.min).toBeLessThanOrEqual(REACH_M)
    expect(t.maxStuckFar).toBeLessThanOrEqual(20)
  }
  expect(errors).toEqual([])
})

test('item 4: New Game puts the revolver and axe back', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await boot(page)
  const meshes = () => page.evaluate(() => ({
    revolver: window.__lastRites!.meshesUnder('weapon-pickup:revolver'),
    axe: window.__lastRites!.meshesUnder('weapon-pickup:wood-axe'),
  }))
  const fresh = await meshes()
  expect(fresh.revolver).toBeGreaterThan(0)
  expect(fresh.axe).toBeGreaterThan(0)

  // takePickup is the function the pickup Interactables call.
  const took = await page.evaluate(() => [window.__lastRites!.takePickup('revolver'), window.__lastRites!.takePickup('wood-axe')])
  expect(took).toEqual([true, true])
  await until(page, () => (window.__lastRites!.snapshot('combat') as { takenPickups: string[] }).takenPickups.length === 2, null)
  const after = await snap<{ takenPickups: string[]; durability: Record<string, number>; firearms: Record<string, unknown> }>(page, 'combat')
  await until(page, () => window.__lastRites!.meshesUnder('weapon-pickup:revolver') <= 0, null, 30_000)
  const gone = await meshes()
  log(`item4 after pickup: taken=${after.takenPickups} durability=${JSON.stringify(after.durability)} firearms=${JSON.stringify(after.firearms)} meshes=${JSON.stringify(gone)}`)
  // Since 11c the group stays mounted and only the faded prop is removed, so 0 meshes (was -1).
  expect(gone.revolver).toBeLessThanOrEqual(0)
  expect(gone.axe).toBeLessThan(fresh.axe)
  expect(after.durability['wood-axe']).toBeGreaterThan(0)

  // New Game from the title, as the player does it.
  await page.evaluate(() => window.__lastRites!.setScreen('title'))
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await until(page, () => (window.__lastRites!.snapshot('game') as { screen: string }).screen === 'game', null)
  await until(page, () => window.__lastRites!.body() !== null, null, 90_000)
  await until(page, () => window.__lastRites!.meshesUnder('weapon-pickup:revolver') > 0, null, 60_000)
  const combat = await snap<{ takenPickups: string[]; durability: Record<string, number>; firearms: Record<string, unknown> }>(page, 'combat')
  const back = await meshes()
  const inv = await snap<{ inventory: { slots: { item: string }[] } }>(page, 'inventory')
  log(`item4 after New Game: taken=${JSON.stringify(combat.takenPickups)} durability=${JSON.stringify(combat.durability)} firearms=${JSON.stringify(combat.firearms)} meshes=${JSON.stringify(back)} satchel=${inv.inventory.slots.map((s) => s.item)}`)
  expect(combat.takenPickups).toEqual([])
  expect(combat.durability).toEqual({})
  expect(combat.firearms).toEqual({})
  expect(back).toEqual(fresh)
  expect(inv.inventory.slots.map((s) => s.item)).toEqual(['rusty-shovel'])
  // And they can be taken again.
  expect(await page.evaluate(() => window.__lastRites!.takePickup('revolver'))).toBe(true)
  expect(errors).toEqual([])
})

test('item 5: Retry Night and Continue move the real body', async ({ page }) => {
  test.setTimeout(600_000)
  const errors = await boot(page)
  const A = { x: 6, z: 4, yaw: 1.0 }
  const B = { x: -12, z: 10 }

  // Dusk position: stand at A, then let the real tick enter dusk (which snapshots the stores).
  await page.evaluate((a) => window.__lastRites!.teleport(a.x, a.z, { yaw: a.yaw }), A)
  await bodyAt(page, A.x, A.z)
  await page.evaluate(() => window.__lastRites!.skipToDusk(1))
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'dusk', null)
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await until(page, () => (window.__lastRites!.snapshot('world') as World).phase === 'night', null)

  // Move away (the body, not just the store), then die.
  await page.evaluate((b) => window.__lastRites!.teleport(b.x, b.z, { yaw: -2 }), B)
  await bodyAt(page, B.x, B.z)
  const moved = await body(page)
  await page.evaluate(() => window.__lastRites!.hurt(10_000))
  await until(page, () => (window.__lastRites!.snapshot('game') as { taken: boolean }).taken, null)
  await page.evaluate(() => window.__lastRites!.retryNight())
  await bodyAt(page, A.x, A.z)
  await page.waitForTimeout(1000)
  const retried = await body(page)
  const afterRetry = await snap<World>(page, 'world')
  const player = await snap<{ position: number[]; health: number }>(page, 'player')
  const game = await snap<{ taken: boolean }>(page, 'game')
  log(`item5 retry: movedTo=${JSON.stringify(moved?.feet)} backTo=${JSON.stringify(retried?.feet)} camera=${JSON.stringify(retried?.camera)} ` +
    `camYaw=${retried?.yaw.toFixed(2)} phase=${afterRetry.phase} store=${JSON.stringify(player.position)} hp=${player.health} taken=${game.taken}`)
  expect(Math.hypot(moved!.feet[0] - A.x, moved!.feet[2] - A.z)).toBeGreaterThan(10)
  expect(Math.hypot(retried!.feet[0] - A.x, retried!.feet[2] - A.z)).toBeLessThan(0.3)
  expect(Math.hypot(retried!.camera[0] - A.x, retried!.camera[2] - A.z)).toBeLessThan(0.3)
  expect(retried!.yaw).toBeCloseTo(A.yaw, 1)
  expect(afterRetry.phase).toBe('dusk')
  expect(game.taken).toBe(false)
  expect(player.health).toBeGreaterThan(0)

  // Continue: save at C, wander off, then continue in place and again from the title screen.
  const C = { x: 9, z: -6, yaw: 0.5 }
  await page.evaluate((c) => window.__lastRites!.teleport(c.x, c.z, { yaw: c.yaw }), C)
  await bodyAt(page, C.x, C.z)
  expect(await page.evaluate(() => window.__lastRites!.saveGame())).toBe(true)
  await page.evaluate((b) => window.__lastRites!.teleport(b.x, b.z), { x: -20, z: -8 })
  await bodyAt(page, -20, -8)
  expect(await page.evaluate(() => window.__lastRites!.continueGame())).toBe(true)
  await bodyAt(page, C.x, C.z)
  const cont = await body(page)
  log(`item5 continue in place: body=${JSON.stringify(cont?.feet)} camera=${JSON.stringify(cont?.camera)}`)
  expect(Math.hypot(cont!.camera[0] - C.x, cont!.camera[2] - C.z)).toBeLessThan(0.3)

  await page.evaluate((b) => window.__lastRites!.teleport(b.x, b.z), { x: -20, z: -8 })
  await bodyAt(page, -20, -8)
  await page.evaluate(() => window.__lastRites!.setScreen('title'))
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => window.__lastRites!.continueGame())).toBe(true)
  await until(page, () => window.__lastRites!.body() !== null, null, 90_000)
  await bodyAt(page, C.x, C.z, 0.3, 90_000)
  const cont2 = await body(page)
  log(`item5 continue from title: body=${JSON.stringify(cont2?.feet)} camera=${JSON.stringify(cont2?.camera)}`)
  expect(Math.hypot(cont2!.feet[0] - C.x, cont2!.feet[2] - C.z)).toBeLessThan(0.3)
  expect(Math.hypot(cont2!.camera[0] - C.x, cont2!.camera[2] - C.z)).toBeLessThan(0.3)
  expect(errors).toEqual([])
})

test('item 6: materials return on day 2 and dug-grave loot stays', async ({ page }) => {
  test.setTimeout(1_200_000)
  const errors = await boot(page)
  type SpawnSnap = { world: { materials: Record<string, { item: string; qty: number }[]>; collectedFixed: string[] } }
  const day1 = await snap<SpawnSnap>(page, 'spawn')
  const isGrave = (id: string) => id.startsWith('grave-')

  // Take every stack at four ordinary spawn points.
  const picked = Object.entries(day1.world.materials)
    .filter(([id, s]) => !isGrave(id) && s.length > 0)
    .map(([id]) => id)
    .slice(0, 4)
  expect(picked.length).toBe(4)
  for (const id of picked) {
    for (let i = 0; i < day1.world.materials[id].length; i++) {
      await page.evaluate((a) => window.__lastRites!.collectMaterial(a.id, 0), { id })
    }
  }
  const afterPick = await snap<SpawnSnap>(page, 'spawn')
  for (const id of picked) expect(afterPick.world.materials[id]).toEqual([])
  const held = await snap<{ inventory: { slots: { item: string; qty: number }[] } }>(page, 'inventory')

  // Dig a grave for real: stand 1.5 m south of the mound looking at it and hold Interact.
  const GRAVE = { id: 'grave-oak-hollow', x: -15, z: 12 }
  await page.evaluate((g) => {
    const h = window.__lastRites!
    h.equip(0)
    h.teleport(g.x, g.z + 1.5, { yaw: 0, pitch: -0.8 })
  }, GRAVE)
  await bodyAt(page, GRAVE.x, GRAVE.z + 1.5)
  await until(page, (g) => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id === `dig:${g.id}`, GRAVE, 30_000)
  await page.evaluate(() => window.__lastRites!.hold('Interact'))
  await until(page, (g) => (window.__lastRites!.snapshot('spawn') as SpawnSnap).world.materials[g.id]?.length > 0, GRAVE, 120_000)
  await page.evaluate(() => window.__lastRites!.release('Interact'))
  const dug = (await snap<SpawnSnap>(page, 'spawn')).world.materials[GRAVE.id]
  const digs = (await snap<{ stats: { digs: number } }>(page, 'progression')).stats.digs
  log(`item6 day1: picked=${picked.join(',')} satchel=${held.inventory.slots.map((s) => `${s.item}x${s.qty}`).join(' ')} dugLoot=${JSON.stringify(dug)} digs=${digs}`)
  expect(digs).toBe(1)

  // Night 1, then dawn and the real change to day 2.
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  const r = await playNight(page, 1, 2)
  expect(r.violations).toEqual([])
  const day2 = await snap<SpawnSnap>(page, 'spawn')
  const world = await snap<World>(page, 'world')
  log(`item6 day2: night=${world.nightNumber} phase=${world.phase} returned=${picked.map((id) => `${id}:${JSON.stringify(day2.world.materials[id])}`).join(' ')} dugLoot=${JSON.stringify(day2.world.materials[GRAVE.id])}`)
  expect(world).toMatchObject({ phase: 'day', nightNumber: 2 })
  for (const id of picked) expect(day2.world.materials[id].length).toBeGreaterThan(0)
  expect(day2.world.materials[GRAVE.id]).toEqual(dug)
  expect(errors).toEqual([])
})
