// Grab kill-cam rules (spec 10 task 8, Req 25). Pure: the store keeps the state, the scene turns
// the camera and the HUD draws the edge. No rule here changes health: the zombie's own blow, through
// the normal hit rules, is the only damage, so a scare is never the sole cause of death (Req 25.7).

import { GRAB_ENEMIES, KILL_CAM, KILL_CAM_INTENSITY } from '../../data/killCam'
import type { EnemyId } from '../../data/enemies'
import type { ScareIntensity } from './scareDirector'
import { forwardFromYaw } from './melee'

type XZ = { x: number; z: number }

/** True when the zombie at `to` is within the facing cone of a keeper at `from` looking along `yaw`. */
export function isFacing(from: XZ, yaw: number, to: XZ): boolean {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const len = Math.hypot(dx, dz)
  if (len === 0) return true
  const f = forwardFromYaw(yaw)
  const cos = (f.x * dx + f.z * dz) / len
  return cos >= Math.cos((KILL_CAM.facingHalfDeg * Math.PI) / 180)
}

export interface GrabCheck {
  enemy: EnemyId
  health: number
  maxHealth: number
  stamina: number
  facing: boolean
}

/** Req 25.1: a grab enemy reaches a keeper below 25% health, or out of stamina and not facing it. */
export function grabTriggers(c: GrabCheck): boolean {
  if (!GRAB_ENEMIES.includes(c.enemy)) return false
  if (c.health <= 0) return false
  return c.health < c.maxHealth * KILL_CAM.lowHealthFrac || (c.stamina <= 0 && !c.facing)
}

/** Req 25.2: at most one start per cooldown. */
export function cooledDown(lastStartS: number | null, nowS: number): boolean {
  return lastStartS === null || nowS - lastStartS >= KILL_CAM.cooldownS
}

export interface GrabPlan {
  /** The camera is turned to the zombie and held. */
  pull: boolean
  /** How long the keeper is held before the blow lands (0: it lands at once). */
  holdS: number
  stinger: 'grab-stinger' | 'grab-stinger-soft' | null
  shake: boolean
  /** The close-up's lean and zoom (off under reduced motion). */
  closeUp: boolean
  /** The red edge pulses, or stays steady when Flashing lights is off (Req 25.6). */
  edge: 'flash' | 'steady'
  /** The subtitle is forced past the Subtitles setting (Off only, where it is the whole scare). */
  forceCaption: boolean
}

export interface PlanInput {
  intensity: ScareIntensity
  lethal: boolean
  cameraShake: boolean
  flashingLights: boolean
  reducedMotion: boolean
}

/**
 * How one grab plays. A lethal blow plays the full close-up before the death screen (Req 25.7),
 * except at Off, which never moves the camera (Req 25.5).
 */
export function planGrab(p: PlanInput): GrabPlan {
  const tier = p.lethal && p.intensity !== 'off' ? 'full' : p.intensity
  const def = KILL_CAM_INTENSITY[tier]
  return {
    pull: def.pull,
    holdS: def.holdS,
    stinger: def.stinger,
    shake: def.shake && p.intensity === 'full' && p.cameraShake && !p.reducedMotion,
    closeUp: def.pull && !p.reducedMotion,
    edge: p.flashingLights ? 'flash' : 'steady',
    forceCaption: p.intensity === 'off',
  }
}

export interface GrabAttempt extends GrabCheck {
  nowS: number
  intensity: ScareIntensity
  damage: number
}

export interface KillCamState {
  lastStartS: number | null
}

export interface GrabOutcome {
  state: KillCamState
  /** Null when no kill-cam starts: the blow lands as a normal hit. */
  plan: GrabPlan | null
  /** The damage that lands, now or at release: always the zombie's own blow. */
  damage: number
}

/** One zombie blow on the keeper: does it start a kill-cam, and what lands. */
export function attemptGrab(
  state: KillCamState,
  a: GrabAttempt,
  opts: Omit<PlanInput, 'intensity' | 'lethal'> = { cameraShake: true, flashingLights: true, reducedMotion: false },
): GrabOutcome {
  if (!grabTriggers(a) || !cooledDown(state.lastStartS, a.nowS)) return { state, plan: null, damage: a.damage }
  const plan = planGrab({ ...opts, intensity: a.intensity, lethal: a.damage >= a.health })
  return { state: { lastStartS: a.nowS }, plan, damage: a.damage }
}

/** Yaw and pitch that look from the eye at the zombie's head (yaw 0 looks down -Z). */
export function lookAt(eye: readonly [number, number, number], target: XZ): { yaw: number; pitch: number } {
  const dx = target.x - eye[0]
  const dz = target.z - eye[2]
  const dy = KILL_CAM.headY - eye[1]
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
}

/** The shortest signed turn from `a` to `b`, in -PI..PI. */
export function angleDelta(a: number, b: number): number {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)
  return d - Math.PI
}

/** 0 at the start of the grab to 1 once the turn is done (eased), then held. */
export function turnProgress(elapsedS: number): number {
  const t = Math.min(1, Math.max(0, elapsedS / KILL_CAM.turnS))
  return t * t * (3 - 2 * t)
}

/** The held pose `elapsedS` into a pulled grab: the look eases from where the keeper was to the zombie. */
export function grabPose(
  from: { yaw: number; pitch: number },
  to: { yaw: number; pitch: number },
  elapsedS: number,
  closeUp: boolean,
): { yaw: number; pitch: number; pushM: number; fovDropDeg: number } {
  const k = turnProgress(elapsedS)
  return {
    yaw: from.yaw + angleDelta(from.yaw, to.yaw) * k,
    pitch: from.pitch + (to.pitch - from.pitch) * k,
    pushM: closeUp ? KILL_CAM.pushM * k : 0,
    fovDropDeg: closeUp ? KILL_CAM.fovDropDeg * k : 0,
  }
}

/** Red edge opacity `ageS` after the grab: pulsing with Flashing lights, steady without. */
export function edgeOpacity(ageS: number, edge: 'flash' | 'steady'): number {
  if (ageS < 0 || ageS >= KILL_CAM.edgeS) return 0
  const fade = 1 - ageS / KILL_CAM.edgeS
  if (edge === 'steady') return Math.min(1, fade * 2) * KILL_CAM.steadyOpacity
  return fade * (0.5 + 0.5 * Math.abs(Math.cos(Math.PI * KILL_CAM.edgeHz * ageS)))
}
