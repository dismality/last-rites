import { test, expect } from '@playwright/test'
import { godMode, newGame, stage1, stage2, stage3 } from './support/story'
import { log } from './support/walker'

// Spec 10 task 12 (Req 30, spec 09 task 3 moved here): the whole game in real Chrome. A New Game in
// Short Vigil through the real menus, then all three stages to the ending card, played with
// `page.mouse` and `page.keyboard` only: the keeper walks every step (a planner over the physics
// colliders steers the real W/A/S/D keys and the real mouse turns the camera under pointer lock),
// props are used with a held E, minigames and the altar are answered with real clicks, and Father
// Crane is fought with real swings. No teleport, no skip and no Dev_Panel action, except god mode
// to keep the fight fair (Req 30.2). The debug hook is only read: positions, colliders, state.
// The objective tracker is checked at each step (Req 30.3); the time to the first minigame and the
// total run time are logged (Req 30.4). See e2e/support/walker.ts and e2e/support/story.ts.

test('Short Vigil from New Game to the ending card, by mouse and keyboard only', async ({ page }) => {
  test.setTimeout(45 * 60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })

  const begun = await newGame(page)
  await godMode(page)

  const { firstMinigameS } = await stage1(page, begun)
  log(`time to the first minigame: ${firstMinigameS.toFixed(1)} s`)
  await stage2(page)
  await stage3(page)

  const totalS = (Date.now() - begun) / 1000
  log(`total run time: ${Math.floor(totalS / 60)} min ${Math.round(totalS % 60)} s`)
  await page.screenshot({ path: 'e2e/screenshots/playthrough-ending-card-1280x720.png' })
  expect(errors).toEqual([])
})
