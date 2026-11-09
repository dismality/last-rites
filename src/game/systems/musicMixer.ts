import { MUSIC, STEM_WEIGHTS, type MusicLayer } from '../../data/music'

/** Stem gains: drone, unease, tension, danger. */
export type Weights = readonly [number, number, number, number]

export interface MixerState {
  from: Weights
  to: Weights
  /** Seconds since the last retarget, held at the crossfade length once it is done. */
  t: number
  layer: MusicLayer
  /** Master gain 0..1: ducked while a scare silence is on. */
  master: number
}

export const initMixer = (layer: MusicLayer): MixerState => ({
  from: STEM_WEIGHTS[layer],
  to: STEM_WEIGHTS[layer],
  t: MUSIC.crossfadeS,
  layer,
  master: 1,
})

/** Linear blend from `from` to `to` over the crossfade time (Req 9.2). */
export function currentWeights(s: MixerState): Weights {
  const k = Math.min(s.t / MUSIC.crossfadeS, 1)
  const [a0, a1, a2, a3] = s.from
  const [b0, b1, b2, b3] = s.to
  return [a0 + (b0 - a0) * k, a1 + (b1 - a1) * k, a2 + (b2 - a2) * k, a3 + (b3 - a3) * k]
}

/**
 * Advances the fade. A layer change restarts from the audible weights, so a second change
 * mid-fade never jumps. The fade runs while silent too, so the layer that fades back in is the
 * current one (Req 9.7). dt of 0 (pause) changes nothing (Req 9.9).
 */
export function stepMixer(s: MixerState, i: { layer: MusicLayer; silent: boolean }, dt: number): MixerState {
  let { from, to, t, layer } = s
  if (i.layer !== s.layer) {
    from = currentWeights(s)
    to = STEM_WEIGHTS[i.layer]
    t = 0
    layer = i.layer
  }
  t = Math.min(t + dt, MUSIC.crossfadeS)
  const rate = i.silent ? -1 / MUSIC.duckFadeS : 1 / MUSIC.fadeInS
  const master = Math.min(1, Math.max(0, s.master + rate * dt))
  return { from, to, t, layer, master }
}
