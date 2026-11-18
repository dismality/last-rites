import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HANDS_MODEL_URL, LANTERN_COOKIE_URL, LANTERN_MODEL_URL } from '../../data/assets'
import { PLACEHOLDERS } from '../../data/placeholders'
import { VIEWMODEL_TIMING } from '../../data/viewmodel'
import { resetRun } from '../../game/state/resetRun'
import { waitingPaths } from '../../game/state/waitingList'
import { COOKIE_PLACEHOLDER_SIZE, cookieFalloff, softRoundCookie } from '../../game/systems/lanternCookie'
import { probe } from '../assets/useAssetOrPlaceholder'
import { LANTERN_ANCHORS } from './lanternRig'

// Spec 11 task 6.5 (Req 7.7, 7.10, 8.16, 8.22): with hands.glb, lantern.glb and the cookie all
// missing, each path is listed once and the stand-ins (fixed light offset, generated cookie) work.

const URLS = [HANDS_MODEL_URL, LANTERN_MODEL_URL, LANTERN_COOKIE_URL]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, headers: new Headers() })))
  resetRun()
})
afterEach(() => vi.unstubAllGlobals())

describe('viewmodel art missing', () => {
  it('declares all three paths as placeholder rows', () => {
    const paths = PLACEHOLDERS.map((r) => r.path)
    for (const u of URLS) expect(paths).toContain(u)
  })

  it('registers each path once, however often it is probed', async () => {
    for (let i = 0; i < 3; i++) await Promise.all(URLS.map((u) => probe(u)))
    const waiting = waitingPaths()
    for (const u of URLS) expect(waiting.filter((p) => p === u)).toHaveLength(1)
  })

  it('keeps a fixed camera offset for the light without the lantern model', () => {
    expect(LANTERN_ANCHORS.glass).toHaveLength(3)
    expect(LANTERN_ANCHORS.glass.every(Number.isFinite)).toBe(true)
  })

  it('generates a soft round cookie: bright centre, dark edge, symmetric', () => {
    const n = COOKIE_PLACEHOLDER_SIZE
    const d = softRoundCookie()
    expect(d).toHaveLength(n * n * 4)
    const px = (x: number, y: number) => d[(y * n + x) * 4]
    expect(px(n >> 1, n >> 1)).toBeGreaterThan(240)
    expect(px(0, 0)).toBe(0)
    expect(px(3, n >> 1)).toBe(px(n - 1 - 3, n >> 1))
    expect(cookieFalloff(0)).toBe(1)
    expect(cookieFalloff(1)).toBe(0)
    expect(cookieFalloff(Number.NaN)).toBe(0)
  })

  it('keeps the throw action time in data', () => {
    expect(VIEWMODEL_TIMING.throwActionS).toBe(0.45)
  })
})
