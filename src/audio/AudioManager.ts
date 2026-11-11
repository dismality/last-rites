// AudioManager — thin wrapper around Howler for Last Rites.
//
// This is a stub. Full spatial audio implementation is a separate task.
// The functions below are called by the scene layer; they will be filled in
// once the audio system task runs.

import { Howler } from 'howler'
import type { AudioCueId } from '../data/enemies'
import type { SoundId } from '../data/sounds'
import { isAudioEnabled } from './audioEnabled'
import { playSound } from './synth'
import type { SoundPosition } from './synth'

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
  playSound('melee-hit')
}

/** One-shot combat voice (shots, reloads, boards, bursts). Position is optional for flat sounds. */
export function playCombatSound(id: SoundId, at?: SoundPosition, volume = 1): void {
  playSound(id, at, volume)
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

/** Keep Howler's listener on the camera each frame. Yaw 0 faces -Z, as the three.js camera does. */
export function setListener(position: readonly [number, number, number], yaw: number): void {
  if (!isAudioEnabled()) return
  try {
    Howler.pos(position[0], position[1], position[2])
    Howler.orientation(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0)
  } catch {
    // no AudioContext (unsupported or not unlocked): stay silent
  }
}

/** Cues that have a synth voice. Cues without one (shambler, lurker, wailer) stay silent for now. */
const CUE_SOUND: Readonly<Partial<Record<AudioCueId, SoundId>>> = {
  'brute-step': 'brute-step',
  'brute-grunt': 'brute-grunt',
  'bloater-gurgle': 'bloater-hiss',
  'crane-censer': 'censer-chain',
}

/** Seconds between repeats for cues that loop. Procedural voices are one-shots, so we re-trigger them. */
const LOOP_INTERVAL_S: Readonly<Partial<Record<AudioCueId, number>>> = {
  'brute-step': 0.9,
  'bloater-gurgle': 2.5,
  'crane-censer': 1.4,
}

/** Next due time (seconds) per enemy uid. A uid missing from the latest sync is dropped. */
const loopDue = new Map<string, number>()
let clock: () => number = () => performance.now() / 1000

/** Test hook: replace the clock (seconds). Pass null to restore. */
export function setLoopClockForTests(fn: (() => number) | null): void {
  clock = fn ?? (() => performance.now() / 1000)
}

/** Test hook: forget all scheduled loops. */
export function resetEnemyLoopsForTests(): void {
  loopDue.clear()
}

/**
 * Schedule repeating one-shots per enemy so each type is recognisable by ear.
 * Call every frame with the enemies that should be heard; others stop.
 */
export function syncEnemyLoops(sources: readonly SpatialSource[]): void {
  const now = clock()
  const live = new Set<string>()
  for (const s of sources) {
    const interval = LOOP_INTERVAL_S[s.cue]
    const sound = CUE_SOUND[s.cue]
    if (interval === undefined || sound === undefined) continue
    live.add(s.uid)
    const due = loopDue.get(s.uid)
    if (due !== undefined && now < due) continue
    playSound(sound, { x: s.x, y: s.y, z: s.z })
    // After a long gap (tab hidden) don't replay the backlog.
    loopDue.set(s.uid, due === undefined || now - due > interval ? now + interval : due + interval)
  }
  for (const uid of loopDue.keys()) if (!live.has(uid)) loopDue.delete(uid)
}

/** One-shot positional cue, e.g. the brute's grunt. Cues without a synth voice are silent. */
export function playEnemyCue(cue: AudioCueId, x: number, y: number, z: number): void {
  const sound = CUE_SOUND[cue]
  if (sound) playSound(sound, { x, y, z })
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
