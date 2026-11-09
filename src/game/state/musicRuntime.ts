// Plain object the progression tick writes and MusicDriver reads per frame. Not a store: it
// changes every step and nothing renders from it. Also holds the scare silence schedule, which
// shares the music's lifetime (reset on Retry Night and New Game).
import { initMixer, type MixerState, type Weights } from '../systems/musicMixer'
import { emptySilence, type SilenceState } from '../systems/scareSilence'
import type { MusicLayer } from '../../data/music'

export interface MusicRuntime {
  layer: MusicLayer
  stems: Weights
  master: number
  mixer: MixerState
  silence: SilenceState
  reset: () => void
}

const fresh = () => {
  const mixer = initMixer(0)
  return { layer: 0 as MusicLayer, stems: mixer.to, master: mixer.master, mixer, silence: emptySilence }
}

export const musicRuntime: MusicRuntime = {
  ...fresh(),
  reset() {
    Object.assign(musicRuntime, fresh())
  },
}
