import source from './screenScares.ts?raw'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createRng } from '../rng'
import {
  SCARE_SETS,
  SCARE_SET_IDS,
  SCREEN_SCARE_COOLDOWN_S,
  SCRIPTED_MOMENTS,
  type ScareSetId,
} from '../../data/screenScares'
import {
  deferredDelayMs,
  holdDuration,
  initialScreenScareState,
  jitterScale,
  phaseAt,
  phaseProgress,
  pickImage,
  requestScreenScare,
  resolveScareFx,
  scareTimeline,
  shakeAt,
  stepScreenScare,
  telegraphLeadMs,
  timelineLengthMs,
  worldBrightnessAt,
  type ScareContext,
  type ScareRequest,
  type ScreenScareState,
} from './screenScares'

const jumpArb = fc.constantFrom('full', 'reduced', 'off') as fc.Arbitrary<'full' | 'reduced' | 'off'>
const seedArb = fc.integer({ min: 0, max: 0xffffffff })
const setArb = fc.constantFrom(...SCARE_SET_IDS)
const momentArb = fc.constantFrom(...SCRIPTED_MOMENTS.map((m) => m.id))

function ctxFor(
  overlayOpen: boolean,
  seed: number,
  jumpscares: 'full' | 'reduced' | 'off' = 'full',
): ScareContext {
  return {
    overlayOpen,
    settings: { jumpscares, flashingLights: true, cameraShake: true },
    prefersReducedMotion: false,
    rng: createRng(seed),
  }
}

const requestArb: fc.Arbitrary<ScareRequest> = fc.oneof(
  fc.record({ kind: fc.constant('crawler' as const), simTime: fc.constant(0) }),
  fc.record({ kind: fc.constant('bride' as const), simTime: fc.constant(0) }),
  fc.record({ kind: fc.constant('scripted' as const), momentId: momentArb, simTime: fc.constant(0) }),
)

