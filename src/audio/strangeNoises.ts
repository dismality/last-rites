// Plays one strange distant noise (src/data/strangeNoises.ts) on the ambience bus, scaled by the
// "Strange noises volume" setting. Recorded only: with no file it is silent and shows no subtitle.

import { STRANGE_TIMING, strangeNoiseFile, type StrangeNoiseDef } from '../data/strangeNoises'
import { emit } from '../game/events'
import { useSettingsStore } from '../game/state/settingsStore'
import { playRecorded } from './AudioManager'

export function playStrangeNoise(noise: StrangeNoiseDef, listenerX: number, listenerZ: number, angle: number, distanceM: number): boolean {
  const level = useSettingsStore.getState().strangeVolume / 100
  if (!(level > 0)) return false
  const at = {
    x: listenerX + Math.cos(angle) * distanceM,
    y: STRANGE_TIMING.heightM,
    z: listenerZ + Math.sin(angle) * distanceM,
  }
  const voice = playRecorded(strangeNoiseFile(noise.id), at, STRANGE_TIMING.volume * level, STRANGE_TIMING.maxDistanceM, 'ambience')
  if (!voice) return false
  emit({ type: 'subtitleShown', text: noise.caption, duration: STRANGE_TIMING.captionS })
  return true
}
