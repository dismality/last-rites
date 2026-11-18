// Screen jumpscares (spec 11 H1, design bible §14.1): cooldown, gating, image choice, timeline and
// the effects each setting allows. Pure rules only. This module never touches player health: a
// scare is a presentation, and any gameplay effect that follows it is a deferred effect the caller
// releases at the times given here (Req 1.18).

import { type ScareFaceId } from '../../data/assets'
import {
  SCARE_SETS,
  SCREEN_SCARE_COOLDOWN_S,
  SCREEN_SCARE_DIM_BRIGHTNESS,
  SCREEN_SCARE_HOLD_MAX_MS,
  SCREEN_SCARE_HOLD_MIN_MS,
  SCREEN_SCARE_IN_MS,
  SCREEN_SCARE_OUT_MS,
  SCREEN_SCARE_REDUCED_STING_GAIN,
  SCREEN_SCARE_SCALE_MAX,
  SCREEN_SCARE_SCALE_MIN,
  SCREEN_SCARE_TELEGRAPH_MAX_MS,
  SCREEN_SCARE_TELEGRAPH_MIN_MS,
  SCRIPTED_MOMENTS,
  TRIGGER_SETS,
  type ScareSetId,
  type ScriptedMoment,
} from '../../data/screenScares'
import type { Rng } from '../rng'
import type { Settings } from '../types'

export type ScriptedMomentId = ScriptedMoment['id']
export type ScareKind = 'crawler' | 'bride' | 'scripted'
export type ScarePhase = 'in' | 'hold' | 'out' | 'done'

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

// ---------------------------------------------------------------------------------------------
// Effective effects: the one place that turns the settings into what a scare may do.

export interface ScareFx {
  /** Draw the face image. */
  showImage: boolean
  /** One-frame white flash at the start of the in phase. */
  flash: boolean
  /** Camera shake during the hold. */
  shake: boolean
  /** Chromatic split on the image edges. */
  chromatic: boolean
  /** World dimmed to 30% during the hold. */
  dim: boolean
  /** Scale jitter on the image during the hold. */
  jitter: boolean
  /** Sting volume relative to Full: 1, 0.5 or 0. */
  stingGain: number
  /** No image or effect, only a 3 s descriptive subtitle. */
  subtitleOnly: boolean
}

/**
 * Jumpscares picks the tier; Flashing lights and Camera shake each remove their effects at every
 * tier (Req 1.14, 1.15). Reduced motion never turns shake on by itself: `cameraShake` already
 * defaults to off for it, and shake that the player switched on again is theirs to keep, so the
 * flag only has to be able to veto.
 */
export function resolveScareFx(
  jumpscares: Settings['jumpscares'],
  flashingLights: boolean,
  cameraShake: boolean,
  prefersReducedMotion: boolean,
): ScareFx {
  if (jumpscares === 'off') {
    return {
      showImage: false,
      flash: false,
      shake: false,
      chromatic: false,
      dim: false,
      jitter: false,
      stingGain: 0,
      subtitleOnly: true,
    }
  }
  if (jumpscares === 'reduced') {
    return {
      showImage: true,
      flash: false,
      shake: false,
      chromatic: false,
      dim: false,
      jitter: false,
      stingGain: SCREEN_SCARE_REDUCED_STING_GAIN,
      subtitleOnly: false,
    }
  }
  return {
    showImage: true,
    flash: flashingLights,
    shake: cameraShake && !(prefersReducedMotion && !cameraShake),
    chromatic: flashingLights,
    dim: true,
    jitter: true,
    stingGain: 1,
    subtitleOnly: false,
  }
}

// ---------------------------------------------------------------------------------------------
// Timeline.

export interface ScareTimeline {
  inMs: number
  holdMs: number
  outMs: number
}

/** Hold length in [550, 800] ms. */
export function holdDuration(rng: Rng): number {
  const span = SCREEN_SCARE_HOLD_MAX_MS - SCREEN_SCARE_HOLD_MIN_MS
  return Math.min(SCREEN_SCARE_HOLD_MAX_MS, SCREEN_SCARE_HOLD_MIN_MS + clamp01(rng()) * span)
}

