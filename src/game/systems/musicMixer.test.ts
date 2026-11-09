import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MUSIC, STEM_WEIGHTS, type MusicLayer } from '../../data/music'
import { currentWeights, initMixer, stepMixer, type MixerState } from './musicMixer'

const layerArb = fc.constantFrom<MusicLayer>(0, 1, 2, 3)
const dtArb = fc.double({ min: 0, max: 0.5, noNaN: true })
const stepsArb = fc.array(fc.record({ layer: layerArb, dt: dtArb }), { minLength: 1, maxLength: 60 })
const EPS = 1e-9

describe('musicMixer', () => {
  it('starts settled on its layer with full master', () => {
    const s = initMixer(2)
    expect(currentWeights(s)).toEqual(STEM_WEIGHTS[2])
    expect(s.master).toBe(1)
  })

  it('reaches the target two seconds after a change', () => {
    let s = stepMixer(initMixer(0), { layer: 3, silent: false }, 0)
    s = stepMixer(s, { layer: 3, silent: false }, MUSIC.crossfadeS)
    expect(currentWeights(s)).toEqual(STEM_WEIGHTS[3])
  })

  // Property 26
  it('Property 26: crossfades are continuous and frozen by pause', () => {
    // **Validates: Requirements 9.2, 9.9**
    fc.assert(
      fc.property(layerArb, stepsArb, (start, steps) => {
        let s: MixerState = initMixer(start)
        for (const { layer, dt } of steps) {
          const before = currentWeights(s)
          const next = stepMixer(s, { layer, silent: false }, dt)
          const after = currentWeights(next)
          // A retarget starts from the audible weights: at dt 0 nothing moves.
          const zero = currentWeights(stepMixer(s, { layer, silent: false }, 0))
          zero.forEach((w, k) => expect(Math.abs(w - before[k]!)).toBeLessThan(EPS))
          after.forEach((w, k) => {
            expect(w).toBeGreaterThanOrEqual(-EPS)
            expect(w).toBeLessThanOrEqual(1 + EPS)
            const span = Math.abs(next.to[k]! - next.from[k]!)
            expect(Math.abs(w - before[k]!)).toBeLessThanOrEqual((span * dt) / MUSIC.crossfadeS + EPS)
          })
          s = next
        }
        // Settled two seconds after the last change.
        const last = steps[steps.length - 1]!.layer
        const done = stepMixer(s, { layer: last, silent: false }, MUSIC.crossfadeS)
        currentWeights(done).forEach((w, k) => expect(w).toBeCloseTo(STEM_WEIGHTS[last][k]!, 9))
      }),
    )
  })

  it('Property 26: zero steps change nothing', () => {
    // **Validates: Requirements 9.9**
    fc.assert(
      fc.property(layerArb, layerArb, dtArb, (a, b, dt) => {
        const mid = stepMixer(initMixer(a), { layer: b, silent: false }, dt)
        expect(stepMixer(mid, { layer: b, silent: false }, 0)).toEqual(mid)
      }),
    )
  })

  // Property 27 (mixer half)
  it('Property 27: master falls to 0 within 0.3 s of silence and rises over 2 s afterwards', () => {
    // **Validates: Requirements 9.5, 9.7**
    fc.assert(
      fc.property(layerArb, (layer) => {
        let s = initMixer(layer)
        s = stepMixer(s, { layer, silent: true }, MUSIC.duckFadeS)
        expect(s.master).toBeCloseTo(0, 9)
        s = stepMixer(s, { layer, silent: false }, MUSIC.fadeInS / 2)
        expect(s.master).toBeCloseTo(0.5, 9)
        s = stepMixer(s, { layer, silent: false }, MUSIC.fadeInS / 2)
        expect(s.master).toBeCloseTo(1, 9)
      }),
    )
  })

  it('Property 27: master stays within 0..1 and the fade tracks the layer while silent', () => {
    // **Validates: Requirements 9.7**
    fc.assert(
      fc.property(layerArb, layerArb, stepsArb, (start, target, steps) => {
        let s = initMixer(start)
        for (const { layer, dt } of steps) {
          s = stepMixer(s, { layer, silent: true }, dt)
          expect(s.master).toBeGreaterThanOrEqual(0)
          expect(s.master).toBeLessThanOrEqual(1)
        }
        // Silence on throughout, then the weights still settle on the current layer.
        s = stepMixer(s, { layer: target, silent: true }, 0)
        s = stepMixer(s, { layer: target, silent: true }, MUSIC.crossfadeS)
        currentWeights(s).forEach((w, k) => expect(w).toBeCloseTo(STEM_WEIGHTS[target][k]!, 9))
        expect(s.master).toBe(0)
      }),
    )
  })
})