describe('resolveScareFx', () => {
  // Feature: 11-horror-pass, Property 2: Effective scare effects follow the settings
  it('follows the settings for every combination (property)', () => {
    // **Validates: Requirements 1.3, 1.4, 1.5, 1.12, 1.13, 1.14, 1.15, 8.4, 8.5, 8.6, 8.7**
    fc.assert(
      fc.property(jumpArb, fc.boolean(), fc.boolean(), fc.boolean(), (j, flash, shake, rm) => {
        const fx = resolveScareFx(j, flash, shake, rm)
        if (j === 'full') {
          expect(fx.showImage).toBe(true)
          expect(fx.stingGain).toBe(1)
          expect(fx.dim).toBe(true)
          expect(fx.flash).toBe(flash)
          expect(fx.chromatic).toBe(flash)
          expect(fx.shake).toBe(shake)
          expect(fx.subtitleOnly).toBe(false)
        } else if (j === 'reduced') {
          expect(fx).toMatchObject({
            showImage: true,
            flash: false,
            shake: false,
            chromatic: false,
            dim: false,
            stingGain: 0.5,
            subtitleOnly: false,
          })
        } else {
          expect(fx).toMatchObject({
            showImage: false,
            flash: false,
            shake: false,
            chromatic: false,
            dim: false,
            stingGain: 0,
            subtitleOnly: true,
          })
        }
        if (!flash) {
          expect(fx.flash).toBe(false)
          expect(fx.chromatic).toBe(false)
        }
        if (!shake) expect(fx.shake).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('gives all effects at Full with every permission', () => {
    expect(resolveScareFx('full', true, true, false)).toEqual({
      showImage: true,
      flash: true,
      shake: true,
      chromatic: true,
      dim: true,
      jitter: true,
      stingGain: 1,
      subtitleOnly: false,
    })
  })
})

describe('timeline', () => {
  // Feature: 11-horror-pass, Property 3: Scare timeline and telegraph bounds
  it('keeps hold, phases, shake, jitter and telegraph in bounds (property)', () => {
    // **Validates: Requirements 1.2, 1.3, 1.18, 8.12**
    fc.assert(
      fc.property(seedArb, fc.double({ min: 0, max: 1, noNaN: true }), (seed, noise) => {
        const rng = createRng(seed)
        const hold = holdDuration(rng)
        expect(hold).toBeGreaterThanOrEqual(550)
        expect(hold).toBeLessThanOrEqual(800)
        const t = scareTimeline(hold)
        expect(t.inMs).toBe(70)
        expect(t.outMs).toBe(250)
        expect(t.holdMs).toBe(hold)

        const order = ['in', 'hold', 'out', 'done']
        let lastIdx = 0
        let lastShake = Infinity
        const total = timelineLengthMs(t)
        for (let ms = 0; ms <= total + 20; ms += 5) {
          const idx = order.indexOf(phaseAt(t, ms))
          expect(idx).toBeGreaterThanOrEqual(lastIdx)
          lastIdx = idx
          const p = phaseProgress(t, ms)
          expect(p).toBeGreaterThanOrEqual(0)
          expect(p).toBeLessThanOrEqual(1)
          const s = shakeAt(Math.max(0, Math.min(ms - t.inMs, t.holdMs)), t.holdMs)
          expect(s).toBeLessThanOrEqual(lastShake)
          lastShake = s
        }
        expect(phaseAt(t, total)).toBe('done')
        expect(phaseAt(t, total - 1)).toBe('out')
        expect(shakeAt(t.holdMs, t.holdMs)).toBe(0)

        const scale = jitterScale(noise)
        expect(scale).toBeGreaterThanOrEqual(1)
        expect(scale).toBeLessThanOrEqual(1.04)

        const lead = telegraphLeadMs(rng)
        expect(lead).toBeGreaterThanOrEqual(500)
        expect(lead).toBeLessThanOrEqual(1500)
      }),
      { numRuns: 200 },
    )
  })

  it('has exact phase edges', () => {
    const t = scareTimeline(600)
    expect(phaseAt(t, 0)).toBe('in')
    expect(phaseAt(t, 69.9)).toBe('in')
    expect(phaseAt(t, 70)).toBe('hold')
    expect(phaseAt(t, 670)).toBe('out')
    expect(phaseAt(t, 920)).toBe('done')
  })
})

describe('pickImage', () => {
  // Feature: 11-horror-pass, Property 4: Image choice never repeats within a set
  it('stays in the set and never repeats within a set (property)', () => {
    // **Validates: Requirements 1.16**
    fc.assert(
      fc.property(fc.array(setArb, { minLength: 2, maxLength: 60 }), seedArb, (picks, seed) => {
        const rng = createRng(seed)
        const last: Record<ScareSetId, string | null> = { 'zombie-bottom': null, 'ghost-top': null }
        for (const set of picks) {
          const img = pickImage(set, last[set] as never, rng)
          expect(SCARE_SETS[set].faces).toContain(img)
          expect(img).not.toBe(last[set])
          last[set] = img
        }
      }),
      { numRuns: 200 },
    )
  })
})

describe('requestScreenScare', () => {
  // Feature: 11-horror-pass, Property 1: Screen scare cooldown and overlay gating
  it('honours the cooldown and holds during overlays (property)', () => {
    // **Validates: Requirements 1.9, 1.10**
    fc.assert(
      fc.property(
        fc.array(fc.tuple(requestArb, fc.boolean(), fc.double({ min: 0, max: 120, noNaN: true })), {
          minLength: 1,
          maxLength: 40,
        }),
        seedArb,
        (steps, seed) => {
          let state: ScreenScareState = initialScreenScareState()
          let time = 0
          const starts: number[] = []
          const ctxRng = createRng(seed)
          for (const [req, overlay, dt] of steps) {
            time += dt
            const before = state
            const r = requestScreenScare(before, { ...req, simTime: time }, { ...ctxFor(overlay, 1), rng: ctxRng })
            state = r.state
            if (overlay) {
              expect(r.outcome).toBe('held')
              expect(r.state).toBe(before)
            } else if (r.outcome === 'started') {
              starts.push(time)
            } else {
              expect(r.state).toBe(before)
              if (r.outcome === 'cooldown') {
                expect(time - (before.lastStartSim ?? -Infinity)).toBeLessThan(SCREEN_SCARE_COOLDOWN_S)
              }
              if (r.outcome === 'used') expect(before.used.has(req.momentId!)).toBe(true)
            }
          }
          for (let i = 1; i < starts.length; i++) {
            expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(SCREEN_SCARE_COOLDOWN_S)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('does not mark a scripted moment used when the cooldown skips it', () => {
    let s = requestScreenScare(initialScreenScareState(), { kind: 'crawler', simTime: 10 }, ctxFor(false, 1)).state
    const r = requestScreenScare(s, { kind: 'scripted', momentId: 'ossuary-grille', simTime: 100 }, ctxFor(false, 2))
    expect(r.outcome).toBe('cooldown')
    expect(r.state.used.has('ossuary-grille')).toBe(false)
    s = requestScreenScare(r.state, { kind: 'scripted', momentId: 'ossuary-grille', simTime: 190 }, ctxFor(false, 3)).state
    expect(s.used.has('ossuary-grille')).toBe(true)
    const again = requestScreenScare(s, { kind: 'scripted', momentId: 'ossuary-grille', simTime: 500 }, ctxFor(false, 4))
    expect(again.outcome).toBe('used')
  })

  it('does not start the cooldown for a held request', () => {
    const held = requestScreenScare(initialScreenScareState(), { kind: 'bride', simTime: 5 }, ctxFor(true, 1))
    expect(held.state.lastStartSim).toBeNull()
    expect(requestScreenScare(held.state, { kind: 'bride', simTime: 6 }, ctxFor(false, 1)).outcome).toBe('started')
  })

  it('picks the face set from the trigger and starts with Jumpscares off as a subtitle only', () => {
    const crawler = requestScreenScare(initialScreenScareState(), { kind: 'crawler', simTime: 0 }, ctxFor(false, 1))
    expect(crawler.state.active?.set).toBe('zombie-bottom')
    const bride = requestScreenScare(initialScreenScareState(), { kind: 'bride', simTime: 0 }, ctxFor(false, 1, 'off'))
    expect(bride.outcome).toBe('started')
    expect(bride.state.active?.set).toBe('ghost-top')
    expect(bride.state.active?.fx.subtitleOnly).toBe(true)
  })

  it('clears the active scare when its timeline ends', () => {
    const r = requestScreenScare(initialScreenScareState(), { kind: 'crawler', simTime: 0 }, ctxFor(false, 1))
    expect(stepScreenScare(r.state, 0.5).active).not.toBeNull()
    expect(stepScreenScare(r.state, 2).active).toBeNull()
  })

  it('releases deferred effects at the out start or the in end, and at once when skipped', () => {
    const t = scareTimeline(600)
    expect(deferredDelayMs('started', t, 'afterOutStart')).toBe(670)
    expect(deferredDelayMs('started', t, 'afterInEnd')).toBe(70)
    expect(deferredDelayMs('cooldown', null, 'afterOutStart')).toBe(0)
    expect(deferredDelayMs('held', t, 'afterInEnd')).toBe(0)
  })

  // Feature: 11-horror-pass, Property 5: Screen scare never reduces health
  it('never touches health (property, scare system part)', () => {
    // **Validates: Requirements 1.18**
    fc.assert(
      fc.property(requestArb, fc.integer({ min: 1, max: 100 }), fc.boolean(), seedArb, (req, hp, overlay, seed) => {
        const player = { hp }
        const r = requestScreenScare(initialScreenScareState(), req, ctxFor(overlay, seed))
        expect(player.hp).toBe(hp)
        expect(Object.keys(r.state).sort()).toEqual(['active', 'lastImage', 'lastStartSim', 'used'])
      }),
      { numRuns: 100 },
    )
  })

  it('stays pure TypeScript with no health, React, three or Howler imports', () => {
    const imports = source.split('\n').filter((l: string) => /^\s*(import|\} from)/.test(l)).join('\n')
    expect(imports).not.toMatch(/react|three|howler|playerHealth|state\//i)
  })
})

describe('worldBrightnessAt', () => {
  const tl = scareTimeline(600)
  it('ramps to 30% across the in phase, holds, and ramps back across the out phase', () => {
    expect(worldBrightnessAt(tl, 0, true)).toBe(1)
    expect(worldBrightnessAt(tl, tl.inMs, true)).toBeCloseTo(0.3)
    expect(worldBrightnessAt(tl, tl.inMs + 300, true)).toBeCloseTo(0.3)
    expect(worldBrightnessAt(tl, tl.inMs + tl.holdMs + tl.outMs / 2, true)).toBeCloseTo(0.65)
    expect(worldBrightnessAt(tl, timelineLengthMs(tl), true)).toBe(1)
  })
  it('never dims without the dim effect', () => {
    expect(worldBrightnessAt(tl, tl.inMs + 100, false)).toBe(1)
  })
})
