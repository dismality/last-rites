// Screen and sound capture for the demo clips: ffmpeg grabs the main monitor on the GPU
// (ddagrab, 60 fps, NVENC) and the speakers through Stereo Mix, into tools/video/clips/<name>.mp4.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CLIPS = join(HERE, 'clips')
const AUDIO = process.env.VIDEO_AUDIO_DEVICE ?? 'Stereo Mix (2- Realtek(R) Audio)'

export interface Recording {
  stop(): Promise<void>
}

/** Starts recording; resolves once ffmpeg is writing frames. */
export async function record(name: string): Promise<Recording> {
  mkdirSync(CLIPS, { recursive: true })
  const out = join(CLIPS, `${name}.mp4`)
  const ff: ChildProcess = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-y',
      '-filter_complex', 'ddagrab=0:framerate=60:draw_mouse=0',
      '-f', 'dshow', '-audio_buffer_size', '50', '-i', `audio=${AUDIO}`,
      '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '18',
      '-c:a', 'aac', '-b:a', '192k',
      out,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  let log = ''
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ffmpeg did not start: ${log.slice(-400)}`)), 15_000)
    ff.stderr!.on('data', (d: Buffer) => {
      log += d.toString()
      if (/frame=\s*\d+/.test(log)) {
        clearTimeout(t)
        resolve()
      }
    })
    ff.on('exit', (c) => reject(new Error(`ffmpeg exited ${c}: ${log.slice(-400)}`)))
  })
  return {
    stop: () =>
      new Promise<void>((resolve) => {
        ff.removeAllListeners('exit')
        ff.on('exit', () => resolve())
        ff.stdin!.write('q')
        ff.stdin!.end()
      }),
  }
}

/** Makes the browser window truly full screen (no tabs, no taskbar) on the main monitor. */
export async function fullscreen(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  const { windowId } = (await cdp.send('Browser.getWindowForTarget')) as { windowId: number }
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } })
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width: 1920, height: 1080 } })
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } })
  await page.waitForFunction(() => window.innerWidth === 1920 && window.innerHeight === 1080, undefined, { timeout: 10_000 })
  await page.bringToFront()
  focusWindow()
}

/** Gives the Chrome window OS focus (pointer lock needs it). */
export function focusWindow(): void {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(HERE, 'focus.ps1')], {
      encoding: 'utf8',
    })
    console.log(`[focus] ${out.trim()}`)
  } catch (e) {
    console.log(`[focus] failed: ${(e as Error).message.slice(0, 200)}`)
  }
}

/** Shows or hides the drawn cursor (hidden by default). */
export async function showCursor(page: Page, on: boolean): Promise<void> {
  await page.evaluate((v) => (window as unknown as { __demoCursor?: (on: boolean) => void }).__demoCursor?.(v), on)
}

/**
 * An arrow cursor drawn in the page, because the screen grab cannot see Playwright's mouse.
 * Hidden while the pointer is locked (first-person look), shown on menus and overlays.
 */
export async function fakeCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
      '<path d="M3 2 L3 22 L8.5 17 L12.5 26 L16 24.5 L12 15.8 L19.5 15.8 Z" fill="#f3ead8" stroke="#1a1410" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    const add = () => {
      const c = document.createElement('div')
      c.id = '__demo-cursor'
      c.innerHTML = svg
      Object.assign(c.style, {
        position: 'fixed', left: '0', top: '0', width: '28px', height: '28px', zIndex: '2147483647',
        pointerEvents: 'none', display: 'none', visibility: 'hidden', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))',
      })
      document.body.appendChild(c)
      let x = 960
      let y = 540
      const show = () => {
        c.style.display = document.pointerLockElement ? 'none' : 'block'
        c.style.transform = `translate(${x - 3}px, ${y - 2}px)`
      }
      window.addEventListener('mousemove', (e) => {
        if (!document.pointerLockElement) {
          x = e.clientX
          y = e.clientY
        }
        show()
      }, true)
      document.addEventListener('pointerlockchange', show)
      ;(window as unknown as { __demoCursor: (on: boolean) => void }).__demoCursor = (on) => {
        c.style.visibility = on ? 'visible' : 'hidden'
      }
    }
    if (document.body) add()
    else document.addEventListener('DOMContentLoaded', add)
  })
}
