import { test, expect, type Page } from '@playwright/test'
import { SCARE_EVENTS } from '../src/data/scares'

// Spec 09, task 24.6 (D6): force every scare id at Full, Reduced and Off and check the jumpscare
// contract through the real stager: subtitle at the telegraph, shake only at Full with Camera shake
// on, flicker strobe only with Flashing lights on, and the beat after the telegraph's lead time.

const SHAKE_IDS = new Set(['door-slam', 'lurker-lunge', 'hand-from-grave'])
const WINDOW_MS = 3_200

interface Result {
  subtitleAtMs: number | null
  shakeAtMs: number | null
  maxFlicker: number
  strobe: boolean | null
}

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
}

async function run(page: Page, id: string, subtitle: string): Promise<Result> {
  return page.evaluate(
    async ({ id, subtitle, windowMs }) => {
      const h = window.__lastRites!
      const t0 = performance.now()
      const r = { subtitleAtMs: null, shakeAtMs: null, maxFlicker: 0, strobe: null } as {
        subtitleAtMs: number | null
        shakeAtMs: number | null
        maxFlicker: number
        strobe: boolean | null
      }
      h.forceScare(id as never)
      while (performance.now() - t0 < windowMs) {
        const now = performance.now() - t0
        const fx = h.scareFx()
        if (r.subtitleAtMs === null) {
          const lines = [...document.querySelectorAll('.hud-subtitles__line')]
          if (lines.some((l) => l.textContent?.includes(subtitle))) r.subtitleAtMs = now
        }
        // The age counts up forever after a shake, so a shake is the age dropping back to ~0.
        if (r.shakeAtMs === null && fx.shakeAge !== null && fx.shakeAge < 0.3) r.shakeAtMs = now
        if (fx.flickerLeft > r.maxFlicker) {
          r.maxFlicker = fx.flickerLeft
          r.strobe = fx.flickerStrobe
        }
        await new Promise((res) => setTimeout(res, 30))
      }
      return r
    },
    { id, subtitle, windowMs: WINDOW_MS },
  )
}

test('every scare is telegraphed, subtitled and obeys the comfort settings', async ({ page }) => {
  test.setTimeout(400_000)
  await boot(page)
  const problems: string[] = []

  for (const intensity of ['full', 'reduced', 'off'] as const) {
    await page.evaluate((v) => window.__lastRites!.setScareSetting('scareIntensity', v), intensity)
    for (const def of SCARE_EVENTS) {
      const r = await run(page, def.id, def.subtitle)
      const tag = `${def.id}@${intensity}`
      console.log(`${tag}: ${JSON.stringify(r)}`)
      if (r.subtitleAtMs === null) problems.push(`${tag}: no subtitle`)
      const shouldShake = intensity === 'full' && SHAKE_IDS.has(def.id)
      if (shouldShake && r.shakeAtMs === null) problems.push(`${tag}: expected shake`)
      if (!shouldShake && r.shakeAtMs !== null) problems.push(`${tag}: shook when it must not`)
      // The beat (shake) must come after the telegraph's lead time, never with the subtitle.
      if (shouldShake && r.shakeAtMs !== null && r.subtitleAtMs !== null) {
        const gap = r.shakeAtMs - r.subtitleAtMs
        if (gap < def.telegraph.lead * 1000 - 300) problems.push(`${tag}: beat only ${gap}ms after telegraph`)
      }
      if (def.id === 'breath-behind' && r.maxFlicker <= 0) problems.push(`${tag}: no lantern flicker telegraph`)
    }
  }

  expect(problems).toEqual([])
})

test('camera shake off and flashing lights off are respected; subtitles off hides non-forced captions', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setScareSetting('scareIntensity', 'full')
    h.setSetting('cameraShake', false)
    h.setSetting('flashingLights', false)
  })
  const slam = SCARE_EVENTS.find((e) => e.id === 'door-slam')!
  const breath = SCARE_EVENTS.find((e) => e.id === 'breath-behind')!
  const a = await run(page, slam.id, slam.subtitle)
  expect(a.shakeAtMs).toBeNull()
  const b = await run(page, breath.id, breath.subtitle)
  expect(b.maxFlicker).toBeGreaterThan(0)
  expect(b.strobe).toBe(false)

  await page.evaluate(() => {
    const h = window.__lastRites!
    h.setScareSetting('subtitles', false)
  })
  const c = await run(page, slam.id, slam.subtitle)
  expect(c.subtitleAtMs).toBeNull()
  // Off intensity: the caption is the only description, so it shows even with Subtitles off.
  await page.evaluate(() => window.__lastRites!.setScareSetting('scareIntensity', 'off'))
  const d = await run(page, slam.id, slam.subtitle)
  expect(d.subtitleAtMs).not.toBeNull()
})
