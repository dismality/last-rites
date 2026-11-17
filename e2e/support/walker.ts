// Real-input movement for the full playthrough (spec 10 task 12). Everything the keeper does goes
// through `page.keyboard` and `page.mouse`: W (and Shift) to walk, mouse movement to turn and look,
// E to use. The debug hook is only READ: the body's position and look, the hovered target, the
// interactable centres and the physics colliders (to plan a route around tombstones and walls).
//
// Route planning: the static colliders are rasterised into a 0.35 m occupancy grid at body height,
// grown by the keeper's radius, and A* finds a path that is then straightened by line of sight.
// The walk steers toward each corner with mouse movement and replans when it stalls.

import { expect, type Page } from '@playwright/test'

export interface P2 {
  x: number
  z: number
}

interface Collider {
  shape: string
  halfExtents: [number, number, number] | null
  radius: number | null
  translation: [number, number, number]
  rotationY: number
  sensor: boolean
  owner: string
}

interface Body {
  feet: [number, number, number]
  camera: [number, number, number]
  yaw: number
  pitch: number
}

const CELL = 0.35
/** The keeper's capsule is 0.35 m; plan with a little room, and squeeze through doors when needed. */
const KEEPER_R = 0.4
const SQUEEZE_R = 0.34
const MIN = { x: -75, z: -85 }
const COLS = Math.ceil(150 / CELL)
const ROWS = Math.ceil(170 / CELL)
/** Radians of yaw per pixel of mouse movement at the default sensitivity (measured; refined live). */
let radPerPx = -0.0022
/**
 * Where the real cursor is. While the pointer is locked the mouse is never re-centred: movement is
 * relative, so x and y simply grow. The 2D screens (cursor free) move it back with `setMouse`.
 */
const mouse = { x: 640, y: 360 }
/** Keep every look event under the game's spike filter (400 px; see lookFilter.ts). */
const MAX_STEP_PX = 150

/** Moves the real cursor (used while it is free, on menus and overlays). */
export async function moveMouse(page: Page, x: number, y: number): Promise<void> {
  mouse.x = x
  mouse.y = y
  await page.mouse.move(x, y)
}
export const mousePos = () => ({ ...mouse })

export const body = (page: Page): Promise<Body> => page.evaluate(() => window.__lastRites!.body() as Body)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
/** Yaw that faces (tx, tz) from (x, z); forward is (-sin yaw, -cos yaw). */
export const yawTo = (from: P2, to: P2) => Math.atan2(-(to.x - from.x), -(to.z - from.z))

export const log = (msg: string) => console.log(`[walk] ${msg}`)

/** Waits for `n` rendered frames. */
export function frames(page: Page, n: number): Promise<void> {
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

/** Turns the view by mouse movement until it faces `yaw` (and `pitch` when given). */
export async function look(page: Page, yaw: number, pitch?: number): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const b = await body(page)
    const ey = wrap(yaw - b.yaw)
    const ep = pitch === undefined ? 0 : pitch - b.pitch
    if (Math.abs(ey) < 0.03 && Math.abs(ep) < 0.03) return
    const dx = Math.max(-900, Math.min(900, ey / radPerPx))
    const dy = Math.max(-600, Math.min(600, ep / radPerPx))
    mouse.x += dx
    mouse.y += dy
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP_PX))
    await page.mouse.move(mouse.x, mouse.y, { steps })
    await frames(page, 2)
    const a = await body(page)
    // Refine the scale from what really happened (pointer acceleration is off in Chrome's CDP).
    const got = wrap(a.yaw - b.yaw)
    if (Math.abs(dx) > 40 && Math.abs(got) > 0.02) radPerPx = 0.7 * radPerPx + 0.3 * (got / dx)
  }
}

// ---------------------------------------------------------------------------
// Occupancy grid
// ---------------------------------------------------------------------------

