// Audio start-up wiring (Req 6.8, 22.1, 23.7). Kept out of main.tsx so it can be tested.
import { SOUND_IDS, type SoundId } from '../data/sounds'
import { setCombatSoundListener } from '../game/state/combatSounds'
import { playCombatSound } from './AudioManager'
import { unlockAudio } from './synth'
import { installVolumes } from './volumes'

/** Route combat sounds from game code to the audio layer. Returns the unregister function. */
export function registerCombatSounds(): () => void {
  setCombatSoundListener((id, at) => {
    // Some captioned events (boss death) have no synthesized voice; they only caption.
    if ((SOUND_IDS as readonly string[]).includes(id)) playCombatSound(id as SoundId, at)
  })
  return () => setCombatSoundListener(null)
}

let booted = false

/**
 * Browsers only allow audio after a gesture, so the Title screen calls this on its first click:
 * unlock first so the buses exist, then apply the saved volumes to them.
 */
export function bootAudioOnce(): void {
  if (booted) return
  booted = true
  unlockAudio()
  installVolumes()
}

export function resetAudioBootForTests(): void {
  booted = false
}
