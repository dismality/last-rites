import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { RELEASE_FOR, resolveDeferred } from './creatureScare'
import { scareTimeline, deferredReleaseMs, resolveScareFx, type ActiveScare } from './screenScares'

const active = (kind: 'crawler' | 'bride', holdMs: number): ActiveScare => ({
  set: kind === 'crawler' ? 'zombie-bottom' : 'ghost-top',
  image: kind === 'crawler' ? 'face-zombie-1' : 'ghost-bride-1',
  kind,
  momentId: null,
  startSim: 10,
  timeline: scareTimeline(holdMs),
  fx: resolveScareFx('full', true, true, false),
})

describe('resolveDeferred', () => {
  it('applies at once when no scare is active or queued', () => {
    expect(resolveDeferred('crawler', null, false, 0)).toBe('apply')
    expect(resolveDeferred('bride', null, false, 0)).toBe('apply')
  })

  it('waits while the scare is queued', () => {
    expect(resolveDeferred('bride', null, true, 0)).toBe('wait')
  })

  it('crawler waits until the out phase starts; bride until the in phase ends', () => {
    // Feature: 11-horror-pass, Property 1: Screen scare cooldown and overlay gating (deferred effects)
    fc.assert(
      fc.property(fc.integer({ min: 550, max: 800 }), fc.double({ min: 0, max: 2, noNaN: true }), (hold, t) => {
        for (const kind of ['crawler', 'bride'] as const) {
          const a = active(kind, hold)
          const at = a.startSim + deferredReleaseMs(a.timeline, RELEASE_FOR[kind]) / 1000
          expect(resolveDeferred(kind, a, false, a.startSim + t)).toBe(a.startSim + t >= at ? 'apply' : 'wait')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('ignores a scare of the other kind', () => {
    expect(resolveDeferred('crawler', active('bride', 600), false, 10)).toBe('apply')
  })
})