export class Grid {
  readonly blocked = new Uint8Array(COLS * ROWS)
  idx(c: number, r: number) {
    return r * COLS + c
  }
  cellOf(p: P2): [number, number] {
    return [Math.floor((p.x - MIN.x) / CELL), Math.floor((p.z - MIN.z) / CELL)]
  }
  centre(c: number, r: number): P2 {
    return { x: MIN.x + (c + 0.5) * CELL, z: MIN.z + (r + 0.5) * CELL }
  }
  inside(c: number, r: number) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS
  }
  isBlocked(c: number, r: number) {
    return !this.inside(c, r) || this.blocked[this.idx(c, r)] === 1
  }
  /** Line of sight between two points over free cells. */
  clear(a: P2, b: P2): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 2))
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n
      const [c, r] = this.cellOf({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      if (this.isBlocked(c, r)) return false
    }
    return true
  }
  /** Nearest free cell to a point, searching outward. */
  nearestFree(p: P2): [number, number] | null {
    const [c0, r0] = this.cellOf(p)
    for (let rad = 0; rad < 30; rad++) {
      let best: [number, number] | null = null
      let bestD = Infinity
      for (let dc = -rad; dc <= rad; dc++)
        for (let dr = -rad; dr <= rad; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue
          const c = c0 + dc
          const r = r0 + dr
          if (this.isBlocked(c, r)) continue
          const q = this.centre(c, r)
          const d = Math.hypot(q.x - p.x, q.z - p.z)
          if (d < bestD) {
            bestD = d
            best = [c, r]
          }
        }
      if (best) return best
    }
    return null
  }
}

/** Rasterises the static colliders that stand at body height around the keeper's floor level. */
export async function buildGrid(page: Page, ignoreNear: P2[] = [], keeperR = KEEPER_R): Promise<Grid> {
  const cols = (await page.evaluate(() => window.__lastRites!.collidersNear(0, 0, 400))) as Collider[]
  const feetY = (await body(page)).feet[1]
  const lo = feetY + 0.3
  const hi = feetY + 1.6
  const g = new Grid()
  for (const k of cols) {
    if (k.sensor || k.owner === 'player') continue
    const [tx, ty, tz] = k.translation
    let r: number
    let span: [number, number]
    let rect: { hx: number; hz: number; rot: number } | null = null
    if (k.halfExtents) {
      const [hx, hy, hz] = k.halfExtents
      span = [ty - hy, ty + hy]
      rect = { hx: hx + keeperR, hz: hz + keeperR, rot: k.rotationY }
      r = Math.hypot(rect.hx, rect.hz)
    } else if (k.radius !== null) {
      // Balls are round; capsules and cylinders (Rapier shape 10) stand upright, about body tall.
      const hh = k.shape === 'ball' ? 0 : 1
      span = [ty - hh - k.radius, ty + hh + k.radius]
      r = k.radius + keeperR
    } else continue
    if (span[1] < lo || span[0] > hi) continue
    // Moving bodies (zombies) and things the caller is walking into are not walls.
    if (ignoreNear.some((p) => Math.hypot(p.x - tx, p.z - tz) < 0.8)) continue
    const [c0, r0] = g.cellOf({ x: tx - r, z: tz - r })
    const [c1, r1] = g.cellOf({ x: tx + r, z: tz + r })
    const cos = Math.cos(-k.rotationY)
    const sin = Math.sin(-k.rotationY)
    for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++)
      for (let rr = Math.max(0, r0); rr <= Math.min(ROWS - 1, r1); rr++) {
        const p = g.centre(c, rr)
        const dx = p.x - tx
        const dz = p.z - tz
        let hit: boolean
        if (rect) {
          // Into the box's frame (Rapier yaw is about +Y).
          const lx = dx * cos + dz * sin
          const lz = -dx * sin + dz * cos
          hit = Math.abs(lx) <= rect.hx && Math.abs(lz) <= rect.hz
        } else hit = Math.hypot(dx, dz) <= r
        if (hit) g.blocked[g.idx(c, rr)] = 1
      }
  }
  return g
}

