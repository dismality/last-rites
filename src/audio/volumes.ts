// Volume wiring (Req 23.9): master -> Howler's global volume; sound effects, music, ambience and
// voices -> their buses. The strange-noises slider is read when one plays (strangeNoises.ts).
// Settings are 0..100; buses take 0..1.

import { Howler } from 'howler'
import { useSettingsStore } from '../game/state/settingsStore'
import { isAudioEnabled } from './audioEnabled'
import { getSynth } from './synth'

export interface VolumeSettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  ambienceVolume: number
  voiceVolume: number
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
    synth?.setBusGain('ambience', on ? unit(s.ambienceVolume) : 0)
    synth?.setBusGain('voice', on ? unit(s.voiceVolume) : 0)
  } catch {
    // buses not ready
  }
}

const KEYS = ['masterVolume', 'musicVolume', 'sfxVolume', 'ambienceVolume', 'voiceVolume'] as const

/** The volume fields of the settings. */
export function readVolumes(): VolumeSettings {
  const st = useSettingsStore.getState()
  return {
    masterVolume: st.masterVolume,
    musicVolume: st.musicVolume,
    sfxVolume: st.sfxVolume,
    ambienceVolume: st.ambienceVolume,
    voiceVolume: st.voiceVolume,
  }
}

/** Apply now and on every change of a volume. Returns the unsubscribe. */
export function installVolumes(): () => void {
  applyVolumes(readVolumes())
  return useSettingsStore.subscribe((state, prev) => {
    if (KEYS.some((k) => state[k] !== prev[k])) applyVolumes(readVolumes())
  })
}
