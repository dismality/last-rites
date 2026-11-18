// AudioManager — thin wrapper around Howler for Last Rites.
//
// Sounds with a synth recipe (data/sounds.ts) play their recorded file when there is one and the
// recipe otherwise (synth.ts). Sounds below that have no recipe play only from a recorded file
// (public/assets/audio/sfx/<name>.ogg, see samples.ts) and stay silent until it exists; their
// captions carry them meanwhile.

import { Howler } from 'howler'
import { CUE_MAX_DISTANCE, type AudioCueId } from '../data/enemies'
import type { SoundId } from '../data/sounds'
import type { StepSurface } from '../game/systems/footsteps'
import { isAudioEnabled } from './audioEnabled'
import { hasSample, playSample } from './samples'
import { getSynth, playSound } from './synth'
import type { AudioBus, SoundPosition, Voice } from './synth'

/** Play a recorded file by name (no synth fallback). Returns its stop handle, or null if silent. */
export function playRecorded(name: string, at?: SoundPosition, volume = 1, maxDistanceM = 40, bus?: AudioBus): Voice | null {
  if (!isAudioEnabled()) return null
  const engine = getSynth()
  if (!engine) return null
  return playSample(engine, name, at, volume, maxDistanceM, false, bus)
}

// ---------------------------------------------------------------------------
// Crafting sounds
// ---------------------------------------------------------------------------

/**
 * Play the workbench crafting-complete sound.
 * A wooden knock + a soft chime cue to signal the craft succeeded.
 * File: sfx/crafting-complete.ogg.
 */
export function playCraftingComplete(): void {
  playRecorded('crafting-complete')
}

/**
 * Play a short tick / clink sound each time the crafting progress bar updates.
 * Intended to be called sparingly (e.g. at 50% and 100%).
 * File: sfx/crafting-tick.ogg.
 */
export function playCraftingTick(): void {
  playRecorded('crafting-tick')
}

/** Leather creak of the satchel: sfx/satchel-open.ogg, or the shorter sfx/satchel-close.ogg. */
export function playSatchelCreak(opening: boolean): void {
  playRecorded(opening ? 'satchel-open' : 'satchel-close')
}

/** Footsteps on stone going down the chapel stair (spec 09 task 11n-f). File: sfx/stair-footsteps.ogg, ~1.5 s of slow steps. */
export function playStairFootsteps(): void {
  playRecorded('stair-footsteps')
}

