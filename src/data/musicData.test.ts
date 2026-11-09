import { describe, expect, it } from 'vitest'
import { MUSIC, STEM_WEIGHTS, SYNTH_MUSIC } from './music'

describe('music data (§12 Reactive music)', () => {
  it('matches the layer distances', () => {
    expect(MUSIC.distance).toEqual({ danger: 6, tension: 15, unease: 30 })
  })

  it('matches the fade and silence timings', () => {
    expect(MUSIC).toMatchObject({
      crossfadeS: 2,
      duckFadeS: 0.3,
      fadeInS: 2,
      silenceBeforeBeatS: 1.5,
      silenceAfterBeatS: 2,
    })
  })

  it('stacks the stems per layer', () => {
    expect(STEM_WEIGHTS[0]).toEqual([1, 0, 0, 0])
    expect(STEM_WEIGHTS[1]).toEqual([1, 1, 0, 0])
    expect(STEM_WEIGHTS[2]).toEqual([0.8, 1, 1, 0])
    expect(STEM_WEIGHTS[3]).toEqual([1, 1, 1, 1])
  })

  it('keeps synth tuning in range', () => {
    expect(SYNTH_MUSIC.stemPeaks).toEqual([0.55, 0.4, 0.35, 0.6])
    expect(SYNTH_MUSIC.heartbeat).toMatchObject({ thudGapS: 0.22, periodS: 0.85 })
    expect(SYNTH_MUSIC.heartbeat.thudGapS).toBeLessThan(SYNTH_MUSIC.heartbeat.periodS)
  })
})
