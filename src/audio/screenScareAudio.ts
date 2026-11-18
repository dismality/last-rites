// Sound of a screen jumpscare (spec 11 H1). The sting is one voice made of three layers (a noise
// attack, a low thud and a falling scream, see the `screen-scare-sting` recipe), or a recorded
// file of that name when one is decoded. For the hold, everything else is ducked by 70%.
//
// The scene clock drives this module (the overlay calls it from sim time), so it keeps no timers:
// pausing halts the clock, and `stopScreenScareAudio` cuts the voice and ends the duck at once.
import { SCREEN_SCARE_DUCK } from '../data/screenScares'
import { useSettingsStore } from '../game/state/settingsStore'
import { isAudioEnabled } from './audioEnabled'
import { playSample } from './samples'
import { getSynth, type Voice } from './synth'
import { applyVolumes } from './volumes'

const STING_ID = 'screen-scare-sting'

let voice: Voice | null = null
let ducked = false

function restoreBuses(): void {
  if (!ducked) return
  ducked = false
  const s = useSettingsStore.getState()
  // setBusGain eases over about 50 ms per time constant, so the buses are back within 250 ms.
  applyVolumes({ masterVolume: s.masterVolume, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume })
}

const unit = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : 0)

/**
 * Starts the sting at `stingGain` (1 at Full, 0.5 at Reduced, 0 plays nothing) and ducks the music
 * and SFX buses to 30% (a 70% duck of everything but the sting).
 */
export function startScreenScareAudio(stingGain: number): void {
  if (!(stingGain > 0) || !isAudioEnabled()) return
  try {
    const engine = getSynth()
    if (!engine) return
    stopScreenScareAudio()
    const s = useSettingsStore.getState()
    const keep = 1 - SCREEN_SCARE_DUCK
    engine.setBusGain('sfx', unit(s.sfxVolume) * keep)
    engine.setBusGain('music', unit(s.musicVolume) * keep)
    ducked = true
    // Straight to the master: the ducked SFX bus would mute the sting, so the SFX setting is
    // applied here instead and the sting is never changed by the duck or its release.
    const volume = stingGain * unit(s.sfxVolume)
    voice =
      playSample(engine, STING_ID, undefined, volume, 0, true) ??
      engine.playVoice(STING_ID, undefined, volume, true)
  } catch {
    // never let sound break the game loop
  }
}

/** The hold is over: the rest of the mix comes back (the sting's own tail keeps playing). */
export function releaseScreenScareDuck(): void {
  try {
    restoreBuses()
  } catch {
    // no audio device
  }
}

/** Pause, end of the scare or a new run: cut the voice and restore the mix. */
export function stopScreenScareAudio(): void {
  try {
    voice?.stop()
  } catch {
    // already stopped
  }
  voice = null
  releaseScreenScareDuck()
}

export function screenScareAudioState(): { playing: boolean; ducked: boolean } {
  return { playing: voice !== null, ducked }
}