/** Paper rustle when a journal page is collected. File: sfx/page-turn.ogg. */
export function playPageTurn(): void {
  playRecorded('page-turn')
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
 * File: sfx/<kind>.ogg, positioned.
 */
export type ThrowSfx = 'throw' | 'flask-shatter' | 'bomb-fuse' | 'bomb-blast' | 'trap-spring' | 'salt-place'
export function playThrowSfx(kind: ThrowSfx, x: number, y: number, z: number): void {
  playRecorded(kind, { x, y, z })
}

/** One heartbeat thump while health is low. File: sfx/heartbeat.ogg. */
export function playHeartbeat(): void {
  playRecorded('heartbeat')
}

/** The cancellation sound when crafting is interrupted by a hit: sfx/crafting-cancel.ogg. */
export function playCraftingCancel(): void {
  playRecorded('crafting-cancel')
}

/** One footstep (sfx/step-<surface>-N.ogg). Files only: with no step-<surface> file the step is silent. */
export function playFootstep(surface: StepSurface, volume = 0.6): void {
  playRecorded(`step-${surface}`, undefined, volume)
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

/** Cues that have a synth voice. A recorded file for the cue (see CUE_FILE) plays instead when present. */
const CUE_SOUND: Readonly<Partial<Record<AudioCueId, SoundId>>> = {
  'brute-step': 'brute-step',
  'brute-grunt': 'brute-grunt',
  'bloater-gurgle': 'bloater-hiss',
  'crane-censer': 'censer-chain',
  'crawler-shiver': 'crawler-tell',
  'bride-hum': 'bride-tell',
  'hound-growl': 'hound-tell',
}

/** Recorded file name per cue when it differs from the cue id (shamblers groan: zombie-groan-1..4). */
const CUE_FILE: Readonly<Partial<Record<AudioCueId, string>>> = {
  'shambler-drag': 'zombie-groan',
}

/** Seconds between repeats for cues that loop. Procedural voices are one-shots, so we re-trigger them. */
const LOOP_INTERVAL_S: Readonly<Partial<Record<AudioCueId, number>>> = {
  'brute-step': 0.9,
  'bloater-gurgle': 2.5,
  'crane-censer': 1.4,
  // File-only cues: silent until their file exists.
  'shambler-drag': 6.5,
  'lurker-breath': 3.5,
  'wailer-wail': 8,
}

/**
 * Spread (fraction of the interval, either way) for cues that should not tick like a clock. These
 * also start at a random point, so a horde does not groan in unison the moment it spawns.
 */
const LOOP_JITTER: Readonly<Partial<Record<AudioCueId, number>>> = {
  'shambler-drag': 0.5,
  'lurker-breath': 0.2,
  'wailer-wail': 0.35,
}

const cueFile = (cue: AudioCueId): string => CUE_FILE[cue] ?? cue

/** The cue can be heard: it has a synth voice or a recorded file. */
const cueAudible = (cue: AudioCueId): boolean => CUE_SOUND[cue] !== undefined || hasSample(cueFile(cue))

/** Play a cue at a spot: its recorded file first, else its synth voice. */
function voiceCue(cue: AudioCueId, at: SoundPosition): void {
  if (playRecorded(cueFile(cue), at, 1, CUE_MAX_DISTANCE[cue])) return
  const sound = CUE_SOUND[cue]
  if (sound) playSound(sound, at)
}

/** Next due time (seconds) per enemy uid. A uid missing from the latest sync is dropped. */
const loopDue = new Map<string, number>()
let clock: () => number = () => performance.now() / 1000
let loopRandom: () => number = Math.random

/** Test hook: replace the clock (seconds). Pass null to restore. */
export function setLoopClockForTests(fn: (() => number) | null): void {
  clock = fn ?? (() => performance.now() / 1000)
}

/** Test hook: replace the loop jitter's random source ([0, 1)). Pass null to restore. */
export function setLoopRandomForTests(fn: (() => number) | null): void {
  loopRandom = fn ?? Math.random
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
    if (interval === undefined || !cueAudible(s.cue)) continue
    live.add(s.uid)
    const jitter = LOOP_JITTER[s.cue] ?? 0
    const due = loopDue.get(s.uid)
    if (due === undefined && jitter > 0) {
      // First sight: wait a random part of the interval before the first groan.
      loopDue.set(s.uid, now + loopRandom() * interval)
      continue
    }
    if (due !== undefined && now < due) continue
    voiceCue(s.cue, { x: s.x, y: s.y, z: s.z })
    const next = interval * (1 + jitter * (loopRandom() * 2 - 1))
    // After a long gap (tab hidden) don't replay the backlog.
    loopDue.set(s.uid, due === undefined || now - due > interval ? now + next : due + next)
  }
  for (const uid of loopDue.keys()) if (!live.has(uid)) loopDue.delete(uid)
}

/** One-shot positional cue, e.g. the brute's grunt. Silent with no file and no synth voice. */
export function playEnemyCue(cue: AudioCueId, x: number, y: number, z: number): void {
  voiceCue(cue, { x, y, z })
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
 * File: sfx/<sound>.ogg, positioned.
 */
export function playScareSound(sound: ScareSound, x: number, y: number, z: number, volume: number): void {
  if (volume <= 0) return
  playRecorded(sound, { x, y, z }, volume)
}

/**
 * Drop the ambient bed for `seconds`: silence is the telegraph for whispers, lurkers
 * and the false quiet (horror-design: drop ambient 1-2 s before a major scare).
 * TODO(audio): ramp the ambient and music buses to ~0 and back.
 */
export function duckAmbient(seconds: number): void {
  void seconds
}