/** A* over the grid (8-connected), then straightened by line of sight. */
export function plan(g: Grid, from: P2, to: P2): P2[] | null {
  const s = g.nearestFree(from)
  const t = g.nearestFree(to)
  if (!s || !t) return null
  const start = g.idx(s[0], s[1])
  const goal = g.idx(t[0], t[1])
  const gScore = new Float32Array(COLS * ROWS).fill(Infinity)
  const came = new Int32Array(COLS * ROWS).fill(-1)
  const closed = new Uint8Array(COLS * ROWS)
  // Binary heap of [f, idx].
  const heap: [number, number][] = []
  const push = (f: number, i: number) => {
    heap.push([f, i])
    let k = heap.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heap[p][0] <= heap[k][0]) break
      ;[heap[p], heap[k]] = [heap[k], heap[p]]
      k = p
    }
  }
  const pop = (): number => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = 2 * k + 1
        const r = l + 1
        let m = k
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === k) break
        ;[heap[m], heap[k]] = [heap[k], heap[m]]
        k = m
      }
    }
    return top[1]
  }
  const h = (i: number) => {
    const dc = Math.abs((i % COLS) - t[0])
    const dr = Math.abs(Math.floor(i / COLS) - t[1])
    return Math.max(dc, dr) + 0.414 * Math.min(dc, dr)
  }
  gScore[start] = 0
  push(h(start), start)
  while (heap.length > 0) {
    const cur = pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    const c = cur % COLS
    const r = Math.floor(cur / COLS)
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue
        const nc = c + dc
        const nr = r + dr
        if (g.isBlocked(nc, nr)) continue
        // No corner cutting.
        if (dc !== 0 && dr !== 0 && (g.isBlocked(c + dc, r) || g.isBlocked(c, r + dr))) continue
        const ni = g.idx(nc, nr)
        const ng = gScore[cur] + (dc !== 0 && dr !== 0 ? 1.414 : 1)
        if (ng < gScore[ni]) {
          gScore[ni] = ng
          came[ni] = cur
          push(ng + h(ni), ni)
        }
      }
  }
  if (came[goal] === -1 && goal !== start) return null
  const cells: P2[] = []
  for (let i = goal; i !== -1; i = came[i]) cells.push(g.centre(i % COLS, Math.floor(i / COLS)))
  cells.reverse()
  // String-pull.
  const out: P2[] = []
  let anchor = from
  let k = 0
  while (k < cells.length) {
    let far = k
    for (let j = cells.length - 1; j > k; j--) {
      if (g.clear(anchor, cells[j])) {
        far = j
        break
      }
    }
    out.push(cells[far])
    anchor = cells[far]
    k = far + 1
  }
  return out
}

/**
 * Walks to `to` with held W (and Shift when `sprint`), steering with the mouse. Ends within
 * `arrive` metres. Replans on a stall (zombies and doors move); throws after `timeoutMs`.
 */
