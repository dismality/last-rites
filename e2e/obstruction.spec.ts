import { expect, test, type Page } from '@playwright/test'

// Task 12.4: "blocked by something invisible among the headstones" near the Rusted Crypt Key.
// The cause was the grounds-oak-path scare-zone sensor (an 8 x 10 m box, x -16..-8, z -22..-12)
// that the player's character controller treated as solid. These specs walk into the key at
// (-12, -18) and page 2 at (-12.5, -17) from eight directions with real WASD input (the Rapier
// controller moves the body, no teleporting except to the start point), then pick both up through
// the real Interact path. Headless Chrome runs WebGL on SwiftShader, so speed is not representative.

const KEY = { id: 'rusted-crypt-key', spawn: 'fx-crypt-key', x: -12, z: -18 }
const PAGE2 = { id: 'journal-page-2', spawn: 'fx-page-2', x: -12.5, z: -17 }
const START_M = 9
const DIRS: ReadonlyArray<readonly [string, number, number]> = [
  ['N', 0, -1],
  ['NE', Math.SQRT1_2, -Math.SQRT1_2],
  ['E', 1, 0],
  ['SE', Math.SQRT1_2, Math.SQRT1_2],
  ['S', 0, 1],
  ['SW', -Math.SQRT1_2, Math.SQRT1_2],
  ['W', -1, 0],
  ['NW', -Math.SQRT1_2, -Math.SQRT1_2],
]

interface WalkResult {
  feet: [number, number, number]
  dist: number
  stuckFor: number
  /** Solid (non-sensor) colliders within 1.5 m of where the body stopped. */
  near: Array<{ owner: string; distance: number }>
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 90_000 })
}

/** Teleports to the start, faces the target and holds W until arrival, a 3 s stall or 60 s. */
async function walkIn(
  page: Page,
  target: { x: number; z: number },
  dir: readonly [string, number, number],
): Promise<WalkResult> {
  return page.evaluate(
    async ([tx, tz, dx, dz, start]) => {
      const h = window.__lastRites!
      const sx = tx + dx * start
      const sz = tz + dz * start
      h.teleport(sx, sz, { yaw: Math.atan2(-(tx - sx), -(tz - sz)) })
      // The teleport is applied on the next frame; give the sim a moment to settle.
      await new Promise((r) => setTimeout(r, 1500))
      h.hold('MoveForward')
      const t0 = performance.now()
      let feet = h.body()!.feet
      let mark = { t: t0, x: feet[0], z: feet[2] }
      let stuckFor = 0
      while (performance.now() - t0 < 60_000) {
        await new Promise((r) => setTimeout(r, 100))
        feet = h.body()!.feet
        if (Math.hypot(feet[0] - tx, feet[2] - tz) < 0.9) break
        if (Math.hypot(feet[0] - mark.x, feet[2] - mark.z) > 0.1) mark = { t: performance.now(), x: feet[0], z: feet[2] }
        stuckFor = (performance.now() - mark.t) / 1000
        if (stuckFor > 3) break
      }
      h.release('MoveForward')
      return {
        feet,
        dist: Math.hypot(feet[0] - tx, feet[2] - tz),
        stuckFor,
        near: h
          .collidersNear(feet[0], feet[2], 1.5)
          .filter((c) => !c.sensor && c.owner !== 'player' && c.halfExtents && c.halfExtents[0] < 20 && c.halfExtents[2] < 20)
          .map((c) => ({ owner: c.owner, distance: c.distance })),
      } as WalkResult
    },
    [target.x, target.z, dir[1], dir[2], START_M] as const,
  )
}