export function scareTimeline(holdMs: number): ScareTimeline {
  const hold = Math.max(SCREEN_SCARE_HOLD_MIN_MS, Math.min(SCREEN_SCARE_HOLD_MAX_MS, holdMs))
  return { inMs: SCREEN_SCARE_IN_MS, holdMs: hold, outMs: SCREEN_SCARE_OUT_MS }
}

export function timelineLengthMs(t: ScareTimeline): number {
  return t.inMs + t.holdMs + t.outMs
}

export function phaseAt(t: ScareTimeline, tMs: number): ScarePhase {
  if (tMs < t.inMs) return 'in'
  if (tMs < t.inMs + t.holdMs) return 'hold'
  if (tMs < timelineLengthMs(t)) return 'out'
  return 'done'
}

/** Progress 0..1 through the current phase (1 once done). */
export function phaseProgress(t: ScareTimeline, tMs: number): number {
  switch (phaseAt(t, tMs)) {
    case 'in':
      return clamp01(tMs / t.inMs)
    case 'hold':
      return clamp01((tMs - t.inMs) / t.holdMs)
    case 'out':
      return clamp01((tMs - t.inMs - t.holdMs) / t.outMs)
    default:
      return 1
  }
}

/** Shake amplitude (0..amplitude) at `tHoldMs` into the hold: linear decay, 0 at the end (Req 1.3). */
export function shakeAt(tHoldMs: number, holdMs: number, amplitude = 1): number {
  if (holdMs <= 0) return 0
  return amplitude * (1 - clamp01(tHoldMs / holdMs))
}

/**
 * World brightness multiplier (1 = untouched). With `dim` on it ramps to 30% across the in phase,
 * holds there and ramps back across the out phase, so the dim never pops (Req 1.3).
 */
export function worldBrightnessAt(t: ScareTimeline, tMs: number, dim: boolean): number {
  if (!dim) return 1
  const low = SCREEN_SCARE_DIM_BRIGHTNESS
  const p = phaseProgress(t, tMs)
  switch (phaseAt(t, tMs)) {
    case 'in':
      return 1 + (low - 1) * p
    case 'hold':
      return low
    case 'out':
      return low + (1 - low) * p
    default:
      return 1
  }
}

/** Image scale from a 0..1 noise sample, bounded to [1.00, 1.04]. */
/**
 * Which flicker frame shows `tMs` into a scare: the sequence stepped every `frameMs`, wrapping.
 * Not flickering (flashing lights off or a reduced scare): always the calm frame 0.
 */
export function flickerFrame(tMs: number, sequence: readonly number[], frameMs: number, flicker: boolean): number {
  if (!flicker || sequence.length === 0 || !(frameMs > 0) || !Number.isFinite(tMs)) return 0
  const step = Math.floor(Math.max(0, tMs) / frameMs) % sequence.length
  return sequence[step]
}

export function jitterScale(noise01: number): number {
  return SCREEN_SCARE_SCALE_MIN + (SCREEN_SCARE_SCALE_MAX - SCREEN_SCARE_SCALE_MIN) * clamp01(noise01)
}

/** Delay between the telegraph starting and the face: 500 to 1500 ms (Req 1.18). */
export function telegraphLeadMs(rng: Rng): number {
  const span = SCREEN_SCARE_TELEGRAPH_MAX_MS - SCREEN_SCARE_TELEGRAPH_MIN_MS
  return Math.min(SCREEN_SCARE_TELEGRAPH_MAX_MS, SCREEN_SCARE_TELEGRAPH_MIN_MS + clamp01(rng()) * span)
}

// ---------------------------------------------------------------------------------------------
// Deferred gameplay effects. A crawler's grab waits for the out phase to start, a bride's oil
// drain for the in phase to end. A scare that did not start releases its effect at once, so the
// gameplay is the same at every Jumpscares value (Req 1.6, 1.7, 1.9, 8.5).

export type DeferredRelease = 'afterOutStart' | 'afterInEnd'

/** Ms after the scare started at which the effect applies. */
export function deferredReleaseMs(t: ScareTimeline, release: DeferredRelease): number {
  return release === 'afterOutStart' ? t.inMs + t.holdMs : t.inMs
}

/** Ms after the request at which the effect applies: 0 unless the scare started. */
export function deferredDelayMs(outcome: ScareOutcome, t: ScareTimeline | null, release: DeferredRelease): number {
  if (outcome !== 'started' || t === null) return 0
  return deferredReleaseMs(t, release)
}

