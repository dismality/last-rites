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
 * the HUD too but keeps the screen scare, which is drawn inside it.
 */
export async function cinematic(page: Page, on: boolean | 'scare'): Promise<void> {
  await page.evaluate((hide) => {
    let s = document.getElementById('video-cinematic') as HTMLStyleElement | null
    if (!s) {
      s = document.createElement('style')
      s.id = 'video-cinematic'
      document.head.appendChild(s)
    }
    s.textContent = hide === 'scare'
      ? '.hud * { visibility: hidden !important; } .hud .screen-scare, .hud .screen-scare * { visibility: visible !important; } .keeper-say, .objective-beacon-label, .dev-skip-chip { display: none !important; }'
      : hide
      ? '.hud, .keeper-say, .caption-stack, .captions, .controls-hint, .dev-skip-hint, .dev-skip-chip, .objective-beacon-label, [class*="dev-mode"] { display: none !important; }'
      : '.keeper-say, .dev-skip-chip, .objective-beacon-label, [class*="dev-mode"], .dev-skip-hint { display: none !important; }'
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
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 })
  await run()
  await cdp.send('Page.stopScreencast')
  await cdp.detach()
  writeFileSync(join(out, 'frames.json'), JSON.stringify(list))
}
