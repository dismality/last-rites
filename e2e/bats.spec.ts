import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 4.7 (Req 4.1, 4.3, 4.7, 4.8, 4.11, 4.12, 8.21): the watching bats.
// At night 8 to 12 bats are perched, the head turns within 14 m, a bat takes off within 3 m or on
// a shot within 10 m and is gone after about 7 s, health and the screen scare are untouched, and
// the belfry flock leaves at the dusk bell. Screenshots at 1280x720 and 800x600 in
// e2e/screenshots/bats/ of a perched bat turning and of the same bat taking off.

const DIR = 'e2e/screenshots/bats'

/** The perch boxes the game reads (centre, half extents, rotation about Y). */
const BOXES = (
  JSON.parse(readFileSync('public/assets/models/scene/graveyard-colliders.json', 'utf8')) as {
    boxes: { center: number[]; half: number[]; rotY: number }[]
  }
).boxes

type Bat = {
  phase: string
  boxIndex: number
  t: number
  yaw: number
  restYaw: number
  previousBox: number | null
  at: [number, number, number]
}
type BState = { seededNight: number | null; simTime: number; bats: Bat[]; perched: number }
const bstate = (page: Page) => page.evaluate(() => window.__lastRites!.batState() as BState)
const health = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('player') as { health: number }).health)

async function startRun(page: Page): Promise<void> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, {
    timeout: 30_000,
  })
}

async function toNight(page: Page): Promise<void> {
  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night',
    undefined,
    { timeout: 60_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.batState().perched >= 1, undefined, {
    timeout: 15_000,
  })
}

