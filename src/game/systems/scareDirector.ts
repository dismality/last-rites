// Scare director: decides WHEN a scare fires and WHICH one. Staging lives in src/scene/scares/.
// Pure TypeScript: no React, three.js or Howler imports.

import {
  SCARE_EVENT_MAP,
  SCARE_ZONES,
  type ScareEventDef,
  type ScareEventId,
  type ScareZone,
} from '../../data/scares'
import type { Rng } from '../rng'
import type { Phase, Settings } from '../types'

export type ScareIntensity = Settings['scareIntensity']

// Tuning (docs/game-design.md §9). Kept here as named constants, not inline magic numbers.
export const BASE_CHANCE = 0.35
export const LOW_FUEL_THRESHOLD = 30
export const LOW_FUEL_BONUS = 0.25
export const NIGHT_BONUS = 0.15
export const NEAR_CANDLE_PENALTY = 0.3
export const MAX_CHANCE = 0.95
export const MAJOR_COOLDOWN_S = 45
export const MINOR_COOLDOWN_S = 15
export const DIG_HAND_CHANCE_DAY = 0.2
export const DIG_HAND_CHANCE_NIGHT = 0.4
export const FIRST_SCARE_ZONE_ID = 'grounds-oak-path'
export const FIRST_SCARE_EVENT: ScareEventId = 'statue-turn'
/** Lunge speeds in m/s per intensity (design: Full 6, Reduced/Off 4). */
export const LUNGE_SPEED_FULL = 6
export const LUNGE_SPEED_SOFT = 4
/** Reduced scare intensity plays the stinger at this share of full volume. */
const STINGER_VOLUME_REDUCED = 0.4

export interface IntensityProfile {
  stingerVolume: number
  lungeSpeed: number
  cameraShake: boolean
  /** 'always' at Off: the subtitle is the only description of the event. */
  subtitle: 'always' | 'if-enabled'
}

export interface ScareCue {
  eventId: ScareEventId
  phase: 'telegraph' | 'beat'
  /** Director clock time (s) at which the scene should play this cue. */
  at: number
  intensityProfile: IntensityProfile
}

export interface ScareDirectorState {
  /** Director clock in seconds; advanced by tickScares. */
  time: number
  lastMajorAt: number | null
  /** Minor and 'none' tier events share the minor cooldown. */
  lastMinorAt: number | null
  lastEventByZone: Readonly<Record<string, ScareEventId>>
  firstScareDone: boolean
}

export interface ScareContext {
  enteredZones: readonly string[]
  lanternFuel: number
  phase: Phase
  nearCandle: boolean
  /** Satchel, journal, workbench, examine or pause is open: rolls are dropped, never queued. */
  uiBlocking: boolean
  intensity: ScareIntensity
  /** Camera-shake setting; defaults to true. Only matters at Full intensity. */
  cameraShakeEnabled?: boolean
  /** A grave dig finished this tick. */
  digCompleted?: boolean
}

export function createScareDirectorState(): ScareDirectorState {
  return {
    time: 0,
    lastMajorAt: null,
    lastMinorAt: null,
    lastEventByZone: {},
    firstScareDone: false,
  }
}

export function scareChance(lanternFuel: number, phase: Phase, nearCandle: boolean): number {
  const raw =
    BASE_CHANCE +
    (lanternFuel < LOW_FUEL_THRESHOLD ? LOW_FUEL_BONUS : 0) +
    (phase === 'night' ? NIGHT_BONUS : 0) -
    (nearCandle ? NEAR_CANDLE_PENALTY : 0)
  return Math.min(MAX_CHANCE, Math.max(0, raw))
}

export function intensityProfile(
  intensity: ScareIntensity,
  cameraShakeEnabled = true,
): IntensityProfile {
  switch (intensity) {
    case 'full':
      return {
        stingerVolume: 1,
        lungeSpeed: LUNGE_SPEED_FULL,
        cameraShake: cameraShakeEnabled,
        subtitle: 'if-enabled',
      }
    case 'reduced':
      return {
        stingerVolume: STINGER_VOLUME_REDUCED,
        lungeSpeed: LUNGE_SPEED_SOFT,
        cameraShake: false,
        subtitle: 'if-enabled',
      }
    case 'off':
      return {
        stingerVolume: 0,
        lungeSpeed: LUNGE_SPEED_SOFT,
        cameraShake: false,
        subtitle: 'always',
      }
  }
}

