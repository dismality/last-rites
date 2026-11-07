// AudioManager — thin wrapper around Howler for Last Rites.
//
// This is a stub. Full spatial audio implementation is a separate task.
// The functions below are called by the scene layer; they will be filled in
// once the audio system task runs.

// ---------------------------------------------------------------------------
// Crafting sounds
// ---------------------------------------------------------------------------

/**
 * Play the workbench crafting-complete sound.
 * A wooden knock + a soft chime cue to signal the craft succeeded.
 *
 * TODO(audio): load and play 'public/assets/audio/crafting-complete.ogg'
 *              via Howler once the audio task implements the full manager.
 */
export function playCraftingComplete(): void {
  // stub — no-op until audio assets are wired up
}

/**
 * Play a short tick / clink sound each time the crafting progress bar updates.
 * Intended to be called sparingly (e.g. at 50% and 100%).
 *
 * TODO(audio): load 'public/assets/audio/crafting-tick.ogg'
 */
export function playCraftingTick(): void {
  // stub
}

/**
 * Play the cancellation sound when crafting is interrupted by a hit.
 *
 * TODO(audio): load 'public/assets/audio/crafting-cancel.ogg'
 */
export function playSatchelCreak(opening: boolean): void {
  // stub. TODO(audio): leather creak, a shorter one when closing (`opening` false).
  void opening
}

export function playCraftingCancel(): void {
  // stub
}