// ---------------------------------------------------------------------------------------------
// Image choice.

/** Random face of the set, never the one shown last from that set (Req 1.16). */
export function pickImage(set: ScareSetId, last: ScareFaceId | null, rng: Rng): ScareFaceId {
  const faces = SCARE_SETS[set].faces
  const pool = last === null ? faces : faces.filter((f) => f !== last)
  const candidates = pool.length > 0 ? pool : faces
  const i = Math.min(candidates.length - 1, Math.floor(clamp01(rng()) * candidates.length))
  return candidates[i]
}

// ---------------------------------------------------------------------------------------------
// Requests.

export interface ActiveScare {
  set: ScareSetId
  image: ScareFaceId
  kind: ScareKind
  momentId: ScriptedMomentId | null
  /** Sim time (s) the in phase began. */
  startSim: number
  timeline: ScareTimeline
  fx: ScareFx
}

export interface ScreenScareState {
  lastStartSim: number | null
  used: ReadonlySet<ScriptedMomentId>
  lastImage: Readonly<Record<ScareSetId, ScareFaceId | null>>
  active: ActiveScare | null
}

export interface ScareRequest {
  kind: ScareKind
  /** Required for `scripted`. */
  momentId?: ScriptedMomentId
  simTime: number
}

export interface ScareContext {
  /** Crafting, satchel, journal, pause, a minigame or any other overlay is open. */
  overlayOpen: boolean
  settings: Pick<Settings, 'jumpscares' | 'flashingLights' | 'cameraShake'>
  prefersReducedMotion: boolean
  rng: Rng
}

/**
 * `held`: an overlay is open, nothing changes and the caller may ask again later.
 * `cooldown`: inside the 180 s cooldown, nothing changes.
 * `used`: the scripted moment already played in this save, nothing changes.
 * `started`: the scare plays (with Jumpscares off it is a subtitle only, but still starts).
 */
export type ScareOutcome = 'started' | 'held' | 'cooldown' | 'used'

export function initialScreenScareState(): ScreenScareState {
  return {
    lastStartSim: null,
    used: new Set<ScriptedMomentId>(),
    lastImage: { 'zombie-bottom': null, 'ghost-top': null },
    active: null,
  }
}

export function setForRequest(req: ScareRequest): ScareSetId {
  if (req.kind === 'scripted') {
    const moment = SCRIPTED_MOMENTS.find((m) => m.id === req.momentId)
    if (!moment) throw new Error(`Unknown scripted screen scare: ${String(req.momentId)}`)
    return moment.set
  }
  return TRIGGER_SETS[req.kind]
}

export function requestScreenScare(
  state: ScreenScareState,
  req: ScareRequest,
  ctx: ScareContext,
): { state: ScreenScareState; outcome: ScareOutcome } {
  const set = setForRequest(req)
  if (ctx.overlayOpen) return { state, outcome: 'held' }
  const momentId = req.kind === 'scripted' ? (req.momentId ?? null) : null
  if (momentId !== null && state.used.has(momentId)) return { state, outcome: 'used' }
  if (state.lastStartSim !== null && req.simTime - state.lastStartSim < SCREEN_SCARE_COOLDOWN_S) {
    return { state, outcome: 'cooldown' }
  }

  const image = pickImage(set, state.lastImage[set], ctx.rng)
  const timeline = scareTimeline(holdDuration(ctx.rng))
  const { jumpscares, flashingLights, cameraShake } = ctx.settings
  const active: ActiveScare = {
    set,
    image,
    kind: req.kind,
    momentId,
    startSim: req.simTime,
    timeline,
    fx: resolveScareFx(jumpscares, flashingLights, cameraShake, ctx.prefersReducedMotion),
  }
  const used = momentId === null ? state.used : new Set<ScriptedMomentId>([...state.used, momentId])
  return {
    state: { lastStartSim: req.simTime, used, lastImage: { ...state.lastImage, [set]: image }, active },
    outcome: 'started',
  }
}

/** Clears the active scare once its timeline has run out. Sim time is in seconds. */
export function stepScreenScare(state: ScreenScareState, simTime: number): ScreenScareState {
  const a = state.active
  if (a === null) return state
  const tMs = (simTime - a.startSim) * 1000
  return phaseAt(a.timeline, tMs) === 'done' ? { ...state, active: null } : state
}
