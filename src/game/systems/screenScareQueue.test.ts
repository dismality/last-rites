import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createRng } from '../rng'
import { SCREEN_SCARE_COOLDOWN_S, SCREEN_SCARE_QUEUE_EXPIRY_S, SCRIPTED_MOMENTS } from '../../data/screenScares'
import {
  afterAttempt,
  enqueueScare,
  inCooldown,
  markTelegraphed,
  needTelegraph,
  readyMoments,
  takeDue,
  type MomentContext,
} from './screenScareQueue'
import {
  initialScreenScareState,
  requestScreenScare,
  type ScareContext,
  type ScriptedMomentId,
} from './screenScares'

const IDS = SCRIPTED_MOMENTS.map((m) => m.id)
const none = new Set<ScriptedMomentId>()
const ctx0: MomentContext = {
  stage: 2,
  phase: 'night',
  playerXZ: [28, -12],
  forwardXZ: [0, -1],
  coffinOpened: true,
}
const scareCtx = (overlayOpen: boolean): ScareContext => ({
  overlayOpen,
  settings: { jumpscares: 'full', flashingLights: true, cameraShake: true },
  prefersReducedMotion: false,
  rng: createRng(1),
})

describe('enqueueScare', () => {
  // Feature: 11-horror-pass, Property 3: Scare timeline and telegraph bounds
  it('fires 0.5 to 1.5 s after the telegraph and never adds a duplicate (property)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.double({ min: 0, max: 5000, noNaN: true }), (seed, now) => {
        const rng = createRng(seed)
        const q = enqueueScare([], 'crawler', null, now, rng)
        expect(q).toHaveLength(1)
        expect(q[0].fireAt - q[0].telegraphAt).toBeGreaterThanOrEqual(0.5 - 1e-9)
        expect(q[0].fireAt - q[0].telegraphAt).toBeLessThanOrEqual(1.5 + 1e-9)
        expect(enqueueScare(q, 'crawler', null, now + 0.1, rng)).toHaveLength(1)
        expect(enqueueScare(q, 'bride', null, now, rng)).toHaveLength(2)
      }),
      { numRuns: 100 },
    )
  })

  it('telegraphs once, then waits for its time', () => {
    const q = enqueueScare([], 'scripted', 'ossuary-grille', 10, createRng(3))
    expect(needTelegraph(q)).toHaveLength(1)
    const t = markTelegraphed(q)
    expect(needTelegraph(t)).toHaveLength(0)
    expect(takeDue(t, 10).due).toHaveLength(0)
    expect(takeDue(t, 11.6).due).toHaveLength(1)
  })
})

describe('afterAttempt', () => {
  const entry = enqueueScare([], 'scripted', 'ossuary-grille', 0, createRng(2))[0]
  it('keeps a held scare, drops started, cooldown and used ones, and expires a long hold', () => {
    expect(afterAttempt(entry, 'held', entry.fireAt + 1)).toBe(entry)
    expect(afterAttempt(entry, 'started', entry.fireAt)).toBeNull()
    expect(afterAttempt(entry, 'cooldown', entry.fireAt)).toBeNull()
    expect(afterAttempt(entry, 'used', entry.fireAt)).toBeNull()
    expect(afterAttempt(entry, 'held', entry.fireAt + SCREEN_SCARE_QUEUE_EXPIRY_S + 1)).toBeNull()
  })

  // Feature: 11-horror-pass, Property 1: Screen scare cooldown and overlay gating
  it('a moment held by an overlay or skipped by the cooldown is never marked used (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDS), fc.boolean(), (id, overlay) => {
        const base = initialScreenScareState()
        const held = requestScreenScare(
          { ...base, lastStartSim: overlay ? null : 100 },
          { kind: 'scripted', momentId: id, simTime: overlay ? 100 : 100 + SCREEN_SCARE_COOLDOWN_S - 1 },
          scareCtx(overlay),
        )
        expect(held.outcome).toBe(overlay ? 'held' : 'cooldown')
        expect(held.state.used.has(id)).toBe(false)
        const later = requestScreenScare(held.state, { kind: 'scripted', momentId: id, simTime: 1000 }, scareCtx(false))
        expect(later.outcome).toBe('started')
        expect(later.state.used.has(id)).toBe(true)
        expect(requestScreenScare(later.state, { kind: 'scripted', momentId: id, simTime: 2000 }, scareCtx(false)).outcome).toBe('used')
      }),
      { numRuns: 100 },
    )
  })
})

describe('inCooldown', () => {
  it('is false before any scare and true for 180 s after a start', () => {
    expect(inCooldown(null, 5)).toBe(false)
    expect(inCooldown(10, 10 + SCREEN_SCARE_COOLDOWN_S - 0.1)).toBe(true)
    expect(inCooldown(10, 10 + SCREEN_SCARE_COOLDOWN_S)).toBe(false)
  })
})

describe('readyMoments', () => {
  it('opens the coffin only on stage 2 at night, beside it, right after it was opened', () => {
    expect(readyMoments(ctx0, none)).toEqual(['coffin-night-2'])
    expect(readyMoments({ ...ctx0, stage: 1 }, none)).toEqual([])
    expect(readyMoments({ ...ctx0, phase: 'day' }, none)).toEqual([])
    expect(readyMoments({ ...ctx0, coffinOpened: false }, none)).toEqual([])
    expect(readyMoments({ ...ctx0, playerXZ: [20, -12] }, none)).toEqual([])
    expect(readyMoments(ctx0, new Set<ScriptedMomentId>(['coffin-night-2']))).toEqual([])
  })

  it('shows the hut window face on stage 3 at night when looking west from the window', () => {
    const c: MomentContext = { ...ctx0, stage: 3, coffinOpened: false, playerXZ: [-2, 0], forwardXZ: [-1, 0] }
    expect(readyMoments(c, none)).toEqual(['hut-window-night-3'])
    expect(readyMoments({ ...c, forwardXZ: [1, 0] }, none)).toEqual([])
    expect(readyMoments({ ...c, stage: 2 }, none)).toEqual([])
  })

  it('shows the ossuary grille face in any stage, day or night, when looking north at the door', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 2, 3 as const), fc.constantFrom('day', 'dusk', 'night', 'dawn' as const), (stage, phase) => {
        const c: MomentContext = { stage, phase, playerXZ: [25, 54], forwardXZ: [0, 1], coffinOpened: false }
        expect(readyMoments(c, none)).toEqual(['ossuary-grille'])
        expect(readyMoments({ ...c, forwardXZ: [0, -1] }, none)).toEqual([])
      }),
      { numRuns: 100 },
    )
  })
})