/** Turns with the mouse (real input path) until the crosshair is on the item, then presses Interact. */
async function lookAtAndInteract(
  page: Page,
  target: { x: number; z: number; spawn: string },
): Promise<{ hover: unknown }> {
  return page.evaluate(async ([spawnId]) => {
    const h = window.__lastRites!
    // Aim at the middle of the item's real mesh, as a player centres the crosshair on it.
    const [tx, ty, tz] = h.interactableCentre(`fixed:${spawnId}`) ?? [0, 0.05, 0]
    const K = 0.0022 // radians per pixel at sensitivity 1.0 (src/game/systems/movement.ts)
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
    for (let i = 0; i < 80; i++) {
      const b = h.body()!
      const pitch = (h.snapshot('player') as { pitch: number }).pitch
      const wantYaw = Math.atan2(-(tx - b.feet[0]), -(tz - b.feet[2]))
      const wantPitch = Math.atan2(ty - b.camera[1], Math.hypot(tx - b.feet[0], tz - b.feet[2]))
      const eYaw = wrap(b.yaw - wantYaw)
      const ePitch = pitch - wantPitch
      if (Math.abs(eYaw) < 0.01 && Math.abs(ePitch) < 0.01) break
      const clamp = (v: number) => Math.max(-60, Math.min(60, v))
      h.input.mouseMove(clamp(eYaw / K), clamp(ePitch / K))
      await wait(60)
    }
    await wait(300)
    // The crosshair must sit on the item's real mesh (a small thing lying on the ground), so nudge
    // the mouse in a small grid the way a player would until the prompt appears.
    const onItem = () => (h.snapshot('hover') as { id: string } | null)?.id?.startsWith('fixed:') === true
    const nudges: Array<[number, number]> = [[0, 0]]
    for (const r of [6, 12, 18, 24]) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) nudges.push([a * r, b * r])
    let at: [number, number] = [0, 0]
    for (const [nx, ny] of nudges) {
      h.input.mouseMove(nx - at[0], ny - at[1])
      at = [nx, ny]
      await wait(250)
      if (onItem()) break
    }
    const hover = h.snapshot('hover')
    // Hold E across at least one rendered frame (SwiftShader frames are slow), until the spawn is taken.
    h.hold('Interact')
    for (let i = 0; i < 40; i++) {
      await wait(100)
      const w = h.snapshot('spawn') as { world: { collectedFixed: string[] } }
      if (w.world.collectedFixed.length > 0) break
    }
    h.release('Interact')
    return { hover }
  }, [target.spawn] as const)
}

const keyItems = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('inventory') as { inventory: { keyItems: string[] } }).inventory.keyItems)

test.describe('walking in to the Rusted Crypt Key and page 2', () => {
  test.setTimeout(900_000)

  for (const [name, target] of [
    ['Rusted Crypt Key', KEY],
    ['journal page 2', PAGE2],
  ] as const) {
    test(`reaches ${name} from eight directions`, async ({ page }) => {
      await startGame(page)
      for (const dir of DIRS) {
        const r = await walkIn(page, target, dir)
        console.log(`${name} from ${dir[0]}: stopped at ${r.feet.map((n) => n.toFixed(2)).join(', ')}, ${r.dist.toFixed(2)} m away, stalled ${r.stuckFor.toFixed(1)} s, near ${r.near.map((n) => `${n.owner}@${n.distance.toFixed(2)}`).join(' ') || 'nothing solid'}`)
        // Within pickup reach (interact range 2.5 m, the item lies on the ground).
        expect(r.dist, `${name} from ${dir[0]}`).toBeLessThanOrEqual(1.6)
      }
    })
  }

  test('picks both up through the real Interact path from four directions', async ({ page }) => {
    for (const dir of DIRS.filter((_, i) => i % 2 === 0)) {
      for (const target of [KEY, PAGE2]) {
        // A fresh page per attempt: restarting a run remounts the rig and races the body handle.
        await startGame(page)
        expect(await keyItems(page)).not.toContain(target.id)
        const r = await walkIn(page, target, dir)
        expect(r.dist, `${target.id} from ${dir[0]}`).toBeLessThanOrEqual(1.6)
        const { hover } = await lookAtAndInteract(page, target)
        // Interact collects the spawn and opens the examine card; closing it files the item.
        const spawn = (await page.evaluate(() => window.__lastRites!.snapshot('spawn'))) as {
          world: { collectedFixed: string[] }
        }
        expect(spawn.world.collectedFixed, `${target.id} from ${dir[0]} (hover ${JSON.stringify(hover)}, stopped ${r.feet.map((n) => n.toFixed(2))})`).toContain(target.spawn)
        await page.keyboard.press('Escape')
        await page.waitForFunction((id) => (window.__lastRites!.snapshot('inventory') as { inventory: { keyItems: string[] } }).inventory.keyItems.includes(id), target.id)
        const items = await keyItems(page)
        console.log(`${target.id} from ${dir[0]}: hover ${JSON.stringify(hover)}, key items ${items.join(',')}`)
        expect(items, `${target.id} from ${dir[0]}`).toContain(target.id)
      }
    }
  })
})
