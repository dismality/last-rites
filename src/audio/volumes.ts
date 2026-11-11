// Volume wiring (Req 23.9): master -> Howler's global volume, SFX and music -> their buses.
// Settings are 0..100; buses take 0..1.

import { Howler } from 'howler'
import { useSettingsStore } from '../game/state/settingsStore'
import { isAudioEnabled } from './audioEnabled'
import { getSynth } from './synth'

export interface VolumeSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
}

const unit = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : 0)

/** Push the settings onto Howler and the buses. Each step is isolated so one failure can't skip the rest. */
export function applyVolumes(s: VolumeSettings): void {
  const on = isAudioEnabled()
  try {
    // Muted: hard-mute Howler and zero the master, but keep the stored settings untouched.
    Howler.mute(!on)
    Howler.volume(on ? unit(s.masterVolume) : 0)
  } catch {
    // no audio device
  }
  try {
    const synth = getSynth()
    synth?.setBusGain('sfx', on ? unit(s.sfxVolume) : 0)
    synth?.setBusGain('music', on ? unit(s.musicVolume) : 0)
  } catch {
    // buses not ready
  }
}

/** Apply now and on every change of the three volumes. Returns the unsubscribe. */
export function installVolumes(): () => void {
  const read = (): VolumeSettings => {
    const st = useSettingsStore.getState()
    return { masterVolume: st.masterVolume, musicVolume: st.musicVolume, sfxVolume: st.sfxVolume }
  }
  applyVolumes(read())
  return useSettingsStore.subscribe((state, prev) => {
    if (
      state.masterVolume !== prev.masterVolume ||
      state.musicVolume !== prev.musicVolume ||
      state.sfxVolume !== prev.sfxVolume
    ) {
      applyVolumes(read())
    }
  })
}