/** A scare may hurt but must never be the killing blow: returns damage capped to leave >= 1 HP. */
export function capScareDamage(health: number, damage: number): number {
  return Math.max(0, Math.min(damage, health - 1))
}

function isCoolingDown(def: ScareEventDef, state: ScareDirectorState): boolean {
  if (def.tier === 'major') {
    return state.lastMajorAt !== null && state.time - state.lastMajorAt < MAJOR_COOLDOWN_S
  }
  return state.lastMinorAt !== null && state.time - state.lastMinorAt < MINOR_COOLDOWN_S
}

/** Weighted pick; returns undefined if `candidates` is empty. */
export function pickWeighted(
  candidates: readonly ScareEventDef[],
  rng: Rng,
): ScareEventDef | undefined {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0)
  if (candidates.length === 0 || total <= 0) return undefined
  let roll = rng() * total
  for (const c of candidates) {
    roll -= c.weight
    if (roll < 0) return c
  }
  return candidates[candidates.length - 1]
}

function fire(
  state: ScareDirectorState,
  def: ScareEventDef,
  zoneId: string | undefined,
  ctx: ScareContext,
): { state: ScareDirectorState; cues: ScareCue[] } {
  const profile = intensityProfile(ctx.intensity, ctx.cameraShakeEnabled ?? true)
  const cues: ScareCue[] = [
    { eventId: def.id, phase: 'telegraph', at: state.time, intensityProfile: profile },
    {
      eventId: def.id,
      phase: 'beat',
      at: state.time + def.telegraph.lead,
      intensityProfile: profile,
    },
  ]
  const next: ScareDirectorState = {
    ...state,
    firstScareDone: true,
    lastMajorAt: def.tier === 'major' ? state.time : state.lastMajorAt,
    lastMinorAt: def.tier === 'major' ? state.lastMinorAt : state.time,
    lastEventByZone: zoneId
      ? { ...state.lastEventByZone, [zoneId]: def.id }
      : state.lastEventByZone,
  }
  return { state: next, cues }
}

function rollZone(
  state: ScareDirectorState,
  zone: ScareZone,
  ctx: ScareContext,
  rng: Rng,
): { state: ScareDirectorState; cues: ScareCue[] } {
  const none = { state, cues: [] as ScareCue[] }

  if (!state.firstScareDone) {
    // Guaranteed mild opener; other zones stay quiet until it has happened.
    if (zone.id !== FIRST_SCARE_ZONE_ID) return none
    return fire(state, SCARE_EVENT_MAP[FIRST_SCARE_EVENT], zone.id, ctx)
  }

  if (rng() >= scareChance(ctx.lanternFuel, ctx.phase, ctx.nearCandle)) return none

  const last = state.lastEventByZone[zone.id]
  const candidates = zone.events
    .filter((id) => id !== last)
    .map((id) => SCARE_EVENT_MAP[id])
    .filter((def) => !isCoolingDown(def, state))
  const picked = pickWeighted(candidates, rng)
  return picked ? fire(state, dayAdjusted(picked, ctx.phase), zone.id, ctx) : none
}

/** By day there are no zombies of any kind, so a Lurker lunge becomes a door slam (spec 10). */
export function dayAdjusted(def: ScareEventDef, phase: Phase): ScareEventDef {
  return phase === 'day' && def.id === 'lurker-lunge' ? SCARE_EVENT_MAP['door-slam'] : def
}

export function tickScares(
  prev: ScareDirectorState,
  dt: number,
  ctx: ScareContext,
  rng: Rng,
  zones: readonly ScareZone[] = SCARE_ZONES,
): { state: ScareDirectorState; cues: ScareCue[] } {
  let state: ScareDirectorState = { ...prev, time: prev.time + dt }
  const cues: ScareCue[] = []
  if (ctx.uiBlocking) return { state, cues }

  for (const zoneId of ctx.enteredZones) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) continue
    const result = rollZone(state, zone, ctx, rng)
    state = result.state
    cues.push(...result.cues)
  }

  if (ctx.digCompleted && state.firstScareDone) {
    const hand = SCARE_EVENT_MAP['hand-from-grave']
    const chance = ctx.phase === 'night' ? DIG_HAND_CHANCE_NIGHT : DIG_HAND_CHANCE_DAY
    if (!isCoolingDown(hand, state) && rng() < chance) {
      const result = fire(state, hand, undefined, ctx)
      state = result.state
      cues.push(...result.cues)
    }
  }

  return { state, cues }
}
