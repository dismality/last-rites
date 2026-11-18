import { test, expect, type Page } from '@playwright/test'

// Spec 11 task 3.7 (Req 1.1, 1.3, 1.9, 1.10, 1.12, 1.13, 8.11, 8.21): the screen jumpscares.
// Each face set at Full and at Reduced (image 85% of the viewport height, on the right edge, the
// flash and the world dim only at Full), Off shows only the subtitle, the cooldown skips a second
// request, an open journal holds the scare, and Esc pauses mid-scare. Scares are started with the
// Debug_Hook's forceScreenScare (the Dev_Panel's button). Screenshots at 1280x720 and 800x600 in
// e2e/screenshots/screen-scares/.

const DIR = 'e2e/screenshots/screen-scares'
const SIZES = [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
]
type Face = 'zombie' | 'ghost'
type Level = 'full' | 'reduced' | 'off'

interface HoldSample {
  vh: number
  height: number
  top: number
  bottom: number
  brightness: number
  flashEls: number
  set: string | null
}

async function startRun(page: Page): Promise<void> {
  await page.goto('/?dev=1')
  await page.waitForFunction(() => window.__lastRites !== undefined)
  await page.evaluate(() => window.__lastRites!.startRun('normal'))
  await page.waitForFunction(
    () => (window.__lastRites!.snapshot('world') as { phaseTime: number }).phaseTime > 0.3,
    undefined,
    { timeout: 90_000 },
  )
  await page.waitForFunction(() => window.__lastRites!.body() !== null, undefined, { timeout: 30_000 })
  await page.evaluate(() => window.__lastRites!.keepAlive(true))
}

const setLevel = (page: Page, level: Level) =>
  page.evaluate((l) => window.__lastRites!.setScareSetting('jumpscares', l), level)

/** Waits until no scare is active, so the next force starts a clean one. */
const settle = (page: Page) =>
  page.waitForFunction(() => window.__lastRites!.screenScareState().active === null, undefined, { timeout: 15_000 })

async function force(page: Page, face: Face): Promise<void> {
  await settle(page)
  const res = await page.evaluate((f) => window.__lastRites!.forceScreenScare(f), face)
  expect(res).toContain(`Screen scare: ${face}`)
}

/** Waits (inside the page, frame by frame) for the face to be fully in, then measures it. */
function sampleHold(page: Page): Promise<HoldSample> {
  return page.evaluate(
    () =>
      new Promise<HoldSample>((resolve, reject) => {
        const t0 = performance.now()
        const tick = (): void => {
          const face = document.querySelector<HTMLElement>('.screen-scare__face')
          if (face && face.style.opacity === '1' && /translate\(-50%, 0%\)/.test(face.style.transform)) {
            const r = face.getBoundingClientRect()
            const s = window.__lastRites!.screenScareState()
            resolve({
              vh: window.innerHeight,
              // offsetHeight ignores the hold's scale jitter (1.00 to 1.04), which only draws larger.
              height: face.offsetHeight,
              top: r.top,
              bottom: window.innerHeight - r.bottom,
              brightness: s.brightness,
              flashEls: document.querySelectorAll('.screen-scare__flash').length,
              set: document.querySelector('.screen-scare')?.getAttribute('data-set') ?? null,
            })
            return
          }
          if (performance.now() - t0 > 4000) reject(new Error('the face never reached its hold'))
          else requestAnimationFrame(tick)
        }
        tick()
      }),
  )
}

