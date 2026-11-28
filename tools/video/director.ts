// Camera and scene helpers for the demo video's shots (tools/video/shots.spec.ts). They only use
// the dev hook (window.__lastRites) the e2e suite uses: teleport, clock, spawns, panels.
import type { Page } from '@playwright/test'

export type V3 = readonly [number, number, number]

/** Starts a Normal run with the debug hook (on in the dev server), the intro skipped, the keeper kept alive. */
export async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 120_000 })
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 120_000 },
  )
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
  await page.evaluate(() => window.__lastRites!.lockless(true))
  await page.evaluate(() => window.__lastRites!.setSetting('showControlHints', false))
}

/**
 * Hides (or shows) the HTML HUD and the keeper's line for clean cinematic shots. 'scare' hides
 * the HUD too but keeps the screen scare, which is drawn inside it. 'hud' shows the HUD but not
 * the keeper's line, which the cut shows as a big subtitle instead.
 */
export async function cinematic(page: Page, on: boolean | 'scare' | 'hud'): Promise<void> {
  await page.evaluate((hide) => {
    let s = document.getElementById('video-cinematic') as HTMLStyleElement | null
    if (!s) {
      s = document.createElement('style')
      s.id = 'video-cinematic'
      document.head.appendChild(s)
    }
    s.textContent = hide === 'hud'
      ? '.keeper-say, .dev-skip-chip, .controls-hint, .control-hints, [class*="dev-mode"], .dev-skip-hint { display: none !important; }'
      : hide === 'scare'
      ? '.hud * { visibility: hidden !important; } .hud .screen-scare, .hud .screen-scare * { visibility: visible !important; } .keeper-say, .objective-beacon-label, .dev-skip-chip { display: none !important; }'
      : hide
      ? '.hud, .keeper-say, .caption-stack, .captions, .controls-hint, .dev-skip-hint, .dev-skip-chip, .objective-beacon-label, [class*="dev-mode"] { display: none !important; }'
      : '.keeper-say, .dev-skip-chip, .objective-beacon-label, [class*="dev-mode"], .dev-skip-hint { display: none !important; }'
  }, on)
}

/**
 * Blurs the altar's answers in shot: the name as it is typed and the keeper's write-up after it, so
 * the video shows a name going in without giving it away. The box and its prompt stay sharp.
 */
export async function veilAnswers(page: Page, on: boolean): Promise<void> {
  await page.evaluate((veil) => {
    let s = document.getElementById('video-veil') as HTMLStyleElement | null
    if (!s) {
      s = document.createElement('style')
      s.id = 'video-veil'
      document.head.appendChild(s)
    }
    s.textContent = veil
      ? '.altar-panel__input { color: transparent !important; text-shadow: 0 0 9px rgba(40, 24, 10, .95) !important; } .altar-panel__summary > :not(:first-child), .rite-panel__summary { filter: blur(7px); }'
      : ''
  }, on)
}

/** Waits `n` rendered frames. */
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

/** Yaw and pitch for an eye at `eye` to look at `at` (forward is -sin yaw, -cos yaw). */
export function aim(eye: V3, at: V3): { yaw: number; pitch: number } {
  const dx = at[0] - eye[0]
  const dz = at[2] - eye[2]
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(at[1] - eye[1], Math.hypot(dx, dz)) }
}

/** Puts the keeper's feet at `feet` looking at `at` (the eye is about 1.6 m up). */
export async function place(page: Page, feet: V3, at: V3): Promise<void> {
  const { yaw, pitch } = aim([feet[0], feet[1] + 1.6, feet[2]], at)
  await page.evaluate(
    ([x, z, y, yw, p]) => window.__lastRites!.teleport(x, z, { y, yaw: yw, pitch: p }),
    [feet[0], feet[2], feet[1] + 0.05, yaw, pitch] as const,
  )
  await frames(page, 8)
}

/**
 * A slow dolly: the feet glide from `from` to `to` over `seconds` while the eye keeps looking at
 * `at`. Runs inside the page on animation frames, so the motion is smooth in the recording.
 */
export async function dolly(page: Page, from: V3, to: V3, at: V3, seconds: number): Promise<void> {
  await page.evaluate(
    ({ from, to, at, seconds }) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now()
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / (seconds * 1000))
          const e = k * k * (3 - 2 * k)
          const x = from[0] + (to[0] - from[0]) * e
          const y = from[1] + (to[1] - from[1]) * e
          const z = from[2] + (to[2] - from[2]) * e
          const dx = at[0] - x
          const dz = at[2] - z
          const yaw = Math.atan2(-dx, -dz)
          const pitch = Math.atan2(at[1] - (y + 1.6), Math.hypot(dx, dz))
          window.__lastRites!.teleport(x, z, { y: y + 0.05, yaw, pitch })
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      }),
    { from, to, at, seconds },
  )
}

