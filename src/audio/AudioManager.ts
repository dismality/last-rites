// AudioManager — thin wrapper around Howler for Last Rites.
//
// This is a stub. Full spatial audio implementation is a separate task.
// The functions below are called by the scene layer; they will be filled in
// once the audio system task runs.

import type { AudioCueId } from '../data/enemies'

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

/** Paper rustle when a journal page is collected. TODO(audio): short page-turn one-shot. */
export function playPageTurn(): void {
  // stub
}

export function playMeleeHit(): void {
  // stub. TODO(audio): dull thud, spatialised at the zombie's position.
}

/**
 * Throw whoosh, flask shatter, bomb blast, trap whoomph, salt scatter.
 * TODO(audio): pooled 3D Howl per kind at the given position.
 */
export type ThrowSfx = 'throw' | 'flask-shatter' | 'bomb-fuse' | 'bomb-blast' | 'trap-spring' | 'salt-place'
export function playThrowSfx(kind: ThrowSfx, x: number, y: number, z: number): void {
  void kind
  void x
  void y
  void z
}

/** One heartbeat thump while health is low. TODO(audio): non-spatial low thud, volume from SFX. */
export function playHeartbeat(): void {
  // stub
}

export function playCraftingCancel(): void {
  // stub
}

// ---------------------------------------------------------------------------
// Enemy spatial audio (combat-waves task 6, Requirement 4.4)
// ---------------------------------------------------------------------------

/** A positional sound source in world space (metres). */
export interface SpatialSource {
  uid: string
  cue: AudioCueId
  x: number
  y: number
  z: number
}

/**
 * Keep Howler's listener on the camera each frame.
 * TODO(audio): Howler.pos(x, y, z) and Howler.orientation(fx, fy, fz, 0, 1, 0).
 */
export function setListener(position: readonly [number, number, number], yaw: number): void {
  void position
  void yaw
}

/**
 * Start/stop/move one looping 3D Howl per source so each zombie type is
 * recognisable by ear before it is seen.
 * TODO(audio): per-uid Howl with loop: true, panningModel 'HRTF',
 * pannerAttr({ maxDistance: CUE_MAX_DISTANCE[cue], distanceModel: 'inverse' }),
 * and howl.pos(x, y, z, id) each call; stop and drop ids no longer present.
 */
export function syncEnemyLoops(sources: readonly SpatialSource[]): void {
  void sources
}

/**
 * One-shot positional cue, e.g. the lurker's sharp breath or a wailer scream.
 * TODO(audio): play a pooled 3D Howl at the position.
 */
export function playEnemyCue(cue: AudioCueId, x: number, y: number, z: number): void {
  void cue
  void x
  void y
  void z
}

// ---------------------------------------------------------------------------
// Scare audio (mystery-scares task 4, Requirement 4.4 / 4.5)
// ---------------------------------------------------------------------------

/** Sounds the scare stager asks for. The file mapping arrives with the audio task. */
export type ScareSound =
  | 'stone-grind'
  | 'wind-gust'
  | 'door-creak'
  | 'door-slam'
  | 'soil-crumble'
  | 'hand-grab'
  | 'whisper-keeper'
  | 'breath-behind'

/**
 * One-shot positional scare sound. `volume` is the intensity profile's stinger volume
 * (1 full, 0.4 reduced, 0 off) so a quiet setting really is quiet.
 * TODO(audio): pooled 3D Howl per sound at the position, volume * sfx * master.
 */
export function playScareSound(sound: ScareSound, x: number, y: number, z: number, volume: number): void {
  void sound
  void x
  void y
  void z
  void volume
}

/**
 * Drop the ambient bed for `seconds`: silence is the telegraph for whispers, lurkers
 * and the false quiet (horror-design: drop ambient 1-2 s before a major scare).
 * TODO(audio): ramp the ambient and music buses to ~0 and back.
 */
export function duckAmbient(seconds: number): void {
  void seconds
}
