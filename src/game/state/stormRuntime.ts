// Plain object read by SkyAndFog and Weather each frame; written only by the progression tick.
import type { StormState } from '../systems/storm'

export const CALM_STORM: StormState = {
  active: false,
  strikeIn: null,
  strikeIndex: 0,
  thunder: [],
  flashAge: null,
  slow: false,
}

export interface StormRuntime {
  storm: StormState
  /** Lightning brightness 0..1 for this frame. */
  flashLevel: number
  reset: () => void
}

export const stormRuntime: StormRuntime = {
  storm: CALM_STORM,
  flashLevel: 0,
  reset() {
    stormRuntime.storm = CALM_STORM
    stormRuntime.flashLevel = 0
  },
}
