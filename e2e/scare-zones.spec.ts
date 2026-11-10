import { test, expect, type Page } from '@playwright/test'
import { SCARE_ZONES } from '../src/data/scares'

// Spec 09, B1: walk (held movement keys, never a teleport into the zone) into every scare zone.
// Before the fix the character controller treated the sensors as walls, so the body stopped at
// the zone's edge and none of these could pass.

type Vec2 = { x: number; z: number }

const OUTSIDE_M = 1.5
const WALK_TIMEOUT_MS = 10_000

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.startRun('normal')
    // Gate keys, so a locked gate never stands in for a sensor in this test.
    h.give('rusted-crypt-key')
    h.give('bone-whistle')
    h.give('iron-ossuary-key')
  })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null)
}

/** Points just outside each face of the zone, in the middle of that face. */
function approaches(min: readonly number[], max: readonly number[]): Vec2[] {
  const cx = (min[0] + max[0]) / 2
  const cz = (min[2] + max[2]) / 2
  return [
    { x: cx, z: max[2] + OUTSIDE_M },
    { x: cx, z: min[2] - OUTSIDE_M },
    { x: max[0] + OUTSIDE_M, z: cz },
    { x: min[0] - OUTSIDE_M, z: cz },
  ]
}

function inside(p: readonly number[], min: readonly number[], max: readonly number[]): boolean {
  return p[0] > min[0] && p[0] < max[0] && p[2] > min[2] && p[2] < max[2]
}

/** Teleports to `from`, faces the zone centre and holds Move forward until the body is inside. */
async function walkIn(page: Page, from: Vec2, centre: Vec2, min: number[], max: number[]): Promise<boolean> {
  // forward is (-sin yaw, -cos yaw), see movement.ts
  const yaw = Math.atan2(-(centre.x - from.x), -(centre.z - from.z))
  await page.evaluate(({ from, yaw }) => window.__lastRites!.teleport(from.x, from.z, { yaw }), { from, yaw })
  await page.waitForFunction(
    ({ from }) => {
      const b = window.__lastRites!.body()
      return b !== null && Math.hypot(b.feet[0] - from.x, b.feet[2] - from.z) < 0.3
    },
    { from },
  )
  await page.evaluate(() => window.__lastRites!.hold('MoveForward'))
  try {
    await page.waitForFunction(
      ({ min, max }) => {
        const b = window.__lastRites!.body()
        if (!b) return false
        const f = b.feet
        return f[0] > min[0] && f[0] < max[0] && f[2] > min[2] && f[2] < max[2]
      },
      { min, max },
      { timeout: WALK_TIMEOUT_MS },
    )
    return true
  } catch {
    return false
  } finally {
    await page.evaluate(() => window.__lastRites!.release('MoveForward'))
  }
}

test('the player can walk into every scare zone and its sensor fires', async ({ page }) => {
  test.setTimeout(300_000)
  await boot(page)

  const failed: string[] = []
  for (const zone of SCARE_ZONES) {
    const min = [...zone.bounds.min]
    const max = [...zone.bounds.max]
    const centre = { x: (min[0] + max[0]) / 2, z: (min[2] + max[2]) / 2 }
    let entered = false
    // One open side is enough: walls may close the others (the alleys are 3 m wide).
    for (const from of approaches(min, max)) {
      if (!(await walkIn(page, from, centre, min, max))) continue
      const ok = await page
        .waitForFunction(
          (id) => {
            const z = window.__lastRites!.scareZones()
            return z.inside.includes(id) && z.entered.includes(id)
          },
          zone.id,
          { timeout: 3_000 },
        )
        .then(() => true)
        .catch(() => false)
      if (ok) {
        entered = true
        break
      }
    }
    if (!entered) failed.push(zone.id)
    const feet = (await page.evaluate(() => window.__lastRites!.body()))!.feet
    console.log(`${zone.id}: ${entered ? 'entered' : 'NOT entered'} (feet ${feet.map((v) => v.toFixed(2)).join(', ')}, inside ${inside(feet, min, max)})`)
  }
  expect(failed).toEqual([])
})

