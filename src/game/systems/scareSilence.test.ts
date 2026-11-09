import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MUSIC, type MusicLayer } from '../../data/music'
import type { Settings } from '../types'
import { initMixer, stepMixer } from './musicMixer'
import {
  announce,
  beatImminent,
  emptySilence,
  fired,
  isSilent,
  majorScareActive,
  type SilenceState,
} from './scareSilence'

const intensityArb = fc.constantFrom<Settings['scareIntensity']>('full', 'reduced', 'off')
const layerArb = fc.constantFrom<MusicLayer>(0, 1, 2, 3)
const timeArb = fc.double({ min: 0, max: 100, noNaN: true })
const leadArb = fc.double({ min: 0, max: MUSIC.silenceBeforeBeatS, noNaN: true })

describe('scareSilence', () => {
  it('is quiet when empty', () => {
    expect(isSilent(emptySilence, 5)).toBe(false)
    expect(beatImminent(emptySilence)).toBe(false)
  })

  it('waits for the 1.5 s window when announced early', () => {
    const s = announce(emptySilence, 'a', 10)
    expect(isSilent(s, 8)).toBe(false)
    expect(isSilent(s, 8.5)).toBe(true)
    expect(beatImminent(s)).toBe(true)
  })

  it('holds 2 s after the beat and a later beat extends it', () => {
    let s = announce(emptySilence, 'a', 10)
    s = fired(s, 'a', 10)
    s = announce(s, 'b', 11)
    s = fired(s, 'b', 11)
    expect(isSilent(s, 12.9)).toBe(true)
    expect(isSilent(s, 13)).toBe(false)
  })

  // Property 27
  it('Property 27: silence covers the window and tracks the layer', () => {
    // **Validates: Requirements 9.5, 9.6, 9.7, 13.5**
    fc.assert(
      fc.property(
        intensityArb,
        timeArb,
        fc.array(fc.tuple(leadArb, fc.double({ min: 0, max: 5, noNaN: true })), { minLength: 1, maxLength: 4 }),
        layerArb,
        layerArb,
        (_intensity, t0, scares, before, during) => {
          // Silence is a gameplay-independent schedule: every Scare intensity gets the same windows.
          let s: SilenceState = emptySilence
          let mixer = initMixer(before)
          const events = scares.map(([lead, gap], i) => ({ id: `s${i}`, at: t0 + gap, lead }))
          // Announce all, then fire in beat order.
          let lastBeat = -Infinity
          for (const e of events) {
            s = announce(s, e.id, e.at + e.lead)
            expect(isSilent(s, e.at)).toBe(true) // on from the announcement
            expect(majorScareActive(s, e.at)).toBe(true)
            lastBeat = Math.max(lastBeat, e.at + e.lead)
          }
          const last = [...events].sort((a, b) => a.at + a.lead - (b.at + b.lead))
          for (const e of last) {
            const beat = e.at + e.lead
            expect(isSilent(s, beat + 100)).toBe(true) // pending beat keeps it on, even overdue
            s = fired(s, e.id, beat)
          }
          expect(beatImminent(s)).toBe(false)
          expect(isSilent(s, lastBeat + MUSIC.silenceAfterBeatS - 1e-6)).toBe(true)
          expect(isSilent(s, lastBeat + MUSIC.silenceAfterBeatS + 1e-6)).toBe(false)

          // Mixer: master hits 0 within the duck time, layer is tracked, fade-in goes to the current layer.
          for (let i = 0; i < 20; i++) mixer = stepMixer(mixer, { layer: during, silent: true }, 0.3 / 20)
          expect(mixer.master).toBeLessThan(1e-9)
          expect(mixer.layer).toBe(during)
          mixer = stepMixer(mixer, { layer: during, silent: false }, MUSIC.fadeInS)
          expect(mixer.master).toBeCloseTo(1, 9)
          expect(mixer.layer).toBe(during)
        },
      ),
    )
  })
})
