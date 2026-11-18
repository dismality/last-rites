import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRIDE_MODEL_URL, CRAWLER_MODEL_URL, HOUND_MODEL_URL, bestiarySketchUrl } from '../../data/assets'
import { PLACEHOLDERS } from '../../data/placeholders'
import { createRng } from '../../game/rng'
import { useCreatureStore } from '../../game/state/creatureStore'
import { stepCreatures } from '../../game/state/creatureStep'
import { resetRun } from '../../game/state/resetRun'
import { usePlayerStore } from '../../game/state/playerStore'
import { waitingPaths } from '../../game/state/waitingList'
import { useWorldStore } from '../../game/state/worldStore'
import { probe } from '../assets/useAssetOrPlaceholder'

// Spec 11 task 7.5 (Req 2.19, 8.16, 8.22): with crawler.glb, bride.glb and hound.glb all missing,
// each path is listed once in the Waiting_List and the creature logic runs on without throwing
// (the scene draws zombie.glb scaled and tinted, see CreatureModel.tsx).

const MODELS = [CRAWLER_MODEL_URL, BRIDE_MODEL_URL, HOUND_MODEL_URL]
const SKETCHES = (['crawler', 'bride', 'hound'] as const).map(bestiarySketchUrl)

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, headers: new Headers() })))
  resetRun()
  useWorldStore.setState({ phase: 'night', nightNumber: 2 })
  usePlayerStore.setState({ position: [0, 0, 0] })
})
afterEach(() => vi.unstubAllGlobals())

describe('creatures with all three models missing', () => {
  it('declares the models and the sketches as placeholder rows', () => {
    const paths = PLACEHOLDERS.map((r) => r.path)
    for (const u of [...MODELS, ...SKETCHES]) expect(paths).toContain(u)
  })

  it('registers each model path once, however often it is probed', async () => {
    for (let i = 0; i < 3; i++) await Promise.all(MODELS.map((u) => probe(u)))
    const waiting = waitingPaths()
    for (const u of MODELS) expect(waiting.filter((p) => p === u)).toHaveLength(1)
  })

  it('still seeds and steps the creatures without throwing', () => {
    const rng = createRng(3)
    expect(() => {
      for (let i = 0; i < 600; i++) stepCreatures(1 / 60, rng)
    }).not.toThrow()
    expect(useCreatureStore.getState().crawlers.length).toBeGreaterThan(0)
  })
})
