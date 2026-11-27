import { test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { boot, cinematic, dolly, frames, place, quietNight, recordShot, type V3 } from './director'

// The trailer's game shots (tools/video/trailer.mjs cuts them). Headless Chrome on the GPU; each
// shot's frames go to tools/video/clips/<name>/. Only the camera and the scene are set by the
// debug hook; what's on screen is the game rendering live.
//   npx playwright test -c tools/video/playwright.video.config.ts shots          record every shot
//   $env:VIDEO_PLAN=1; npx playwright test -c tools/video/playwright.video.config.ts shots
//                                         first and last frame of each shot only, to check framing
const CLIPS = join(process.cwd(), 'tools', 'video', 'clips') // run from the repo root
const PLAN = Boolean(process.env.VIDEO_PLAN)

interface Shot {
  name: string
  from: V3
  to: V3
  at: V3
  seconds: number
  /** Runs before the camera moves (spawns, HUD on). */
  setup?: (page: Page) => Promise<void>
  /** Runs once the camera starts moving (a scare, a shot). */
  during?: (page: Page) => Promise<void>
}

const DAY: Shot[] = [
  { name: 'gate', from: [0, 0, 36], to: [0, 0, 29], at: [-2, 2.2, 0], seconds: 7 },
  { name: 'graves', from: [-4.6, 0, -4.6], to: [-7, 0, -7], at: [-14, 0.8, -16], seconds: 7 },
  { name: 'hut', from: [3.6, 0, 11], to: [2.6, 0, 7.8], at: [-0.9, 1.4, -1.9], seconds: 6 },
  { name: 'page', from: [2.45, 0, 0.7], to: [2.55, 0, -0.1], at: [2.6, 0.78, -1.3], seconds: 5 },
  { name: 'stone', from: [-8.1, 0, -19.2], to: [-8.3, 0, -20.6], at: [-8.4, 0.6, -22.4], seconds: 4.5 },
  { name: 'hymns', from: [10.3, 0, 8.4], to: [11.1, 0, 8.6], at: [12.47, 1.75, 8.7], seconds: 4 },
  { name: 'row', from: [-20, 0, -35], to: [-20, 0, -43], at: [-20, 1.4, -70], seconds: 6 },
]

const shamblers = (page: Page, pts: [number, number][]) =>
  page.evaluate((p) => window.__lastRites!.spawnZombies(p.map(([x, z]) => ({ x, z, type: 'shambler' as const }))), pts)

const NIGHT: Shot[] = [
  { name: 'night-yard', from: [-3, 0, 21], to: [-4, 0, 17], at: [-6, 1.4, 8], seconds: 6 },
  {
    name: 'dead',
    from: [-8, 0, -6.5],
    to: [-8, 0, -4.8],
    at: [-9.5, 1.0, -13],
    seconds: 7,
    setup: async (page) => {
      await quietNight(page, false)
      await shamblers(page, [[-9, -12], [-11, -13.5], [-6.5, -13], [-12.5, -11], [-8, -15.5]])
    },
  },
  {
    name: 'chapel',
    from: [10, 0, 24],
    to: [10, 0, 19],
    at: [10, 3, 5],
    seconds: 6,
    setup: async (page) => {
      await quietNight(page, true)
    },
  },
  {
    name: 'crane',
    from: [10, 0, 22],
    to: [10, 0, 19.8],
    at: [10, 2.2, 16.5],
    seconds: 5,
    setup: async (page) => {
      await quietNight(page, false)
      await page.evaluate(() => {
        const h = window.__lastRites!
        h.removeZombies((h.snapshot('enemies') as { uid: string }[]).map((e) => e.uid))
        const [c] = h.spawnZombies([{ x: 10, z: 16.5, type: 'father-crane' }])
        h.holdZombies([c], 600)
      })
    },
  },
  {
    name: 'altar',
    from: [10, 0, 3.6],
    to: [10, 0, 6.6],
    at: [10, 1.1, 9.5],
    seconds: 5,
    setup: async (page) => {
      await quietNight(page, true)
    },
  },
  {
    // Last: the shotgun hooks the lantern to the belt, so the night goes dark after this.
    name: 'fight',
    from: [-8, 0, -5],
    to: [-8, 0, -4.4],
    at: [-9, 1.2, -10],
    seconds: 5,
    setup: async (page) => {
      await quietNight(page, false)
      await cinematic(page, false)
      await shamblers(page, [[-9, -9], [-10.5, -10.5], [-7, -11]])
      await page.evaluate(() => {
        const h = window.__lastRites!
        h.give('shotgun', 1, 3)
        h.give('shotgun-shell', 12)
        h.equip(3)
      })
    },
  },
  {
    name: 'scare',
    from: [-6, 0, -12],
    to: [-6, 0, -11.6],
    at: [-6, 1.2, -20],
    seconds: 3,
    setup: async (page) => {
      await cinematic(page, 'scare')
      await quietNight(page, true)
    },
    during: async (page) => {
      await page.waitForTimeout(700)
      const outcome = await page.evaluate(() => window.__lastRites!.requestScreenScare('bride'))
      if (outcome !== 'started') throw new Error(`The screen scare did not start: ${outcome}`)
    },
  },
]

async function film(page: Page, shot: Shot): Promise<void> {
  await shot.setup?.(page)
  await place(page, shot.from, shot.at)
  await frames(page, 45) // settle: shadows, fog and the lantern catch up after a teleport
  if (PLAN) {
    await page.screenshot({ path: join(CLIPS, 'plan', `${shot.name}-a.jpg`), quality: 80 })
    await place(page, shot.to, shot.at)
    await frames(page, 30)
    await page.screenshot({ path: join(CLIPS, 'plan', `${shot.name}-b.jpg`), quality: 80 })
    return
  }
  await recordShot(page, CLIPS, shot.name, async () => {
    const move = dolly(page, shot.from, shot.to, shot.at, shot.seconds)
    await shot.during?.(page)
    if (shot.name === 'fight') {
      for (let i = 0; i < 2; i++) {
        await page.waitForTimeout(1200)
        await page.mouse.down()
        await page.mouse.up()
      }
    }
    await move
  })
}

test('shots', async ({ page }) => {
  await boot(page)
  await cinematic(page, true)
  // The objective's pillar of light would stand in every shot; shrink it to nothing (the beacon
  // moves it each frame but never scales it). The dev server serves the same module instance.
  await page.evaluate(async () => {
    const path = '/src/scene/player/bodyRuntime.ts'
    const { bodyRuntime } = await import(/* @vite-ignore */ path)
    const hide = () => bodyRuntime.scene?.getObjectByName('objective-beacon')?.scale.setScalar(0.0001)
    hide()
    window.setInterval(hide, 500)
  })
  for (const shot of DAY) await film(page, shot)

  await page.evaluate(() => window.__lastRites!.skipToNight(1))
  await page.waitForFunction(() => (window.__lastRites!.snapshot('world') as { phase: string }).phase === 'night')
  await quietNight(page, true)
  await frames(page, 240) // the night sky and fog settle in
  for (const shot of NIGHT) await film(page, shot)
})
