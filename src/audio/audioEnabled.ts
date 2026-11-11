// THE audio switch. Every sound the game makes (Howler, procedural synth, music, rain) is gated
// on this one constant.
//
// Why it is false: audio is muted for now while the rest of the game is playtested.
// To turn sound back on: set it to `true`. Nothing else needs to change; the audio code and the
// volume settings are intact. Captions/subtitles do not depend on it and keep working.
export const AUDIO_ENABLED = false

let override: boolean | null = null

/** Whether audio may reach Howler / Web Audio. Read at call time so tests can force it. */
export function isAudioEnabled(): boolean {
  return override ?? AUDIO_ENABLED
}

/** Test hook: force audio on/off regardless of the constant. Pass null to restore. */
export function setAudioEnabledForTests(value: boolean | null): void {
  override = value
}