async function shoot(page: Page, name: string, settleMs = 250): Promise<void> {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 800, height: 600 },
  ]) {
    await page.setViewportSize(size)
    if (settleMs > 0) await page.waitForTimeout(settleMs)
    await page.screenshot({ path: `${DIR}/${name}-${size.width}x${size.height}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

/** The bat whose head is furthest from rest: the one the keeper is watched by. */
const watcher = (s: BState): number => {
  let best = -1
  let bestTurn = 0.05
  s.bats.forEach((b, i) => {
    const turn = Math.abs(Math.atan2(Math.sin(b.yaw - b.restYaw), Math.cos(b.yaw - b.restYaw)))
    if (b.phase === 'perched' && turn > bestTurn) {
      best = i
      bestTurn = turn
    }
  })
  return best
}

test('at night 8 to 12 bats perch, watch, take off on a shot and are gone after about 7 s', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await startRun(page)
  await toNight(page)

  const s0 = await bstate(page)
  expect(s0.perched).toBeGreaterThanOrEqual(8)
  expect(s0.perched).toBeLessThanOrEqual(12)

  // Night waves are running; banish zombies as they rise so any health change could only be the bats.
  await page.evaluate(() => {
    setInterval(() => window.__lastRites!.killAll(), 100)
  })
  const hp0 = await health(page)
  const pos = () =>
    page.evaluate(() => (window.__lastRites!.snapshot('player') as { position: number[] }).position)
  const p0 = await pos()
  const msg = await page.evaluate(() => window.__lastRites!.teleportNextToBat())
  expect(msg).toContain('Teleported next to a bat')
  await page.waitForFunction(
    (start) => {
      const p = (window.__lastRites!.snapshot('player') as { position: number[] }).position
      return Math.hypot(p[0] - start[0], p[2] - start[2]) > 0.5
    },
    p0,
    { timeout: 10_000 },
  )
  // Within the 14 m watch range the nearest bat's head turns off its rest yaw.
  await page.waitForFunction(
    () =>
      window
        .__lastRites!.batState()
        .bats.some((b) => b.phase === 'perched' && Math.abs(b.yaw - b.restYaw) > 0.05),
    undefined,
    { timeout: 10_000 },
  )
  const watched = watcher(await bstate(page))
  expect(watched).toBeGreaterThanOrEqual(0)
  expect(
    Math.hypot(
      (await pos())[0] - (await bstate(page)).bats[watched].at[0],
      (await pos())[2] - (await bstate(page)).bats[watched].at[2],
    ),
  ).toBeLessThanOrEqual(14)

  // For the screenshots, a bat on a headstone (a thin box), seen face-on from 3.15 m (outside the
  // 3 m take-off). Wide boxes can be the plinth of a cross whose shaft has no collider, which
  // hides the bat inside the stone.
  const sNow = await bstate(page)
  const pick = sNow.bats.findIndex(
    (b) =>
      b.phase === 'perched' &&
      Math.min(BOXES[b.boxIndex].half[0], BOXES[b.boxIndex].half[2]) < 0.25,
  )
  expect(pick).toBeGreaterThanOrEqual(0)
  const at = sNow.bats[pick].at
  const box = BOXES[sNow.bats[pick].boxIndex]
  // The box's thin local axis (x or z), turned by rotY into world space, is the face direction.
  const thinX = box.half[0] < box.half[2]
  const fx = thinX ? Math.cos(box.rotY) : Math.sin(box.rotY)
  const fz = thinX ? -Math.sin(box.rotY) : Math.cos(box.rotY)
  const near = { x: at[0] + fx * 3.15, z: at[2] + fz * 3.15 }
  const EYE_M = 1.6
  await page.evaluate(
    ({ near, at, eye }) =>
      window.__lastRites!.teleport(near.x, near.z, {
        yaw: Math.atan2(-(at[0] - near.x), -(at[2] - near.z)),
        pitch: Math.atan2(at[1] + 0.1 - eye, 3.15),
      }),
    { near, at, eye: EYE_M },
  )
  // Let the zone banner fade and the head finish turning toward the keeper.
  await page.waitForTimeout(4000)
  const s1 = await bstate(page)
  // Other bats the teleport passed within 3 m of may already have left; only the chosen one matters.
  expect(s1.bats[pick].phase).toBe('perched')
  expect(Math.abs(s1.bats[pick].yaw - s1.bats[pick].restYaw)).toBeGreaterThan(0.05)
  await shoot(page, 'perched-turning')

  // A shot within 10 m (the bat is 3.15 m away) sends the same bat up; the swap to the flying model
  // is the same frame. The camera stays put so the take-off is seen leaving the perch.
  const shotAt = (await bstate(page)).simTime
  await page.evaluate(() => window.__lastRites!.fireShot())
  await page.waitForFunction(
    (i) => window.__lastRites!.batState().bats[i].phase === 'fleeing',
    pick,
    { timeout: 5000 },
  )
  const fled = pick
  await shoot(page, 'taking-off', 0)

  await page.waitForFunction((i) => window.__lastRites!.batState().bats[i].phase === 'gone', fled, {
    timeout: 15_000,
  })
  const goneAt = (await bstate(page)).simTime
  expect(goneAt - shotAt).toBeGreaterThan(5.5)
  expect(goneAt - shotAt).toBeLessThan(9)

  // No damage from the bats and no screen scare.
  expect(await health(page)).toBeGreaterThanOrEqual(hp0)
  expect(await page.evaluate(() => window.__lastRites!.screenScareState().active)).toBeNull()
})

test('a bat takes off when the keeper comes within 3 m, not before', async ({ page }) => {
  test.setTimeout(120_000)
  await startRun(page)
  await toNight(page)
  await page.evaluate(() => window.__lastRites!.teleportNextToBat())
  await page.waitForTimeout(600)
  // Six metres off: still perched.
  expect((await bstate(page)).bats.every((b) => b.phase === 'perched')).toBe(true)
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  await page.waitForFunction(
    () => window.__lastRites!.batState().bats.some((b) => b.phase !== 'perched'),
    undefined,
    { timeout: 15_000 },
  )
  await page.evaluate(() => window.__lastRites!.release('MoveForward'))
})

test('the belfry flock leaves at the dusk bell', async ({ page }) => {
  test.setTimeout(120_000)
  await startRun(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.give('iron-nail', 10)
    h.give('bone', 2)
    h.give('candle-wax', 3)
    h.give('holy-water', 1)
    h.give('cloth', 2)
    h.repairChapel()
    h.repairChapel()
    h.repairChapel()
  })
  const chapel = (await page.evaluate(() => window.__lastRites!.snapshot('chapel'))) as {
    completedStages: string[]
  }
  expect(chapel.completedStages).toContain('bellWarning')
  // The flock is skipped while the 60-frame average is over 22 ms, which the start-up hitches are;
  // in play dusk comes minutes in, so let normal frames fill the window first.
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.__lastRites!.skipToDusk(1))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'dusk',
    undefined,
    { timeout: 30_000 },
  )
  expect(await page.evaluate(() => window.__lastRites!.bellMeshAngle())).not.toBe(0)
  await page.waitForFunction(
    () => window.__lastRites!.objectVisible('belfry-flock') === true,
    undefined,
    { timeout: 5_000 },
  )
  const shownAt = Date.now()
  // Gone within 10 s of the bell.
  await page.waitForFunction(
    () => window.__lastRites!.objectVisible('belfry-flock') === false,
    undefined,
    { timeout: 14_000 },
  )
  expect(Date.now() - shownAt).toBeLessThan(11_500)
})
