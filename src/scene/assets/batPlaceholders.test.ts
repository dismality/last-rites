import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { propModelUrl } from '../../data/assets'
import { PLACEHOLDERS } from '../../data/placeholders'
import { stepBats } from '../../game/state/batStep'
import { useBatStore } from '../../game/state/batStore'
import { resetRun } from '../../game/state/resetRun'
import { usePlayerStore } from '../../game/state/playerStore'
import { waitingPaths } from '../../game/state/waitingList'
import { useWorldStore } from '../../game/state/worldStore'
import { probe } from './useAssetOrPlaceholder'

// Spec 11 task 4.5 (Req 4.15, 8.16, 8.22): with both bat models missing, the Waiting_List lists
// each path once and the bat logic runs on without throwing (the scene draws dark ellipsoids).

const URLS = [propModelUrl('bat-perched'), propModelUrl('bat-flying')]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, headers: new Headers() })))
  resetRun()
  useWorldStore.setState({ phase: 'night', nightNumber: 1 })
  usePlayerStore.setState({ position: [1000, 0, 1000] })
})
afterEach(() => vi.unstubAllGlobals())

describe('bats with both models missing', () => {
  it('declares both models as placeholder rows', () => {
    const paths = PLACEHOLDERS.map((r) => r.path)
    for (const u of URLS) expect(paths).toContain(u)
  })

  it('registers both paths once, however often they are probed', async () => {
    for (let i = 0; i < 3; i++) await Promise.all(URLS.map((u) => probe(u)))
    const waiting = waitingPaths()
    for (const u of URLS) expect(waiting.filter((p) => p === u)).toHaveLength(1)
  })

  it('still seeds and steps the bats without throwing', () => {
    expect(() => {
      stepBats(1 / 60)
      stepBats(1 / 60)
    }).not.toThrow()
    expect(useBatStore.getState().entries.length).toBeGreaterThan(0)
  })
})