test.describe('screen scares', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000)
    await startRun(page)
    await page.evaluate(() => {
      const h = window.__lastRites!
      h.setScareSetting('subtitles', true)
      h.setSetting('flashingLights', true)
    })
  })

  for (const face of ['zombie', 'ghost'] as const) {
    for (const level of ['full', 'reduced'] as const) {
      test(`${face} face at ${level}: 85% tall on its edge${level === 'full' ? ', flash and dim' : ', no flash or dim'}`, async ({
        page,
      }) => {
        await setLevel(page, level)
        for (const size of SIZES) {
          await page.setViewportSize(size)
          await page.waitForTimeout(300)
          await force(page, face)
          const s = await sampleHold(page)
          // Screenshot while the face holds (550 to 800 ms of sim time).
          await page.screenshot({ path: `${DIR}/${face}-${level}-${size.width}x${size.height}.png` })

          expect(s.set).toBe(face === 'zombie' ? 'zombie-bottom' : 'ghost-top')
          expect(Math.abs(s.height - s.vh * 0.85)).toBeLessThanOrEqual(1)
          // Zombies rise from the bottom edge, ghosts drop from the top edge.
          if (face === 'zombie') expect(Math.abs(s.bottom)).toBeLessThanOrEqual(1)
          else expect(Math.abs(s.top)).toBeLessThanOrEqual(1)

          const st = await page.evaluate(() => window.__lastRites!.screenScareState())
          if (level === 'full') {
            expect(st.active?.fx).toMatchObject({ flash: true, dim: true })
            expect(s.flashEls).toBe(1)
            expect(s.brightness).toBeLessThan(0.5)
          } else {
            expect(st.active?.fx).toMatchObject({ flash: false, dim: false })
            expect(s.flashEls).toBe(0)
            expect(s.brightness).toBe(1)
          }
          // The one subtitle line for the whole scare.
          await expect(page.locator('.hud-subtitles')).toContainText('[a scream, close and sudden]')
        }
      })
    }
  }

  test('Off: no image, flash or dim, only the subtitle (even with Subtitles off)', async ({ page }) => {
    await setLevel(page, 'off')
    await page.evaluate(() => window.__lastRites!.setScareSetting('subtitles', false))
    await force(page, 'zombie')
    const st = await page.evaluate(() => window.__lastRites!.screenScareState())
    expect(st.active?.subtitleOnly).toBe(true)
    expect(st.active?.fx).toMatchObject({ showImage: false, flash: false, dim: false })
    await expect(page.locator('.screen-scare__face')).toHaveCount(0)
    await expect(page.locator('.screen-scare__flash')).toHaveCount(0)
    expect((await page.evaluate(() => window.__lastRites!.screenScareState())).brightness).toBe(1)
    await expect(page.locator('.hud-subtitles')).toContainText('[a pale face lunges at you from below]')
    await page.screenshot({ path: `${DIR}/off-zombie-1280x720.png` })

    await force(page, 'ghost')
    await expect(page.locator('.hud-subtitles')).toContainText('[a ghostly face drops in from above]')
  })

  test('a second request inside the cooldown is skipped and changes nothing', async ({ page }) => {
    await setLevel(page, 'full')
    await force(page, 'zombie')
    const first = await page.evaluate(() => window.__lastRites!.screenScareState())
    expect(first.lastStartSim).not.toBeNull()
    await settle(page)
    expect(await page.evaluate(() => window.__lastRites!.requestScreenScare('crawler'))).toBe('cooldown')
    expect(await page.evaluate(() => window.__lastRites!.requestScreenScare('bride'))).toBe('cooldown')
    const after = await page.evaluate(() => window.__lastRites!.screenScareState())
    expect(after.active).toBeNull()
    expect(after.lastStartSim).toBe(first.lastStartSim)
    await expect(page.locator('.screen-scare')).toHaveCount(0)
  })

  test('an open journal holds the scare without starting the cooldown', async ({ page }) => {
    await setLevel(page, 'full')
    await page.keyboard.press('KeyJ')
    await expect(page.getByRole('dialog', { name: 'Journal' })).toBeVisible()
    expect(await page.evaluate(() => window.__lastRites!.requestScreenScare('crawler'))).toBe('held')
    let st = await page.evaluate(() => window.__lastRites!.screenScareState())
    expect(st.active).toBeNull()
    expect(st.lastStartSim).toBeNull()
    await expect(page.locator('.screen-scare')).toHaveCount(0)

    await page.keyboard.press('KeyJ')
    await expect(page.getByRole('dialog', { name: 'Journal' })).toBeHidden()
    // With the journal shut the same request goes through, so the hold cost nothing.
    expect(await page.evaluate(() => window.__lastRites!.requestScreenScare('crawler'))).toBe('started')
    st = await page.evaluate(() => window.__lastRites!.screenScareState())
    expect(st.active?.set).toBe('zombie-bottom')
  })

  test('Esc pauses mid-scare and the scare stands still until resumed', async ({ page }) => {
    await setLevel(page, 'full')
    await force(page, 'ghost')
    await sampleHold(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
    const frozen = () =>
      page.evaluate(() => {
        const f = document.querySelector<HTMLElement>('.screen-scare__face')
        return { opacity: f?.style.opacity ?? null, active: window.__lastRites!.screenScareState().active !== null }
      })
    const a = await frozen()
    await page.waitForTimeout(1200)
    const b = await frozen()
    expect(b).toEqual(a)
    expect(b.active).toBe(true)
    await page.screenshot({ path: `${DIR}/paused-mid-scare-1280x720.png` })

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden()
    await settle(page)
  })
})