/** Removes every zombie now and keeps doing so while `on` (for quiet night shots). */
export async function quietNight(page: Page, on: boolean): Promise<void> {
  await page.evaluate((keep) => {
    const w = window as unknown as { __videoQuiet?: number }
    if (w.__videoQuiet) clearInterval(w.__videoQuiet)
    w.__videoQuiet = undefined
    const clear = () => {
      const all = window.__lastRites!.snapshot('enemies') as { uid: string }[]
      if (all.length > 0) window.__lastRites!.removeZombies(all.map((e) => e.uid))
    }
    clear()
    if (keep) w.__videoQuiet = window.setInterval(clear, 100)
  }, on)
}

/** Shot marks: where each shot starts and ends in this test's video, in seconds. */
export class Marks {
  private readonly t0 = Date.now()
  readonly shots: { name: string; start: number; end: number }[] = []
  private open: { name: string; start: number } | null = null
  start(name: string): void {
    this.open = { name, start: (Date.now() - this.t0) / 1000 }
  }
  end(): void {
    if (!this.open) return
    this.shots.push({ ...this.open, end: (Date.now() - this.t0) / 1000 })
    this.open = null
  }
}

/**
 * Records a shot from Chrome's screencast: every painted frame as a JPEG with its time, into
 * `dir`/<name>/. Works headless, so nothing takes over the screen. build.mjs turns the frames
 * into a steady 30 fps clip.
 */
export async function recordShot(page: Page, dir: string, name: string, run: () => Promise<void>): Promise<void> {
  const { mkdirSync, rmSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const out = join(dir, name)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const list: { file: string; t: number }[] = []
  cdp.on('Page.screencastFrame', (f) => {
    const file = `${String(list.length).padStart(5, '0')}.jpg`
    writeFileSync(join(out, file), Buffer.from(f.data, 'base64'))
    list.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 })
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  // The keeper's lines as they come up (the cut plays the recording of each and subtitles it).
  await page.evaluate(() => {
    const w = window as unknown as { __videoLines: { t: number; text: string }[]; __videoLineTimer?: number }
    w.__videoLines = []
    let last: string | null = window.__lastRites!.narration().now
    if (w.__videoLineTimer) clearInterval(w.__videoLineTimer)
    w.__videoLineTimer = window.setInterval(() => {
      const now = window.__lastRites!.narration().now
      if (now && now !== last) w.__videoLines.push({ t: Date.now() / 1000, text: now })
      last = now
    }, 40)
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 })
  await run()
  await cdp.send('Page.stopScreencast')
  await cdp.detach()
  const lines = await page.evaluate(() => {
    const w = window as unknown as { __videoLines: { t: number; text: string }[]; __videoLineTimer?: number }
    clearInterval(w.__videoLineTimer)
    return w.__videoLines
  })
  writeFileSync(join(out, 'frames.json'), JSON.stringify(list))
  writeFileSync(join(out, 'lines.json'), JSON.stringify(lines))
}

/** The prop the crosshair is on, or null. */
export const hovered = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window.__lastRites!.snapshot('hover') as { id: string } | null)?.id ?? null)

/**
 * Stands in reach of a prop and aims at it until the crosshair is on it, as a player lines up E.
 * Tries `prefer` first (a feet position), then a ring of stand points around the prop.
 */
export async function aimAt(page: Page, id: string, prefer?: V3, reach = 1.3): Promise<V3> {
  const c = (await page.evaluate((i) => window.__lastRites!.interactableCentre(i), id)) as V3 | null
  if (!c) throw new Error(`${id} is not in the world`)
  const ring: V3[] = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2
    const r = k % 2 === 0 ? reach : reach * 0.75
    return [c[0] + Math.sin(a) * r, 0, c[2] + Math.cos(a) * r] as V3
  })
  for (const feet of prefer ? [prefer, ...ring] : ring) {
    for (const dy of [0, -0.2, 0.2]) {
      await place(page, feet, [c[0], c[1] + dy, c[2]])
      await frames(page, 8)
      if ((await hovered(page)) === id) return feet
    }
  }
  throw new Error(`Could not aim at ${id}`)
}

/** Presses E as a player does (held long enough that a slow frame cannot miss it). */
export async function pressE(page: Page): Promise<void> {
  await page.keyboard.down('KeyE')
  await page.waitForTimeout(350)
  await page.keyboard.up('KeyE')
  await frames(page, 6)
}

/** A real click on an element, the cursor gliding there first (the fake cursor shows it). */
export async function clickOn(page: Page, target: import('@playwright/test').Locator, glideMs = 260): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const b = await target.boundingBox()
  if (!b) throw new Error('Nothing to click')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: Math.max(2, Math.round(glideMs / 16)) })
  await page.mouse.down()
  await page.waitForTimeout(60)
  await page.mouse.up()
  await frames(page, 3)
}

