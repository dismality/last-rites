// THE audio switch. Every sound the game makes (Howler, procedural synth, music, rain) is gated
// on this one constant.
//
// On since 2026-11-18 (recorded audio files arrived; it had been muted while the game was
// playtested). Set it to `false` to silence everything again; nothing else needs to change.
// Captions/subtitles do not depend on it and keep working.
export const AUDIO_ENABLED = true

let override: boolean | null = null

/** Whether audio may reach Howler / Web Audio. Read at call time so tests can force it. */
export function isAudioEnabled(): boolean {
  return override ?? AUDIO_ENABLED
}

/** Test hook: force audio on/off regardless of the constant. Pass null to restore. */
export function setAudioEnabledForTests(value: boolean | null): void {
  override = value
}