export async function walkTo(
  page: Page,
  to: P2,
  opts: { arrive?: number; sprint?: boolean; timeoutMs?: number; label?: string } = {},
): Promise<void> {
  const arrive = opts.arrive ?? 1.0
  const timeoutMs = opts.timeoutMs ?? 120_000
  const label = opts.label ?? `${to.x.toFixed(1)},${to.z.toFixed(1)}`
  const t0 = Date.now()
  let replans = 0
  const here = async (): Promise<P2> => {
    const b = await body(page)
    return { x: b.feet[0], z: b.feet[2] }
  }
  while (Date.now() - t0 < timeoutMs) {
    const start = await here()
    if (Math.hypot(to.x - start.x, to.z - start.z) <= arrive) return
    let grid = await buildGrid(page, [start])
    let route = plan(grid, start, to)
    if (!route) {
      // Narrow doors close up at the planning margin: try again at the capsule's own size.
      grid = await buildGrid(page, [start], SQUEEZE_R)
      route = plan(grid, start, to)
    }
    if (!route) throw new Error(`no route to ${label} from ${start.x.toFixed(1)},${start.z.toFixed(1)}`)
    // The last corner is the target itself when it stands free; else the nearest free cell.
    const [tc, tr] = grid.cellOf(to)
    if (!grid.isBlocked(tc, tr)) route[route.length - 1] = to
    let i = 0
    let lastProgress = { t: Date.now(), p: start }
    await page.keyboard.down('KeyW')
    if (opts.sprint !== false) await page.keyboard.down('ShiftLeft')
    let stalled = false
    try {
      while (Date.now() - t0 < timeoutMs) {
        const p = await here()
        if (Math.hypot(to.x - p.x, to.z - p.z) <= arrive) return
        const corner = route[i]
        const d = Math.hypot(corner.x - p.x, corner.z - p.z)
        if (i < route.length - 1 && d < 0.6) {
          i++
          continue
        }
        const err = wrap(yawTo(p, corner) - (await body(page)).yaw)
        if (Math.abs(err) > 0.05) {
          // Big turns: stop, turn, go on, so a wide arc never clips a stone.
          if (Math.abs(err) > 0.8) await page.keyboard.up('KeyW')
          await look(page, yawTo(p, corner))
          if (Math.abs(err) > 0.8) await page.keyboard.down('KeyW')
        }
        if (Math.hypot(p.x - lastProgress.p.x, p.z - lastProgress.p.z) > 0.4) lastProgress = { t: Date.now(), p }
        else if (Date.now() - lastProgress.t > 2_500) {
          stalled = true
          break
        }
        await page.waitForTimeout(40)
      }
    } finally {
      await page.keyboard.up('KeyW')
      await page.keyboard.up('ShiftLeft')
    }
    if (!stalled) break
    replans++
    {
      const p = await here()
      const b = await body(page)
      log(
        `stalled on the way to ${label} at ${p.x.toFixed(1)},${p.z.toFixed(1)} yaw ${b.yaw.toFixed(2)} ` +
          `route ${route.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)}`).join(' > ')} (replan ${replans})`,
      )
    }
    // Back off a step, sidestep, and plan again from there.
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(400)
    await page.keyboard.up('KeyS')
    const side = replans % 2 === 0 ? 'KeyA' : 'KeyD'
    await page.keyboard.down(side)
    await page.waitForTimeout(450)
    await page.keyboard.up(side)
  }
  const p = await here()
  throw new Error(`walk to ${label} timed out at ${p.x.toFixed(1)},${p.z.toFixed(1)}`)
}

const hoverId = (page: Page) =>
  page.evaluate(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id ?? null)

/** Looks at a world point from where the keeper stands. */
export async function lookAt(page: Page, at: readonly [number, number, number]): Promise<void> {
  const b = await body(page)
  const eye = b.camera
  const yaw = yawTo({ x: eye[0], z: eye[2] }, { x: at[0], z: at[2] })
  const pitch = Math.atan2(at[1] - eye[1], Math.hypot(at[0] - eye[0], at[2] - eye[2]))
  await look(page, yaw, pitch)
}

/** Presses E (held 600 ms, so a slow frame cannot miss it). */
export async function pressE(page: Page, holdMs = 600): Promise<void> {
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(holdMs)
  await page.keyboard.up('KeyE')
  await frames(page, 10)
}

/**
 * Walks up to an interactable, looks at it until the crosshair hovers it, and presses E until
 * `done` holds. Tries stand points around it when one is blocked or the aim slips.
 */
export async function useProp(
  page: Page,
  id: string,
  done: () => Promise<boolean>,
  opts: { holdMs?: number; reach?: number; at?: readonly [number, number, number] } = {},
): Promise<void> {
  if (await done()) return
  const centre =
    opts.at ?? ((await page.evaluate((i) => window.__lastRites!.interactableCentre(i), id)) as [number, number, number] | null)
  expect(centre, `${id} is in the world`).not.toBeNull()
  const [cx, cy, cz] = centre!
  const reach = opts.reach ?? 1.3
  const t0 = Date.now()
  const here = await body(page)
  // Stand points around the prop on free ground (rings within reach), nearest to the keeper first.
  const grid = await buildGrid(page, [{ x: here.feet[0], z: here.feet[2] }], SQUEEZE_R)
  const ring = (rad: number) =>
    Array.from({ length: 12 }, (_, k) => {
      const a = (k / 12) * Math.PI * 2
      return { x: cx + Math.sin(a) * rad, z: cz + Math.cos(a) * rad }
    })
  const stands = [...ring(reach), ...ring(reach * 0.7), ...ring(reach * 1.35)]
    .filter((p) => {
      const [c, r] = grid.cellOf(p)
      return !grid.isBlocked(c, r)
    })
    .slice(0, 12)
    .sort(
    (a, b) =>
      Math.hypot(a.x - here.feet[0], a.z - here.feet[2]) - Math.hypot(b.x - here.feet[0], b.z - here.feet[2]),
  )
  for (const s of stands) {
    if (await done()) return
    try {
      await walkTo(page, s, { arrive: 0.45, timeoutMs: 90_000, label: id, sprint: Math.hypot(s.x - here.feet[0], s.z - here.feet[2]) > 6 })
    } catch (e) {
      log(`${id}: stand ${s.x.toFixed(1)},${s.z.toFixed(1)} unreachable (${(e as Error).message})`)
      continue
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      await lookAt(page, [cx, cy, cz])
      await frames(page, 6)
      if ((await hoverId(page)) !== id) {
        // Aim a little lower and higher: big props are hovered on their body, not their centre.
        await lookAt(page, [cx, cy - 0.25 + attempt * 0.25, cz])
        await frames(page, 6)
      }
      if ((await hoverId(page)) !== id) continue
      await pressE(page, opts.holdMs)
      if (await done()) {
        log(`${id}: used in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
        return
      }
    }
  }
  expect(await done(), `E at ${id} did its work`).toBe(true)
}