/** Draws a cursor that follows the mouse while it is free (headless Chrome paints none). */
export async function showCursor(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.getElementById('video-cursor')) return
    const c = document.createElement('div')
    c.id = 'video-cursor'
    c.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 28 28"><path d="M3 2 L3 22 L8.5 17 L12.5 26 L16 24.5 L12 15.8 L19.5 15.8 Z" fill="#f3ead8" stroke="#1a1410" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', display: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.7))' })
    document.body.appendChild(c)
    let x = 960
    let y = 540
    const draw = () => {
      // Only over a 2D screen: in the world the crosshair is the cursor.
      const open = document.querySelector('[role="dialog"], .minigame-shell, .rubbing')
      c.style.display = open ? 'block' : 'none'
      c.style.transform = `translate(${x - 3}px, ${y - 2}px)`
    }
    window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; draw() }, true)
    window.setInterval(draw, 100)
  })
}

/** Shows or hides the objective's pillar of light (the beacon moves it each frame, never scales it). */
export async function beacon(page: Page, on: boolean): Promise<void> {
  await page.evaluate(async (show) => {
    const w = window as unknown as { __videoBeacon?: number }
    const path = '/src/scene/player/bodyRuntime.ts'
    const { bodyRuntime } = await import(/* @vite-ignore */ path)
    const set = () => bodyRuntime.scene?.getObjectByName('objective-beacon')?.scale.setScalar(show ? 1 : 0.0001)
    if (w.__videoBeacon) clearInterval(w.__videoBeacon)
    set()
    w.__videoBeacon = window.setInterval(set, 300)
  }, on)
}

/** Inks the whole journal map in, as if every part of the grounds had been walked. */
export async function revealMap(page: Page): Promise<void> {
  // The ground a keeper who played Stages 1 to 3 has walked, not every cell: the hut, the graves,
  // Mausoleum Row to the Crane crypt, the chapel and the catacombs, and each landmark, so the map
  // inks in as a sketch of paths rather than a full grid.
  const routes: [number, number][][] = [
    [[2, 2], [-8, -12], [-8, -22], [-20, -36], [-20, -48], [-19, -60]],
    [[2, 2], [10, 9], [18, 22], [25, 36], [25, 57]],
    [[-8, -12], [-24, -14], [-30, 0], [-14, 14], [2, 2]],
    [[10, 9], [24, 4], [30, -14], [12, -26], [-8, -22]],
  ]
  await page.evaluate(async (routes) => {
    const a = '/src/game/state/mapStore.ts'
    const b = '/src/data/mapLandmarks.ts'
    const { useMapStore } = await import(/* @vite-ignore */ a)
    const { LANDMARKS } = await import(/* @vite-ignore */ b)
    const reveal = (x: number, z: number) => useMapStore.getState().reveal([x, 0, z])
    for (const route of routes)
      for (let i = 1; i < route.length; i++) {
        const [x0, z0] = route[i - 1]
        const [x1, z1] = route[i]
        const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3)
        for (let k = 0; k <= steps; k++) {
          const x = x0 + ((x1 - x0) * k) / steps
          const z = z0 + ((z1 - z0) * k) / steps
          for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) reveal(x + dx, z + dz)
        }
      }
    for (const l of LANDMARKS as { position: [number, number, number] }[])
      for (const [dx, dz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) reveal(l.position[0] + dx, l.position[2] + dz)
  }, routes)
}

/**
 * A spectator flight: the camera alone glides from `from` to `to` (eye positions, not feet) while
 * looking at `at`, with no hands, lantern or tool in shot; the keeper stays where he stands.
 * The pose is applied inside the renderer's own render call (so the controller cannot move the
 * camera back between frames) and the first-person hands' scene is not drawn meanwhile.
 */
export async function spectator(page: Page, from: V3, to: V3, at: V3, seconds: number): Promise<void> {
  await page.evaluate(
    async ({ from, to, at, seconds }) => {
      const { bodyRuntime } = await import('/src/scene/player/bodyRuntime.ts')
      type R = { render: (s: { getObjectByName: (n: string) => unknown }, c: unknown) => void; __videoRender?: R['render'] }
      const gl = bodyRuntime.gl as unknown as R
      const cam = bodyRuntime.camera as unknown as {
        position: { set: (x: number, y: number, z: number) => void }
        lookAt: (x: number, y: number, z: number) => void
        updateMatrixWorld: () => void
      }
      const orig = gl.__videoRender ?? gl.render.bind(gl)
      gl.__videoRender = orig
      let k = 0
      const pose = () => {
        const e = k * k * (3 - 2 * k)
        cam.position.set(...(from.map((v, i) => v + (to[i] - v) * e) as [number, number, number]))
        cam.lookAt(at[0], at[1], at[2])
        cam.updateMatrixWorld()
      }
      gl.render = (scene, camera) => {
        if (scene.getObjectByName('viewmodel')) return
        if (camera === cam) pose()
        orig(scene, camera)
      }
      const t0 = performance.now()
      await new Promise<void>((resolve) => {
        const step = () => {
          k = Math.min(1, (performance.now() - t0) / (seconds * 1000))
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      gl.render = orig
    },
    { from, to, at, seconds },
  )
}
